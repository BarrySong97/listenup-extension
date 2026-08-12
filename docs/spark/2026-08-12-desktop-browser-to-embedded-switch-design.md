# Desktop 浏览器来源切换到自播 — 设计

- 日期：2026-08-12
- 状态：已实施，待用户验收
- Plane：LISTENUP-11
- 依赖设计：[Desktop 内嵌 YouTube 播放与字幕通信](2026-08-10-desktop-embedded-youtube-player-design.md)

## 背景

Desktop 已同时支持浏览器字幕来源 `BrowserSource` 和窗口内自播来源 `EmbeddedSource`。当前只有
无权威来源的空态提供 YouTube 链接输入；一旦浏览器插件已经接入，用户无法从现有字幕界面主动
切换到 Desktop 自播，只能先退出或等待来源清空。

本设计为 `BrowserSource` 活跃态补齐两条主动切换入口：标题栏中的显式“切换”按钮，以及用户将
Desktop 激活后、在非输入区域执行粘贴手势时的有效 YouTube 链接识别。两条入口共用同一个确认
Modal 和既有 `start_embedded_playback` / `SourceCoordinator` 迁移，不创建新窗口，也不引入第二套
播放器或字幕组件。

## 已确认的产品决定

| 主题 | 决定 |
|---|---|
| 显式入口 | `BrowserSource` 活跃时，用“切换”占据当前标题栏“检查更新”的位置 |
| 更新入口 | “检查更新”移动到 Footer 左下角；现有更新状态与安装提示能力保持不变 |
| 快捷入口 | Desktop 已成为当前键盘应用且焦点不在可编辑元素时，处理标准 `paste` 事件 |
| 激活条件 | 只有用户明确点击 Desktop 才激活应用；悬停、置顶、程序显示窗口都不读取剪贴板 |
| 输入框优先 | `input`、`textarea`、`contenteditable` 内保持普通粘贴，不弹来源切换 Modal |
| 剪贴板边界 | 只读取本次 `ClipboardEvent` 的 `text/plain`；不轮询、不缓存、不申请主动读取权限 |
| 两条入口 | 点击“切换”打开空输入框；非输入区域粘贴有效链接时打开同一 Modal 并预填链接 |
| 无效粘贴 | 不弹 Modal；Footer 上方显示约 2 秒的“未识别到 YouTube 视频链接”轻提示 |
| 确认动作 | 只有点击“切换并播放”后才建立 Embedded 锁并开始自播；取消前 BrowserSource 完全不变 |
| 浏览器处理 | 确认后可尽力请求暂停浏览器，但不等待、不提示结果；进入自播后彻底忽略浏览器行为 |
| 退出自播 | 沿用既有规则：退出后保持空态，等待下一次新的浏览器播放世代接入 |
| 窗口与样式 | 原窗口原地切换，尺寸、背景、透明度和最窄宽度不变；复用现有 Desktop 组件与 token |

## 目标

- 让浏览器字幕已经接入的用户不必先清空来源，就能主动转到 Desktop 内播放。
- 让“点按钮后粘贴”和“直接粘贴链接”最终进入同一个可审计的确认流程。
- 保持剪贴板读取严格绑定用户的粘贴手势，不扩大 Tauri 或系统权限。
- 复用既有双来源仲裁和同窗播放器，避免来源、字幕和 UI 出现两套实现。
- 一旦自播取得权威，浏览器端后续事件不得产生 UI、提示、SQLite 或控制副作用。

## 非目标

- 不注册系统级或跨应用的全局 `Command+V` / `Ctrl+V` 快捷键。
- 不在窗口聚焦时主动读取、轮询或分析剪贴板。
- 不监听复制操作，也不处理非 YouTube 文本、图片或文件粘贴。
- 不自动绕过确认 Modal，不根据剪贴板内容直接启动网络请求或播放。
- 不改变浏览器 Extension 权限，不增加 Cookie 读取或复用能力。
- 不在影院模式中增加常驻工具条；影院态仍可使用标准粘贴入口或返回列表态操作。
- 不改变 Embedded 播放中的换链接、重新加载、Cookie 和退出操作。

