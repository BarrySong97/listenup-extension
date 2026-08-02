# Desktop 双语字幕与 AI CLI — 设计

- 日期：2026-08-01
- 状态：已确认并实施
- 影响模块：Extension、ListenUp Desktop、CLI、Native Messaging、SQLite

## 摘要

ListenUp Desktop 将字幕模型从“当前进程里的一条英语优先字幕快照”升级为“一个视频的
原语字幕轨 + 用户生成的多语言译文”。Extension 负责识别并发送视频本身的原语字幕；
Desktop 将原语字幕持久化到 SQLite，并提供原语单语、译文单语、原语加译文三种显示模式。

译文不从 YouTube 获取，也不由 ListenUp 内置调用任何 AI。ListenUp 提供第一方 CLI，
让用户自己的 AI Agent 读取原语字幕、生成结构化译文并通过经过校验的领域接口写回 SQLite。
CLI 不暴露任意可写 SQL。

AI 可以按语义合并或拆分相邻字幕，但不能跨时间线重排。Desktop 根据译文与原文片段的
显式关联和时间范围同步显示，而不是按两个数组的下标强行配对。

Desktop 前端使用 TanStack React Query 请求 Tauri 字幕查询命令。CLI 写库后不通知
Desktop，也不监测 SQLite、不轮询数据库；用户重新聚焦 Desktop 时由
`refetchOnWindowFocus` 重新请求，用户切换显示模式或目标语言时也会自然发起对应查询。

## 目标

- Extension 默认选择视频本身的字幕语言，而不是固定优先英语。
- 原语字幕、轨道语言、轨道种类和来源 revision 可持久保存。
- 每个视频可以拥有多个目标语言译文，但同一原文 revision、同一目标语言只显示一份当前译文。
- Desktop 支持仅原语、仅译文、原语加译文三种模式。
- 用户自行选择目标译文语言，并记住偏好。
- AI 可以合并或拆分相邻原文字幕，同时保持可靠的播放时间对齐。
- CLI 可以在 Desktop 未运行时独立读取和写入同一个 SQLite 数据库。
- Desktop 重新获得窗口焦点后自动读取 CLI 已提交的最新译文。
- production、development 和显式指定的数据库完全隔离。

## 非目标

- 不在 ListenUp 中集成 OpenAI、Claude 或其他模型调用。
- 不在 CLI 中保存模型 API Key 或翻译提示词。
- 不让 Extension 展示 AI 译文；双语能力只属于 Desktop。
- 不从 YouTube 请求自动翻译轨作为第二语言。
- 不提供任意 SQL 执行入口。
- 不实时监测 SQLite 文件，不使用 `PRAGMA data_version`，不建立 CLI 到 Desktop 的刷新通知。
- 第一版不保留供用户选择的多个同语言译本版本。
- 第一版不实现云同步或跨设备共享。

## 已确认的产品行为

### 原语字幕

“原语”指 YouTube player response 中 `audioIsDefault=true` 的原始音轨对应的字幕语言。
日语视频默认取日语，英语视频默认取英语，不受当前自动配音影响，也不再以
`preferredLanguages: ["en"]` 作为全局优先级。

选轨顺序：

1. 只考虑通过页面、player response 与字幕 URL 三重 videoId 校验的轨道。
2. 优先采用 `streamingData.*.audioTrack.audioIsDefault=true` 标记的原始音轨语言。
3. 同一语言有多条轨时，在身份和请求能力都有效的前提下优先人工字幕，再选 ASR。
4. 原始音轨元数据缺失时回退 `defaultCaptionTrackIndex`，再按第一条可用轨确定原语。
5. 找不到可用字幕时保持现有 empty/error 降级，不伪造原语。

语言代码统一保存为 BCP 47 tag，例如 `ja`、`en`、`zh-CN`；用户可读名称独立保存，
不能用展示名称代替稳定语言标识。

### 显示模式

Desktop 提供：

- `source`：只显示原语字幕；
- `translation`：只显示用户选择的已发布译文；
- `bilingual`：同一语义块先显示原语，再显示所选译文。

