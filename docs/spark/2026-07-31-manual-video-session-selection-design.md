# 多视频字幕会话选择与 videoId 强校验 — 设计

- 日期：2026-07-31
- 状态：已确认
- 涉及模块：Extension、Native Messaging、ListenUp Desktop

## 背景

YouTube 在 SPA 切换视频时，会先更新地址栏中的 videoId，播放器内部的
`playerResponse`、当前字幕轨和标题稍后才完成切换。当前实现把地址栏 videoId
当成目标身份，却没有验证播放器响应和字幕 URL 是否仍属于同一视频，因此可能：

1. 用新 videoId 加载到旧视频的字幕轨；
2. 把旧字幕写入新 videoId 的持久缓存；
3. 向 Desktop 发送“新 videoId + 旧字幕”的 session；
4. 在多个 YouTube 标签页播放时，由最近游标自动抢占 Desktop，用户无法显式选择。

指定样本 `M_RcV4WSc3k` 已复现缓存污染：YouTube 返回的正确字幕与 Desktop
显示的缓存字幕不一致，而 Extension 日志直接命中了旧缓存。

## 目标

- 只有一个视频正在播放时，Desktop 自动跟随该视频。
- 两个或更多视频同时播放时，停止自动抢占，由用户选择字幕来源。
- 用户选择后保持锁定，其他视频开始播放不重复打断。
- 用户可以随时从 Desktop 主动改选正在播放的视频。
- URL、播放器响应和字幕轨的 videoId 未完全一致前，旧字幕不得显示、发送或入缓存。
- 用户暂停当前视频阅读字幕时，Desktop 保留最后的有效字幕。

## 不在范围内

- Desktop 不反向控制 YouTube 的播放、暂停、seek 或标签页焦点。
- 不支持同时并排显示多个视频的字幕。
- 不把选择状态持久化到 Desktop 重启之后；重启后按当前正在播放 session 重新仲裁。
- 不改变 production / development Native Host、Extension ID、socket 和 bundle 的隔离规则。

## 术语

- **session**：一个浏览器标签页中、一个确定 videoId 的字幕会话。
- **正在播放 session**：最新 cursor 表示正在播放且不在广告中的 session，身份可能仍在校验中。
- **可选择候选**：正在播放且已通过 videoId 校验的 session；只有它能出现在选择器中。
- **当前显示项**：Desktop 当前渲染字幕的 session。
- **手动锁定项**：用户明确选择的 session；只要它仍是可选择候选，就不被其他候选自动替换。
- **身份校验门**：URL、播放器响应和字幕轨 URL 的 videoId 一致性检查。

## 选定架构

采用 **Desktop / Rust 负责多视频仲裁** 的方案。

Extension 继续独立验证和上报每个标签页的 session / cursor；background 补充现有
`tabId` 后通过 Native Messaging 单向发送。Rust `HostStore` 持有全部 session、
计算正在播放 session 与可选择候选、维护当前显示项与手动锁定项。Desktop React
只消费 Rust 快照，并通过本地 Tauri command 选择 session。

不采用 Extension background 仲裁，因为 Desktop 的点击需要反向传回 service
worker，会把当前单向链路改成双向，并引入 service worker 休眠恢复问题。不采用
content script 之间的分布式协调，因为竞态更多、难测试，最终仍要把候选列表传给
Desktop。

## Desktop 仲裁状态机

Rust 先按“正在播放 session 数量”决定自动跟随，再用“可选择候选 + 手动锁定”
决定多视频选择：

| 状态 | 行为 |
|---|---|
| 0 个正在播放 session | 保留最后一个仍存在的 session，供用户暂停阅读；不弹选择器 |
| 1 个正在播放 session | 自动切换到它并清除旧手动锁定；身份待验证时显示 loading，不显示旧字幕 |
| 2+ 个正在播放 session，存在有效手动锁定 | 保持锁定项；其他视频开始播放不打断 |
| 2+ 个正在播放 session，无有效锁定，且有 2+ 个可选择候选 | 设置 `selectionRequired = true`，显示不可跳过的选择遮罩 |
| 2+ 个正在播放 session，但不足 2 个可选择候选 | 显示“正在确认视频…”，等待身份校验完成，不自动选择未经验证的 session |

