# 内容脚本：分层与字幕链路

`apps/extension/src/pages/content/` 是整个仓库最重要、也最容易改坏的地方。改之前先确认要落在哪一层。

## 初始化链路

1. `index.tsx` 检查当前页面是否属于 `youtube.com`
2. 创建 `#__listenup-extension-host`，挂 Shadow Root
3. 以 `style.css?inline` 引入样式，并把所有 `rem` 替换成 `em`（隔离宿主字号，见 [ADR-0001](../../decisions/0001-content-script-shadow-dom.md)）
4. 用 `Provider` + `HeroUIProvider` 渲染 `App`
5. `app.tsx` 监听 `yt-navigate-finish`，路径是 watch 页时渲染 `Subtitles`，并用 `videoId` 作 key 强制重建状态

## 编排层：`components/subtitles.tsx`

它既是容器组件也是主要编排层，负责：

- 启动 `youtubeSDK`，监听主题、广告、带事件原因的播放器状态与会话变化
- 调 `useSubtitles` 加载字幕
- 协调当前字幕索引、自动滚动、循环播放、面板布局
- 承接选词 → `explainTarget`（写入前先暂停视频，避免边听边读错过内容）
- 把字幕快照与播放游标交给 background；播放时 100ms 采样且普通游标最多 100ms 一次，字幕索引变化、
  `seeking` 与最终 `seeked` 强制立即发，避免拖进无字幕间隙或同一句内部时 Desktop 停在旧位置
- 校验 Desktop v4 播放 / 字幕 seek 命令的 session/video/ad 身份，只在当前页面匹配时调用播放器适配层，
  并把成功或失败结果沿原 bridge 返回

## 字幕加载层：`hooks/useSubtitles.ts`

自身不处理字幕细节。字幕、轨道、loading/error 与 `identityStatus` 被原子绑定到
一个 videoId；即使 React effect 还没运行，传入 videoId 变化也会同步返回空的
pending 快照，避免一帧内把旧字幕发布给 Native。

## 领域层：`lib/subtitle-domain/`

| 文件 | 职责 |
|---|---|
| `SubtitleRepository.ts` | 聚合轨道来源、选择策略、下载、解析、缓存、处理 |
| `SubtitleProcessor.ts` | 读清洗 / 合并配置并调用纯处理逻辑 |
| `SubtitleCache.ts` | 基于 `chrome.storage.local` 的配置感知缓存 |
| `SubtitleTransport.ts` | 先直接拉字幕文档，失败再走页面桥接 |
| `errors.ts` | 具名错误，供 UI 映射四态 |
| `subtitleDebug.ts` | `[ListenUp:subtitles]` 前缀的调试日志 |

## 轨道发现层：`lib/captions/`

两个来源：`PlayerResponseCaptionSource`（读 `ytInitialPlayerResponse`）与 `BridgeCaptionSource`（经 `PageBridge` 进页面上下文取）。`SubtitleRepository` 合并去重后按来源能力择优。

原始音轨语言、原语选轨、带 POT 的 JSON3 URL 构建、videoId 三重身份校验与字幕基础类型的
唯一权威在 workspace 包 `@listenup/youtube-core`。`lib/captions/` 保留 YouTube 页面读取和
Extension transport 适配器，并通过兼容 re-export 保持既有相对导入稳定；不得在这里复制共享规则。

默认选轨先读取同一 player response 的 `streamingData.*.audioTrack.audioIsDefault=true`，把
该原始音轨的 BCP 47 语言映射到字幕轨；这不受用户当前选择的自动配音或字幕列表顺序影响。
原始音轨元数据缺失时才回退 `defaultCaptionTrackIndex`，再回退 YouTube 返回的第一条可用
字幕。调用方不能覆盖原文语言；同语言存在人工字幕和 ASR 时才继续优先人工字幕。用户选择
只影响 Desktop 的目标译文语言与原文/译文/双语显示模式。

其中有一段**针对 `pot` 参数缺失的短延迟重试**——刚进视频页时 YouTube 给的 track URL 可能不完整，直接用会拿不到字幕。别把这段当无用重试删掉。

每条轨道还必须携带同一响应的 `videoDetails.videoId`。仓储层会在约五秒重试窗口内
校验页面 session videoId、轨道来源 videoId、字幕 URL 的 `v` 参数三者一致。
未验证轨道不能读写缓存、下载字幕或发布 ready；缓存结构为 v3，并同时保存
`videoId` 与 `sourceVideoId`。规则见 [ADR-0007](../../decisions/0007-desktop-owned-video-session-selection.md)。
Desktop 同步协议 v4 继续发送 `vssId` 与 `isDefault`，并增加播放控制往返，见
[ADR-0008](../../decisions/0008-desktop-sqlite-bilingual-subtitles-and-safe-cli.md)。

## 纯处理层：`lib/subtitles/`

`subtitleParser.ts` 从 `@listenup/youtube-core` 兼容转出 JSON3 / XML / WebVTT 解析；
`subtitleCleaner.ts` 负责去噪，`subtitleMerger.ts` 合并短句与相邻片段，`subtitleConfig.ts`
读取本地处理配置。

这层对 DOM 和 `chrome.*` 零依赖，是最该先补自动化测试的地方。**保持它无副作用。**

## UI 层

- `SubtitleHeader` 整体复制 / 下载 / 设置菜单
- `SubtitleItem` 单条交互 + 选中文字的浮动工具条（Copy / Explain）
- `SubtitleFooter` 录音与循环控制
- `SubtitleStates` loading / error / empty / ad 四态
- `ActiveSegmentPanel` / `PlaybackDivider` / `SubtitlePanelToast` / `SubtitlePanelShell` 辅助交互与外壳
- `ExplainCard` / `AiSettingsCard` 面板内右侧滑出的覆盖层

## 相关

- [Explain 卡片](explain-card.md) · [youtube-sdk](youtube-sdk.md) · [FAQ](faq.md)
- 跨模块：[Native Messaging 字幕同步](../../topics/native-messaging.md)

## Native cursor 调度测试

`hooks/nativeCursorScheduler.ts` 是无 DOM 副作用的调度器；Node 测试固定普通节流、latest-wins、
seek 强制刷新、`currentIndex=-1` 间隙和卸载取消。协议守卫测试同时固定 v4 command/result 的
必填身份字段，以及字幕 seek 的有限非负时间。修改 Native 同步时运行
`pnpm --filter @listenup/extension test`。