## 用户体验

### 1. BrowserSource 活跃态

列表态标题栏的右侧操作区保持现有尺寸和样式，但把当前“检查更新”图标按钮替换为“切换”按钮。
“切换”使用来源切换语义的图标与 tooltip，不改变其余影院模式、App 模式和收起按钮的位置。

Footer 从当前单一右对齐布局改为两端布局：

- 左下角：复用现有更新按钮的 loading、disabled、tooltip 和点击逻辑，显示“检查更新”入口。
- 右下角：继续显示当前语义块数量。

更新可用、下载、安装和错误仍由现有 `UpdateNotice` 展示；移动入口不改变 updater 状态机。
开发构建继续遵守当前 updater 禁用规则。

### 2. 点击“切换”

点击后在当前 Desktop layout 上打开来源切换 Modal：

- 标题：“切换到 Desktop 播放”；
- 一个空的 YouTube 链接输入框，自动获得文本焦点；
- 次按钮：“取消”；
- 主按钮：“切换并播放”。

Modal 复用现有 Desktop overlay、`DesktopTextField`、`DesktopButton` 和 design token。打开 Modal
不会暂停浏览器、清除字幕或改变窗口尺寸。用户取消、按 `Esc` 或关闭 Modal 后回到原 BrowserSource。

### 3. 在 Desktop 上直接粘贴

Desktop 只有在用户明确点击后才成为当前键盘应用。应用激活且粘贴目标不是可编辑元素时：

1. React 根节点接收标准 `paste` 事件。
2. 从事件本身读取 `text/plain`，使用现有 `normalizeYoutubeWatchUrl` 校验和规范化。
3. 有效链接：阻止无意义的默认粘贴，打开与按钮相同的 Modal，并预填规范化链接。
4. 无效链接：不打开 Modal，只显示约 2 秒的轻提示；原 BrowserSource 不变。

可编辑元素包括 `input`、`textarea`、`select` 和 `contenteditable`。这些目标上的粘贴永远优先走
正常文本编辑，根节点不得拦截或重复弹 Modal。

macOS 使用平台标准 `Command+V`；其他平台若复用该界面则使用其标准 `Ctrl+V`。本设计识别的是
WebView 发出的粘贴事件，而不是抢占系统快捷键，因此不会影响其他应用的粘贴。

### 4. 确认切换

用户点击“切换并播放”后：

1. 前端再次校验链接，Rust 按既有安全门独立复验。
2. 主按钮进入 loading 并禁止重复提交。
3. `SourceCoordinator` 立即进入 `EnteringEmbedded` 并建立 Embedded 权威锁。
4. 系统可以向进入前的浏览器 session 发送一次尽力而为的暂停请求，但不等待或展示结果。
5. 当前主窗口原地进入既有 Embedded 播放布局。

从第 3 步开始，浏览器已经不再是用户可见权威。它之后播放、暂停、换视频、关闭标签、断开插件，
以及暂停命令成功、失败或超时，都不显示提示，也不改变 Desktop 自播流程。

### 5. 自播期间与退出

`EnteringEmbedded`、`EmbeddedActive` 和 `EmbeddedRecovering` 都持有 Embedded 锁。锁定期间浏览器
消息只允许经过协议和身份安全校验后进入必要的影子状态；不得：

- 改写 viewer 或当前字幕；
- 写入当前权威来源的 SQLite 记录；
- 显示多视频选择器、断连提示或浏览器暂停失败提示；
- 改变播放、暂停、seek 的控制目标；
- 抢占或隐式释放 Embedded 锁。

Desktop 自身启动或字幕加载失败时，只展示 Embedded 自身的错误与重试能力，不提及浏览器状态。
显式退出自播继续沿用 playback epoch 隔离：窗口回到空态，不恢复旧浏览器视频；只有退出后产生的
新浏览器播放世代才能重新接入。