补充规则：

- 选中视频暂停、但没有其他视频播放时，继续显示它的字幕。
- 选中视频暂停、另一个视频成为唯一正在播放 session 时，自动切换；如果身份仍在
  校验，只显示该 session 的 loading。
- 手动锁定失效后，如果仍有 2+ 个已验证候选，重新要求选择。
- 收到 `end`、标签页关闭、离开 watch 页或同一标签页切换到新 videoId 后，旧
  session 从集合移除，不能继续作为保留或选择目标。
- 第三个或更多视频开始播放时，只要手动锁定仍有效，不重复显示遮罩。

## Desktop 选择 UI

### 冲突遮罩

首次出现 2+ 个正在播放 session、其中至少 2 个是可选择候选、且没有有效手动锁定
时，Desktop 内容区显示选择遮罩：

- 标题为“选择要显示字幕的视频”；
- 每行显示视频标题、短 videoId、播放状态和当前选择标记；
- 候选仅包含当前仍在播放、非广告、且已通过身份校验的 session；
- 用户必须选中一个候选，不能点击背景跳过；
- 选择成功后遮罩关闭并显示对应字幕。

### 主动改选

- 列表模式：在 footer 左下角 `YouTube · {videoId}` 旁常驻切换图标。
- 影院模式：在 hover 工具条中提供同一个切换图标。
- 少于两个可选择候选时图标禁用；只有一个正在播放 session 时说明“只有一个视频
  正在播放”，存在多个待验证 session 时说明“正在确认视频”。
- 点击图标复用冲突遮罩；当前选择行带“当前”标记。

### 过期点击

React 传给 Rust 的选择参数只包含 `sessionId`。Rust command 必须再次验证该
session 仍存在、仍在播放、没有进入广告且 videoId 已验证。验证失败时拒绝选择，
刷新候选快照；如果只剩一个候选则自动选择，如果仍有多个则保持遮罩。

## Extension videoId 身份校验

### 权威身份

一次字幕加载以 `expectedVideoId` 为目标，要求以下身份完全一致：

1. 当前 URL / `YouTubeSessionMonitor` 解析出的 videoId；
2. `playerResponse.videoDetails.videoId`；
3. 所选字幕轨 URL 的 `v` 查询参数。

页面桥接返回字幕轨时必须同时返回播放器响应 videoId。字幕轨描述符携带可验证的
`sourceVideoId`；无法解析 videoId 的轨道视为未验证，不能进入后续流程。
`ytInitialPlayerResponse` 只有能证明其 videoId 与目标一致时才允许作为来源，不能
继续充当无身份 fallback。

### 不可绕过的校验门

身份校验必须发生在：

- 读取字幕缓存之前；
- 下载字幕文档之前；
- 下载完成、解析或处理结果写入缓存之前；
- 发布 Native `ready` session 之前。

任一检查不一致或缺失字段时：

- 立即清空旧字幕和旧 track；
- 只发布绑定新 videoId 的 `loading` 状态，不发布旧 `ready`；
- 不读取、不写入字幕缓存；
- 在总计约 5 秒的窗口内短间隔重试；
- 超时后显示“视频切换尚未完成”，并等待下一次播放器或导航事件重新触发。

### 原子 React 状态

字幕 hook 不再分别暴露可任意组合的 `videoId`、`subtitles` 和 `track`，而是维护
一个 videoId 绑定快照。只有快照的 videoId 等于当前目标 videoId 时，Native
bridge 才能发送 `ready`。

旧请求通过两层机制失效：

- `AbortController` 尽快中断网络与延迟；
- generation / requestId 阻止不响应 abort 的旧异步结果回写。

videoId 变化时先发布新 videoId 的空 `loading` 快照，保证不存在“新 videoId +
旧 subtitles”的中间渲染。

## 缓存迁移

- 提升字幕缓存版本，统一淘汰可能已经污染的 `v2` 条目。
- 新缓存条目记录 `videoId` 和 `sourceVideoId`。
- 读取缓存时除键匹配外，还要验证条目中的两个 videoId 均等于
  `expectedVideoId`。
- 写缓存前再次验证当前 session、播放器响应、字幕轨 URL 和处理结果仍属于同一
  generation。