用户选择的显示模式和首选目标语言持久化为 Desktop UI 偏好。当前视频没有对应译文时，
Desktop 回退到原语并明确提示“尚无该语言译文”，不显示其他语言冒充结果。

语言选择器只列出当前原文 revision 下已经成功导入的译文语言。选择模式或语言会改变
React Query query key 并请求相应字幕视图。

列表模式中，一个双语视觉块包含聚合后的原文、译文、起始时间和可选语言标签。影院模式
使用上下两层字幕；原语或译文单语模式只保留对应层。

## 数据模型

SQLite 参考现有 Tauri 项目的成熟连接方式：app data 目录、WAL、foreign keys、busy
timeout、版本化 migration。production 与 development 通过不同 Tauri identifier 进入
不同 app data 目录。

### `videos`

保存 `video_id`、标题、最近看到时间、当前原语轨标识等视频级元数据。`video_id` 是
YouTube video ID，不使用临时 tab/session ID 作为持久主键。

### `source_tracks`

保存视频的一条 YouTube 原语轨：

- `track_id`
- `video_id`
- `language_code`
- `display_name`
- `kind`：`manual | asr`
- `vss_id`
- `is_default`
- 当前 revision

轨道身份包含 video ID、`vssId`、语言和种类，避免不同轨道互相覆盖。

### `source_revisions`

每次收到完整、verified、ready、非空的原语字幕时，对轨道身份、处理配置和有序字幕内容
计算 canonical hash。hash 相同则更新最近访问时间；hash 不同则创建新 revision。

revision 让 CLI 写回时能证明 AI 翻译的正是当前那版原文。旧 revision 及其译文不会被
错误套用到新字幕；它们可以保留为过期数据，只有当前 revision 的译文可显示。

### `source_segments`

保存某个 source revision 的有序原文片段：

- 稳定 `segment_id`
- `ordinal`
- `start_time_ms`
- `end_time_ms`
- `text`

Desktop 保存 Extension 已清洗、合并并实际用于播放同步的字幕，而不是另存一套无法与
界面对齐的文本。revision hash 会包含处理配置，因此处理规则变化不会静默复用旧译文。

### `translation_sets`

一份完整译文属于一个 source revision 和一个目标语言：

- `translation_id`
- `source_revision_id`
- `target_language_code`
- `target_display_name`
- 可选 `generator`
- `created_at`、`updated_at`

`source_revision_id + target_language_code` 唯一。再次导入时在事务中原子替换当前译文，
用户不会看到半份新译文或多个同语言版本选择。

### `translation_segments`

保存 AI 重组后的译文语义片段，包括稳定 ID、顺序和译文文本。时间范围由它引用的原文
片段推导，不允许 AI 随意把译文移到无关时间点。

### `translation_segment_sources`

多对多关联译文片段与原文片段。这允许：

- 多条连续原文合并为一条译文；
- 一条原文被连续的多条译文共同引用；
- 译文内部采用符合目标语言的自然语序。

不允许部分交叉的引用区间。多个译文片段可以引用完全相同的原文区间以表达“拆分”，
Desktop 将它们作为同一个时间块内的多行译文显示。

## 翻译文件与校验规则

CLI 接受版本化 JSON 文档，而不是原始 SQL。文档至少包含：

```json
{
  "version": 1,
  "videoId": "abcdefghijk",
  "sourceTrackId": "track-id",
  "sourceRevision": "sha256-hash",
  "targetLanguage": {
    "code": "zh-CN",
    "displayName": "简体中文"
  },
  "generator": "optional-agent-name",
  "segments": [
    {
      "id": "translated-1",
      "sourceSegmentIds": ["source-18", "source-19"],
      "text": "学习日语时，最重要的是"
    }
  ]
}
```

提交前必须验证：

- schema version 受支持；
- video、track 和 source revision 存在且仍是目标原文；
- BCP 47 目标语言有效，且不能与原语相同；
- 所有 source segment ID 存在；
- 单个译文只能引用连续原文；
- 译文片段顺序不能逆转时间线；
- 引用区间不能部分交叉；完全相同区间可用于拆分；
- 每条译文文本非空；
- 完整导入必须覆盖全部原文片段；
- 整份更新在一个事务内完成，任一错误则完全回滚。