## 交互状态

```text
BrowserActive
├─ 点击“切换” ───────────────→ SwitchModal(empty)
├─ 非输入区域 paste(有效 URL) → SwitchModal(prefilled)
├─ 非输入区域 paste(无效内容) → BrowserActive + transient notice
└─ 输入区域 paste ───────────→ BrowserActive + normal text editing

SwitchModal
├─ 取消 / Esc / 关闭 ─────────→ BrowserActive
├─ 校验失败 ─────────────────→ SwitchModal(field error)
└─ 确认有效 URL ─────────────→ EnteringEmbedded

EnteringEmbedded
├─ player ready ─────────────→ EmbeddedActive
└─ Desktop 启动失败 ─────────→ EmbeddedRecovering

EmbeddedActive / EmbeddedRecovering
├─ 任意 BrowserSource 事件 ──→ ignore for product behavior
└─ 显式退出 ─────────────────→ Empty + playback epoch barrier
```

`SwitchModal` 是 React UI 状态，不进入 Rust 来源状态机。确认前没有权威迁移；确认后所有来源决定
仍由 `SourceCoordinator` 完成，React 不自行修改 viewer 或伪造 Embedded session。

## 技术设计

### 粘贴手势与隐私边界

推荐实现是根节点 `paste` listener，而不是 Tauri clipboard read command：

- 数据只来自 `ClipboardEvent.clipboardData.getData("text/plain")`；
- listener 先检查 `document.activeElement` / event target 是否可编辑；
- 只有 BrowserSource 活跃且当前没有来源切换 Modal 时才尝试识别；
- 内容只保存在 Modal 的临时 React state，取消或关闭后立即释放；
- 原始内容不进入日志、SQLite、Tauri event、telemetry 或错误对象。

Tauri capability 保持只有现有的 `clipboard-manager:allow-write-text`，不得为了此功能增加
`clipboard-manager:allow-read-text`。实现时扩展环境 sensor，锁定“无 clipboard read 权限、无全局
粘贴快捷键注册”这两个边界，防止以后退化为后台读取。

### macOS 焦点

现有 `nonactivatingPanel` 保留，窗口仅显示、置顶或鼠标悬停不会激活应用。用户明确点击 Desktop
内容时，复用精确授权的 AppKit 激活路径，使 ListenUp 成为当前键盘应用并把 main panel 保持为
key window；随后 WebView 才能收到系统粘贴事件。

这次激活语义从“只有文本输入控件激活”扩展到“用户明确点击 Desktop 后激活”，但不能在程序化
show、tray 重显、浏览器 session 到达或 hover 时调用。实现必须手工回归列表态、影院态、菜单栏
模式和全屏 Space，确认未出现无用户手势的抢焦点。

### 复用与组件边界

- `App.tsx`：组合 header / footer 入口、Modal 可见状态、根级 paste 编排和提示。
- `embeddedPlayback.ts`：继续作为 YouTube URL 规范化的唯一前端安全门。
- 新的来源切换 Modal：只负责表单和确认，不直接调用播放器或改 viewer。
- `DesktopTextField` / `DesktopButton` / `DesktopIconButton`：继续提供统一的焦点与视觉行为。
- `start_embedded_playback`：继续作为 Rust 入口，不新增旁路 command。
- `SourceCoordinator`：继续负责 BrowserActive → EnteringEmbedded → EmbeddedActive/Recovering。

如果 `App.tsx` 的 paste 和 Modal 状态使文件职责继续膨胀，实施时应抽出单一职责 hook / component，
但不得为此复制 URL 校验或来源迁移逻辑。

## 错误与反馈

| 场景 | 用户反馈 | 来源结果 |
|---|---|---|
| 非输入区域粘贴无效内容 | 约 2 秒轻提示，不弹 Modal | BrowserSource 不变 |
| Modal 内链接无效 | 输入框下方就地错误 | BrowserSource 不变 |
| 用户取消 | 无错误提示 | BrowserSource 不变 |
| Browser 暂停失败 / 超时 / 断开 | 无提示 | 继续 Embedded 流程 |
| Desktop player 启动失败 | Embedded 错误和重试入口 | 保持 Embedded 锁 |
| Desktop 字幕读取失败 | 既有 Embedded 字幕错误 | 视频与 Embedded 权威不变 |