## Rust 与 React 数据契约

Extension → Native Host 的 session / cursor / end 消息方向保持不变；`tabId`
继续由 background 补充。session 增加身份状态，并同步提升 Native 协议版本，避免
新旧二进制对同一字段产生不同解释：

```ts
type VideoIdentityStatus = "pending" | "verified" | "failed";

interface NativeSubtitleSessionPayload {
  // 现有字段保持
  identityStatus: VideoIdentityStatus;
}
```

`pending` 只能携带空字幕和 loading，`verified` 才能携带 ready / empty，
`failed` 只能携带身份校验错误。Desktop 内部快照扩展为：

```ts
interface PlayingCandidate {
  sessionId: string;
  tabId: number;
  videoId: string;
  title: string;
}

interface ViewerSnapshot {
  connected: boolean;
  activeSession: SessionState | null;
  playingCandidates: PlayingCandidate[];
  selectedSessionId: string | null;
  selectionRequired: boolean;
}
```

Rust 新增本地选择命令：

```text
select_subtitle_session(sessionId)
```

结构变化时推送完整选择快照，包括 session 新增/结束、可选择候选变化、锁定变化。
高频播放 cursor 仍沿用现有增量事件，避免每 250ms 重发候选列表和完整字幕。

## 错误与降级

- Native Host 未安装或断开仍不得影响 Extension 自身的字幕加载。
- videoId 校验失败是可恢复状态，不写缓存，也不回退到任何未经验证的旧轨道。
- Desktop 收到过期 cursor 时继续按 `sessionId + tabId + videoId` 拒绝。
- Desktop GUI 晚启动时，bridge 缓存可补发各 session 的最新快照；Rust 再基于
  最新 cursor 计算候选，不恢复上次进程的手动锁定。
- 选择遮罩没有候选时自动退出，显示当前保留字幕或等待状态。
- 多个 session 正在播放、但不足两个完成身份验证时，不显示候选遮罩；Desktop
  显示确认中状态，直到候选足够或只剩一个正在播放 session。

## 自动化验证

### Extension

- URL 已变、新播放器响应仍是旧 videoId：阻断轨道、缓存和 `ready`。
- 播放器 videoId 正确、字幕 URL 的 `v` 仍旧：阻断并重试。
- 旧请求在新请求后完成：不能回写状态、写缓存或发 session。
- 切换时第一帧必须是新 videoId 的空 `loading`，不能携带旧字幕。
- `v2` 缓存不再读取；新缓存的 `videoId` / `sourceVideoId` 不匹配时失效。
- 三个身份完全一致后可以命中缓存或正常下载。

### Desktop Rust

- 0 / 1 / 2+ 正在播放 session 及可选择候选的全部状态转换。
- 多个 session 正在播放、但候选仍在验证时不允许选择。
- 首次冲突要求选择，手动选择后保持锁定。
- 第三个候选出现时不重复要求选择。
- 当前视频暂停且没有其他候选时保留字幕。
- 当前视频暂停、另一视频成为唯一候选时自动切换。
- 锁定 session 结束后自动选择唯一候选，或在多候选时重新要求选择。
- 过期、暂停、广告中或不存在的 sessionId 不能被选择。

## 真实链路验收

- 同一标签页连续 SPA 切换多个视频，始终只显示当前 videoId 的字幕。
- 两个标签页同时播放时出现选择遮罩，选择任一视频后 Desktop 正确跟随其 cursor。
- 第三个视频开始播放不打断有效锁定。
- footer 和影院工具条均可主动改选。
- 暂停、继续、关闭标签页、离开 watch 页和广告切换符合状态机。
- Desktop 晚启动、Host 断线重连后候选与字幕一致。
- 全过程不得出现“新 videoId + 旧字幕”，也不得产生新的污染缓存。

## 文档与决策同步

实现时需要同步：

- Extension 内容脚本与字幕加载模块文档；
- Native Messaging 专题；
- ListenUp Desktop 模块文档；
- 测试手册中的多标签页与 SPA 切换回归项；
- 新增一条 ADR，记录“Desktop 负责多视频仲裁、Extension 负责身份验证”的决策，
  并替代当前“最近播放游标自动抢占”的行为。