AI 如需分批处理长视频，应先在外部文件中组合完整 translation document，最后一次性交给
CLI 校验和提交。第一版不把半成品 draft 写进正式数据库，避免 Desktop 读到部分译文。

## CLI

CLI 是面向用户和 AI Agent 的安全领域接口。它直接打开目标 SQLite、运行相同 migrations、
调用与 Desktop Tauri command 共用的 Rust database/domain 层；不依赖 Desktop 正在运行。

建议命令面：

```bash
listenup info --json
listenup video list --json
listenup subtitle get <video-id> --json
listenup translation list <video-id> --json
listenup translation get <video-id> --language zh-CN --json
listenup translation apply translation.json --dry-run --json
listenup translation apply translation.json --commit --json
listenup translation delete <video-id> --language zh-CN --commit --json
```

全局参数：

- `--db <path>`：显式数据库，用于测试和高级工作流；
- `--env prod|dev`：选择默认 production/development 数据库；缺省为 `prod`；
- `--json`：稳定机器输出。

写命令默认 dry-run，只有 `--commit` 才修改数据库。成功 JSON 包含 `ok`、`data` 和
`warnings`；失败包含稳定错误码和可修正细节。CLI 不接受任意可写 SQL。

CLI 与 Desktop 可同时以 WAL 模式打开数据库。数据库事务是唯一权威；CLI 不发送刷新
消息，也不会因为 Desktop 未运行而产生通知警告。

CLI 作为独立 `listenup` 可执行文件发布，同时和 Desktop 共用 Rust library crate，避免
复制 schema、migration 和翻译校验规则。开发环境由 `--env dev` 选择，不另造一套行为。

## Desktop 数据查询与 React Query

Rust 暴露只读 Tauri command，例如：

```text
get_subtitle_view(videoId, sourceRevision?, targetLanguage?)
list_translation_languages(videoId, sourceRevision?)
```

前端用 TanStack React Query 包装这些 `invoke()` Promise。字幕视图 query key 至少包含：

```text
["subtitle-view", videoId, sourceRevision, displayMode, targetLanguage]
```

查询设置：

- `refetchOnWindowFocus: true`
- 初次 mount 时请求；
- video ID、source revision、显示模式或目标语言改变时因 query key 改变而请求；
- 用户重新选择当前显示项时可以显式 `refetch()`；
- 不设置定时 `refetchInterval`；
- 不监听 SQLite 文件；
- 不接收 CLI 更新事件。

典型流程：用户在终端或 AI 工具中运行 CLI，期间 Desktop 失去焦点；CLI 提交后用户切回
Desktop，React Query 自动 refetch 并得到最新译文。若 Desktop 始终保持焦点，数据会在
下一次重新聚焦、切换语言/模式或重新打开时读取；第一版接受这一行为。

实时 Native session 仍由现有 Tauri event 驱动，不强行塞入 React Query。当前视频、游标、
播放候选和用户锁定继续以 Rust `HostStore` 为权威；SQLite query 只负责给当前 source
revision 补充持久原文和译文视图。

## Native Messaging 协议

协议升级以明确原语轨身份。verified session 的 track 至少补充：

- `languageCode`
- `displayName`
- `kind`
- `vssId`
- `isDefault`

只有 verified、ready、非空 session 才能进入 SQLite。pending、failed、loading、empty 和
cursor 不创建原文 revision，也不能覆盖已有成功数据。三重 videoId 校验和多视频仲裁规则
保持不变。

## 冷启动与优先级

- 无 live session 时，Desktop 可以显示最近访问的视频及其当前 revision/译文缓存。
- 收到新的 live pending/loading session 后，当前视频状态立即优先，不能继续展示旧视频。
- live ready 后持久化原语 revision，再按当前显示偏好查询匹配译文。
- 找不到匹配 revision 的译文时回退原语，并把旧译文视为过期而不是强行显示。
- SQLite 初始化或查询失败时，Native 实时原语字幕继续以内存模式工作，并向 UI 提供明确错误。