任何失败都不得把用户刚粘贴的非 URL 文本写入日志，也不得以浏览器状态提示打断已经确认的
Desktop 自播。

## 可访问性与键盘行为

- “切换”和“检查更新”保留可见 tooltip、明确的 `aria-label` 和现有焦点样式。
- Modal 使用 `role="dialog"` / `aria-modal="true"`，标题与字段错误可被辅助技术关联。
- 打开 Modal 后焦点进入链接输入框；关闭后焦点回到触发按钮，快捷粘贴入口则回到窗口根上下文。
- `Esc` 仅在未提交时关闭；提交 loading 期间避免重复关闭造成来源状态不确定。
- 输入框内 `Command+A/C/X/V` 始终按标准文本编辑工作，不被根级 listener 拦截。

## 验收标准

- BrowserSource 活跃的列表态中，标题栏原更新位置显示“切换”，Footer 左下角显示“检查更新”。
- 点击“切换”打开空链接 Modal；直接粘贴有效链接打开同一 Modal并预填规范化链接。
- Desktop 未被用户激活时不读取剪贴板、不弹 Modal，也不影响前一个应用的粘贴。
- 输入框、Cookie 文本域和其他可编辑元素中的粘贴保持普通编辑行为。
- 无效内容不弹 Modal，只出现短暂提示；剪贴板文本不被持久化或记录。
- 取消确认不会暂停、清空或更换 BrowserSource。
- 确认后主窗口不改变尺寸、背景、透明度或最小宽度，并进入既有同窗播放器布局。
- 进入 Embedded 锁后，浏览器的播放、换视频、断开和暂停结果均不产生任何产品提示或来源抢占。
- 退出后保持空态，旧浏览器 cursor 不能立刻重新接入。
- Tauri / Extension 不新增 clipboard read、cookies 或全局快捷键权限。
- `node scripts/check-docs.mjs`、Desktop 构建、环境 sensor 和 `docs/testing.md` 中对应的真实 macOS
  手工回归全部通过。

## 实施阶段必须验证的场景

1. BrowserSource 活跃、浏览器标签仍在播放：按钮切换与直接粘贴都能进入自播，浏览器结果无提示。
2. 浏览器标签已关闭或 Extension 已断开：确认后仍只按 Desktop 结果反馈。
3. Desktop 未激活、仅悬停或置顶：`Command+V` 继续属于原应用。
4. Desktop 点击激活后，在字幕区、header 和 footer 上粘贴有效 / 无效内容。
5. URL 输入框、Cookie 文本域内执行输入、删除、`Command+A/C/X/V`，不触发来源 Modal。
6. 列表态、影院态、菜单栏模式、普通窗口与原生全屏 Space 中的激活和粘贴行为。
7. Modal 取消、`Esc`、字段错误、重复确认、Embedded 启动失败与重试。
8. 自播期间浏览器播放、暂停、换视频、关闭、断连与重新连接均不改变当前界面或显示提示。
9. 退出自播后保持空态，直到新的浏览器播放世代到来。
10. updater 从 Footer 触发后的 checking、current、available、download、install 和 error 状态。

## 与既有设计的关系

本文增量细化并覆盖 2026-08-10 Embedded Player 设计中以下两点：

- BrowserSource 活跃态不再只有隐式粘贴描述，而是明确为标题栏按钮与手势粘贴两条入口。
- 浏览器暂停失败或超时不再展示“浏览器可能仍在播放”的警告；一旦确认进入 Embedded 流程，
  浏览器结果不产生任何用户提示。

其余同窗 iframe、字幕 transport、Cookie、来源锁、退出空态和 playback epoch 隔离规则保持不变。