## 数据保留

AI 译文属于用户生成数据，不按“缓存最多 200 条”自动清理。旧 source revision 只要仍有
译文引用就保留。第一版通过 CLI 显式删除译文；将来如需空间管理，应增加可预览、可确认的
清理命令，不能静默删除用户译文。

## 错误处理与安全边界

- CLI/GUI 共享参数绑定的领域操作，不拼接用户 SQL。
- migration 失败时停止数据库写入，不能绕过 schema version 继续提交。
- source revision 不匹配返回稳定的 `SOURCE_REVISION_MISMATCH`，提示 AI 重新获取原文。
- 时间线或引用非法返回包含 segment 索引和原因的结构化错误。
- CLI 写入事务失败时旧译文保持完整。
- SQLite 内容和字幕全文不写入生产诊断日志。
- Native bridge 的 stdout 仍专供 Chrome 协议；CLI 是独立可执行入口，不复用 bridge stdout。

## 模块边界

- Extension captions/domain：发现并选择原语轨、继续负责 YouTube 下载和浏览器缓存。
- Native protocol：传递经过验证的原语轨身份和字幕快照。
- Desktop HostStore：实时 session、游标和多视频选择。
- Rust database/domain：migration、原文 revision、翻译校验、查询和事务。
- CLI：参数解析、领域调用与 JSON/text 输出。
- Desktop React Query hooks：通过 Tauri command 读取持久字幕视图。
- Desktop UI：模式/语言选择和单语/双语渲染。

## 验证标准

### 自动化

- Extension 选轨测试：日语默认轨优先日语、英语默认轨优先英语、同语言人工优先 ASR、
  无 default 时不偏向英语。
- Native 协议测试：新 track 字段正确序列化，旧版本被明确拒绝。
- SQLite migration 和 repository 测试：原文 upsert、相同 revision 去重、新 revision、
  多语言译文、原子替换和 prod/dev 路径隔离。
- 翻译校验测试：合法合并、合法拆分、非连续引用、交叉引用、逆序、缺失 segment、
  revision 过期、覆盖不完整和事务回滚。
- CLI 集成测试：临时 SQLite 上的读、dry-run、commit、JSON 错误和退出码。
- Desktop 查询测试：source/translation/bilingual 视图和无译文回退。
- React Query 测试：窗口 focus 后 refetch，模式/语言变化触发新 query，不存在轮询。

### 手工回归

1. 打开日语、英语视频，确认 Extension 和 Desktop 分别选择对应原语。
2. CLI 读取当前视频原文，交给外部 AI 生成含合并/拆分的中文翻译文件。
3. dry-run 能报告变更且不写库，commit 后数据库出现完整译文。
4. 切回 Desktop，focus 后自动显示新增语言；不重启应用。
5. 验证仅原语、仅中文、日语加中文以及影院模式。
6. 保持 Desktop 聚焦时提交另一语言，确认不会后台轮询；重新聚焦或选择该语言时才读取。
7. 修改 source revision 后旧译文不再显示，并返回需要重新翻译的状态。
8. Desktop 关闭时 CLI 仍能写入，之后启动能读到结果。
9. production 和 development 数据库、CLI `--env`、Native Host 与 socket 不串线。
10. Host/SQLite/CLI 任一侧失败均不破坏 Extension 自身字幕面板。

## 已否决方案

- 每种语言存一个整份 JSON blob：无法用数据库约束片段引用、连续性和 revision。
- AI 译文强制与原文逐行一一对应：无法自然处理不同语言断句和语序。
- Desktop 监测 SQLite 文件或 `PRAGMA data_version`：产品流程不需要持续后台刷新。
- 定时轮询 revision：无必要的后台请求。
- CLI 通过 socket 通知 Desktop 再 invalidate React Query：比“重新聚焦时 refetch”复杂，
  当前需求不需要即时推送。
- Desktop 本地服务代理所有 CLI 操作：会让 CLI 依赖 Desktop 运行，不符合独立自动化接口目标。
