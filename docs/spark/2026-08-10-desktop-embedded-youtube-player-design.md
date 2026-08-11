# Desktop 内嵌 YouTube 播放与字幕通信 — 设计

- 日期：2026-08-10
- 状态：已确认并实施；2026-08-10 现场验收修订为同窗官方 iframe
- Plane：LISTENUP-7
- 前置调研：[Desktop 内嵌 YouTube 与字幕通信 — 技术调研](../plans/2026-08-10-desktop-embedded-youtube-research.md)

## 背景

ListenUp 当前把 Chrome Extension 作为 YouTube 播放与字幕抓取来源，Desktop 只显示同步后的
字幕并反向发送播放、暂停和 seek 命令。该路径能复用浏览器登录态和完整 YouTube 页面能力，
但用户为了看一个视频仍需打开浏览器。

本设计在不替换现有浏览器链路的前提下，为 Desktop 增加第二种来源：用户粘贴一个 YouTube
watch 链接后，直接在 Desktop 内播放视频，并在同一复合窗口中显示完整字幕。浏览器连接仍是
默认和稳定路径，Desktop 自播是用户显式进入、显式退出的受限模式。

本机调研已验证：macOS WKWebView 可以在未登录状态加载公开视频、读取播放器字幕轨并取得
完整 JSON3 字幕；无持久 Cookie 的样本也能看到 1080p、1440p 和 4K 档位。该证据只证明公开
样本可行，不等于承诺登录、受限内容或所有视频均可播放。具体平台证据与外部来源见前置调研。

## 已确认的产品决定

| 主题 | 决定 |
|---|---|
| 总体方案 | 采用双来源架构 A：保留 BrowserSource，新增 EmbeddedSource，由 Desktop 统一仲裁 |
| 播放界面 | 当前主窗口原地切换为“上方官方 YouTube iframe、下方字幕列表”，不得新开窗口 |
| 视觉继承 | 保留原 Desktop layout、标题栏、按钮、字幕组件、底栏和 design token，只增加视频行 |
| 播放容器 | 使用 `/embed/<videoId>` + IFrame Player API，不加载完整 watch 页面 |
| 字幕通道 | 与 iframe 解耦，由 Desktop 受限后端 transport 获取，youtube-core 选轨与解析 |
| 空状态入口 | 浏览器自动连接为主入口；分隔线“或者”下面提供 YouTube 链接输入 |
| 浏览器抢占 | 一旦进入 Desktop 自播，浏览器事件不接管、不提示、不弹选择器 |
| 进入自播 | 若浏览器正在播放，先请求暂停；失败仍进入自播并显示非阻断警告 |
| 退出自播 | 回到双入口空状态，不恢复退出前正在播放的浏览器视频 |
| 重新接入 | 只接受退出之后新发生的手动播放、换视频播放或 YouTube 自动连播 |
| 首版范围 | 只支持单个粘贴链接，不做首页、搜索、推荐、历史或内嵌站内浏览 |
| 画质 | 保留 YouTube 原生播放器与 Quality 菜单，不强制 4K，也不人为限制清晰度 |
| Cookie 来源 | 只允许用户在 Desktop 设置中手动粘贴完整键值串；不读取或复用浏览器 Cookie |
| Cookie 保存 | 跨重启保存到 macOS Keychain，支持替换和清除 |
| Extension 审核面 | Extension 不申请 `cookies` 权限，不读取、传输或保存 Cookie |

## 目标

- 让用户不打开浏览器也能通过一个 YouTube watch 链接观看公开视频并使用 ListenUp 字幕。
- 让 BrowserSource 与 EmbeddedSource 共用字幕展示、SQLite、双语、播放控制和 seek 能力。
- 保证 Desktop 自播期间来源权威稳定，浏览器事件不能造成字幕或控制对象跳变。
- 保持现有 Chrome Extension、Native Messaging、production/DEV 隔离和多视频仲裁行为不回归。
- 把远程 YouTube 页面、Cookie 和本地 Tauri 权限分隔在可审计的安全边界内。

## 非目标

- 不做完整 YouTube 浏览器：首页、搜索、推荐流、历史、频道浏览和任意站内导航均不在首版。
- 不承诺 Google 登录、Premium、会员、年龄限制或创作者禁止嵌入的视频可播放。
- 不复制 Chrome、Safari 或系统浏览器的 Cookie，也不要求 Extension 新增 Cookie 权限。
- 不自造清晰度强制算法；最终清晰度仍由 YouTube、网络、播放器尺寸和 WebKit 能力决定。
- 不替换 Chrome Extension 主路径，不让 Desktop 自播成为浏览器字幕同步的前置条件。
- 不同时显示或混音 BrowserSource 与 EmbeddedSource；任一时刻只有一个权威来源。
- 不在本设计阶段实现代码或拆解实施任务；后续实施计划另行编写。

## 用户体验与界面状态

### 1. 双入口空状态

没有权威来源时，现有 Desktop 字幕面板显示双入口空状态：

1. 上半部分保留浏览器连接提示，说明打开带 ListenUp Extension 的 YouTube 视频后会自动接入。
2. 中间使用“或者”分隔。
3. 下半部分提供单行 YouTube 链接输入和“在 Desktop 播放”按钮。
4. Cookie 不放在主路径；通过设置入口进入独立的 Cookie 管理页。

无效链接只在输入框附近显示错误。此时不暂停浏览器、不创建 EmbeddedSource，也不改变当前
来源锁。

### 2. BrowserSource 活跃

浏览器接入时继续使用现有轻量字幕窗口，包括列表、影院和菜单栏形态。Desktop 不复制浏览器
中的视频画面，既有多视频选择和播放控制行为保持不变。

用户在 BrowserSource 活跃时粘贴有效链接，系统进入 `EnteringEmbedded`：先锁住来源切换，再向
当前浏览器 session 发出暂停命令。命令成功、失败或超时后都继续打开 Desktop 自播；失败或超时
只显示“浏览器可能仍在播放，请手动暂停”的轻提示。

### 3. EmbeddedSource 活跃

现有 Desktop 主窗口原地扩展为播放器布局：

- 上方是未经覆盖的完整 YouTube 播放器，保留播放、音量、倍速、字幕和 Quality 等原生控件。
- 下方是 ListenUp 字幕区，复用原语、译文、双语、当前句、自动滚动和字幕点击 seek。
- 顶部提供当前视频标题、换链接入口、Cookie 设置入口和“退出 Desktop 播放”。
- 载入新有效链接会结束旧 Embedded session，并在同一窗口创建新的 Embedded session。
- 视频无字幕时播放器继续工作，字幕区显示“该视频没有可用字幕”。

进入自播后保留同一个 `main` WebView 和窗口，只切换 React 布局且不改变用户当前窗口尺寸；上方 iframe 使用
官方 IFrame Player API，下方复用现有字幕组件。退出后销毁 iframe、恢复双入口空态和原来的
desktop/menubar、list/cinema 偏好。

### 4. 退出后的等待状态

退出 Desktop 自播按以下顺序执行：

1. 停止并销毁 YouTube WebView，确保没有后台声音。
2. 清除 Embedded session 和控制路由。
3. 建立浏览器重接屏障。
4. 显示双入口空状态。

系统不主动恢复进入自播前的浏览器视频，也不会因为旧浏览器 cursor 继续到达而立即重新接入。
只有退出后出现新的播放世代，才允许 BrowserSource 再次成为权威来源。

### 5. 受限内容状态

视频因 Cookie、登录或内容限制无法播放时，Player 保持当前链接并提供：

- “更新 Cookie”；
- “更换链接”；
- “退出 Desktop 播放”。

系统不自动打开浏览器，不声称手动 Cookie 一定能解决限制，也不因一次失败自动删除已保存值。

## 窗口与信任边界

Desktop 自播使用本地可信页面与浏览器标准跨源 iframe 边界：

```text
main NSPanel / 本地可信 React
├─ YouTube iframe（/embed/<videoId>，标准跨源边界）
│  └─ IFrame API：ready/state/error/time/play/pause/seek
├─ ListenUp 字幕与设置 UI
└─ 受限 Rust transport
   ├─ watch player response（只读，videoId 绑定）
   └─ api/timedtext（YouTube host/path/videoId 白名单）
```

iframe 不拥有 Tauri capability，也无法访问 Keychain；只有本地 `main` 能调用精确授权的字幕
transport 和 Cookie commands。原始 Cookie 不进入 React、iframe、snapshot、SQLite 或 Extension。

## 双来源架构

```text
Chrome + Extension
  → Native Messaging / bridgeId
  → BrowserSource ───────────────┐
                                 │
YouTube child WebView            ├→ SourceCoordinator → HostStore
  → validated event ingress      │                        ├→ SQLite
  → EmbeddedSource ──────────────┘                        └→ React viewer

Desktop play / pause / seek
  → SourceCoordinator
      ├→ BrowserSource：按 bridgeId + sessionId + videoId 路由回 Extension
      └→ EmbeddedSource：按 player sourceId + sessionId + videoId 路由到 WebView
```

### SourceCoordinator

`SourceCoordinator` 是来源权威和来源切换的唯一入口，职责包括：

- 维护 `Empty`、`BrowserActive`、`EnteringEmbedded`、`EmbeddedActive` 和
  `EmbeddedRecovering` 状态。
- 管理 Embedded 锁和浏览器重接屏障。
- 把当前权威来源的事件归一化后交给 `HostStore`。
- 把播放、暂停和 seek 只路由回产生当前 session 的来源。
- 在锁定期间隔离 BrowserSource 的 UI、SQLite 和控制副作用。

它不负责抓字幕、渲染 UI 或保存 Cookie。React 不自行推导来源权威，`HostStore` 也不根据最新
cursor 抢占一个已锁定的 EmbeddedSource。

### 统一来源标识

两种来源都归一化为：

```ts
type SourceKind = "browser" | "embedded";

interface SourceRef {
  kind: SourceKind;
  sourceId: string;
  sessionId: string;
  videoId: string;
}
```

BrowserSource 的 `sourceId` 对应 GUI 内部 bridge 身份，不以 `tabId` 代替；EmbeddedSource 的
`sourceId` 每次创建 Player WebView 时重新生成。任何 command result、session、cursor 和 seek
结果必须同时命中四个字段，迟到结果不得写入新 session。

## 来源状态机与浏览器重接屏障

### 进入 EmbeddedSource

1. 本地 UI 解析并验证 URL，只接受 `https://www.youtube.com/watch?v=<videoId>` 以及可确定转换为
   该格式的 `youtu.be/<videoId>` 链接；最终导航固定为规范化 watch URL。
2. 校验成功后，`SourceCoordinator` 原子进入 `EnteringEmbedded` 并建立 Embedded 锁。
3. 若当前存在可控 BrowserSource，向其发送明确的 `pause`，等待成功、失败或两秒超时。
4. 无论暂停结果如何，都创建 Player；失败或超时通过本地 UI 警告，不释放锁。
5. EmbeddedSource 首个有效 session 到达后进入 `EmbeddedActive`。

URL 校验必须发生在加锁之前，避免输入错误影响正在使用的 BrowserSource。

### 锁定期间的 BrowserSource

浏览器消息仍需经过协议解析，以便拒绝畸形输入和记录重接所需的播放世代，但不得：

- 改变当前 viewer；
- 写入由本次 Embedded 会话触发的 UI 状态；
- 触发多视频选择器或来源提示；
- 成为 Desktop command 的路由目标；
- 解除 Embedded 锁。

这里的“忽略”是忽略来源权威和产品副作用，不是跳过安全校验。

### 播放世代

为区分“旧视频仍在发送 cursor”和“退出后真的发生了新播放”，BrowserSource 为每个浏览器
session 维护 `playbackEpoch`：

- 从暂停变为播放时递增；
- SPA 切换到新 videoId 后首次播放时递增；
- YouTube 自动连播产生新视频并开始播放时递增；
- 周期 cursor、字幕 revision 更新和同一播放过程中的 seek 不递增。

Desktop 在进入和退出 EmbeddedSource 时把已观察到的 `(sourceId, sessionId, videoId,
playbackEpoch)` 放入隔离集合。退出后仅当收到一个不在隔离集合中的播放世代，才允许切到
`BrowserActive`。因此外部视频在锁定期间一直播放，也不会靠退出后的下一条周期 cursor 抢回。

`playbackEpoch` 是 BrowserSource 适配层的来源事件元数据，不改变字幕 revision 身份。若协议需要
跨 Extension 传输该字段，必须升级版本并同时更新 TypeScript 守卫、Rust serde 与 DEV/production
构建；不能用时间戳猜测新播放。

### EmbeddedSource 故障

字幕采集脚本或 WebView 崩溃时进入 `EmbeddedRecovering`，继续保持 Embedded 锁。用户可以重新
加载当前链接或显式退出；系统不能因为内部故障悄悄回退到浏览器来源。

## EmbeddedSource 字幕与控制链路

### 采集适配层

远程页面的 document-start 初始化脚本只运行在主 frame，并负责：

- 发现 `#movie_player`、`playerResponse`、当前原始音轨和字幕轨；
- 产生绑定 `videoId` 的 loading、ready、empty、error 和 ad session；
- 产生播放 cursor、暂停状态和当前字幕索引；
- 接受限定为 play、pause 和 seek 的控制请求；
- 返回带 commandId、sourceId、sessionId 和 videoId 的结果。

页面脚本不直接访问 SQLite、Keychain、剪贴板、更新器、文件系统或通用 Tauri IPC。

### 可复用核心

现有 Extension 中下列平台无关能力抽成可被两个适配层调用的纯核心：

- URL、playerResponse 与字幕 track 的 videoId 三重身份校验；
- 原始音轨识别和字幕轨优先级；
- 带 POT 的 request URL 选择及字幕 URL 构建；
- JSON3 解析、清洗、合并和当前句映射；
- cursor 节流与关键事件立即发送规则。

Chrome 的 `postMessage` / `chrome.runtime` / Native Messaging 与 WKWebView 的受限消息入口继续
留在各自薄适配层，不能把浏览器 API 引入纯字幕核心。

### HostStore 与 SQLite

EmbeddedSource 产生与现有 viewer 等价的 session/cursor。只有满足现有规则的
`identityStatus=verified`、`status=ready` 且字幕非空的 session 才能写 SQLite；loading、empty、
error、ad 和 cursor 不创建空 revision。

原字幕、译文和 revision 数据模型继续按 video/track 身份去重，不因来源不同复制一份。来源路由
身份只在运行时存在，不进入翻译文档契约。实时 Embedded session 优先显示；退出后按已确认的
空状态规则等待新来源，不立即用 SQLite 最近缓存盖住空状态。

### 播放质量

Player 保留 YouTube 原生控件和 Quality 菜单，并给视频区域足够尺寸。ListenUp 不调用私有接口
强制画质，也不承诺所有视频达到固定分辨率。验收样本在来源、网络和 WebKit 支持时应显示
1080p 或更高选项；自适应播放暂时选择较低档不视为账号限制。首版不以 4K 作为通过条件。

## Cookie 设计

### 用户输入

Cookie 设置页提供一个密码型多行输入，只接受用户手动粘贴的完整键值串：

```text
name=value; name2=value2; name3=value3
```

不接受 cookies.txt 文件，不读取浏览器存储，也不把单个固定 Cookie key 设计成唯一输入。解析规则：

- 以分号分段，每段按第一个 `=` 分成 key 与 value，value 中后续的 `=` 原样保留；
- 去除段两侧空白，空段忽略；key 为空、包含控制字符或不符合 Cookie token 时整次拒绝；
- 重复 key 以后出现的值为准；
- 总输入上限 64 KiB，最多 180 个键；超过限制整次拒绝；
- 不接受 Domain、Path、Expires 等属性，目标 origin、path 和 secure 属性由 Desktop 固定；
- 只写入 YouTube 播放 origin，不把同一字符串扩散到任意 Google 域名。

保存成功后立即清空输入框，只显示“已保存”状态，不回显 Cookie 名称、数量或值。更新时粘贴一
整串新值原子替换旧值；清除操作同时删除 Keychain 项和当前 Player WebView 的对应 Cookie。

### CookieVault

本地受信任 UI 通过专用 Tauri command 把原始字符串交给 `CookieVault`。`CookieVault` 负责：

- 使用按 production/DEV bundle 区分的 service/account 名保存到 macOS Keychain；
- 启动 Player 前读取、解析并注入 WebKit Cookie store；
- 原子替换和明确清除；
- 对外只返回 `missing`、`saved`、`applied` 或 `failed`，不返回原值。

Cookie 不进入 SQLite、偏好 JSON、日志、崩溃 payload、分析服务或 Extension 通道。错误信息只能
包含失败阶段和错误类别，不能包含 key/value。WebView 或视频返回疑似认证失败时保留 Keychain
原值并提示更新，不因单次错误自动删除。

保存 Cookie 只提高部分内容可播放的可能性，不构成对登录、受限内容或长期有效性的产品承诺。

## 远程 WebView 安全边界

### 权限

- `youtube` WebView 默认零通用 Tauri capability。
- 不授予 clipboard、updater、process、shell、文件系统、窗口管理或通用 invoke 权限。
- Cookie 管理只允许本地 `player-ui` 调用，远程页面没有读取、保存、替换或清除入口。
- Embedded 事件入口使用独立原生 handler，不把任意 command 名或参数透传给 Tauri。

### 导航

- 顶层导航仅允许规范化的 YouTube watch URL 和播放器运行必需的同站跳转。
- 非 YouTube 顶层导航、popup、新窗口和下载全部拒绝；首版不自动交给系统浏览器。
- 不支持从播放器点击进入首页、推荐、频道、账户或 OAuth 登录流程。
- 初始化脚本只注入主 frame，广告和第三方 iframe 不能直接调用 Embedded 事件入口。

### 消息校验与限流

事件入口只接受 `session`、`cursor` 和 `commandResult` 三类消息，并执行：

- 精确 schema、协议版本、sourceId、sessionId 和 videoId 校验；videoId 必须符合 11 字符规则；
- session 单条上限 4 MiB，cursor/result 单条上限 8 KiB；
- cursor 稳态最多 10 次/秒，允许 20 条瞬时突发；session 最多 2 次/秒；
- 超限、错来源、错视频、未知字段组合和迟到 commandId 直接丢弃并记录不含正文的计数诊断；
- 连续超限时暂停该 WebView 的事件接收并进入可恢复错误状态，不能拖垮 GUI。

字幕全文不得进入生产日志。诊断只记录消息类型、长度、验证结果和匿名 source/session 标识。

## 错误处理

| 场景 | 行为 | 来源锁 |
|---|---|---|
| 链接无效 | 留在当前/空状态，输入框显示格式错误；不发暂停命令 | 不新建 |
| 浏览器暂停失败或超时 | 仍进入 Desktop 自播，显示手动暂停提示 | Embedded 锁继续 |
| 视频可播但无字幕 | 视频继续，字幕区显示无字幕空态 | Embedded 锁继续 |
| Cookie 疑似失效或内容受限 | 保留 Cookie，提供更新 Cookie、换链接、退出 | Embedded 锁继续 |
| 字幕初始化失败 | 显示重新加载、换链接、退出 | Embedded 锁继续 |
| WebView 崩溃 | 停止控制，进入 EmbeddedRecovering | Embedded 锁继续 |
| 非法导航、popup 或下载 | 拒绝并显示非阻断说明 | Embedded 锁继续 |
| 消息畸形或持续超限 | 丢弃；持续发生则隔离该 WebView | Embedded 锁继续 |
| 用户显式退出 | 停止/销毁 WebView，回双入口空状态 | 释放并建立浏览器屏障 |

错误只改变当前 Embedded 会话内部状态，不能把 BrowserSource 变成隐式 fallback。

## 验收与回归

### 来源仲裁

- BrowserSource 活跃时提交有效链接：先请求暂停，再进入 EmbeddedSource。
- 暂停失败或两秒超时：Player 仍打开，警告可见，BrowserSource 不抢占。
- Embedded 锁定期间，浏览器 session、revision、cursor、手动播放、换视频和自动连播均不改变 UI。
- 退出后立即为空状态；锁定前和锁定期间已存在的播放世代均不能重新接入。
- 退出后浏览器新发生的手动播放、换视频播放或自动连播能重新接入。
- Player reload、字幕故障或 WebView 恢复不释放 Embedded 锁；只有显式退出释放。

### Embedded 播放与字幕

- 已知公开视频在未登录状态可以播放，且连续播放 30 分钟无来源漂移或后台遗留声音。
- 已知 1080p 以上样本在支持的网络和机器上保留 1080p 或更高选项；不要求默认或强制 4K。
- 人工字幕、ASR、多语言轨、原始音轨选择和无字幕视频均有明确结果。
- 播放、暂停、字幕点击 seek、同句内 seek、广告前后恢复和换链接正常。
- 播放 cursor 稳态约 100ms 一次，当前句切换与既有性能边界一致。
- verified + ready + 非空 Embedded session 可复用 SQLite revision 和已有译文；无效状态不入库。

### Cookie

- 解析完整键值串以及空白、值内等号、重复键、空键、控制字符、超长和超数量输入。
- Keychain 保存、应用、重启恢复、原子替换和清除均可验证，production/DEV 不串用。
- 疑似失效时保留原值并提示；重新粘贴后可以 reload 当前视频。
- 日志、SQLite、崩溃信息、前端状态快照和 Extension 消息中搜索不到测试 Cookie 值。
- Extension manifest 不新增 `cookies` 权限，也不存在读取浏览器 Cookie 的代码路径。

### 安全负向测试

- `youtube` WebView 没有 clipboard、updater、process、shell、文件系统或通用 invoke 权限。
- 非 YouTube 顶层导航、popup、新窗口和下载被拒绝。
- 错版本、畸形、超大、高频消息以及错误 sourceId/sessionId/videoId/commandId 被拒绝。
- iframe 不能调用主 frame 的 Embedded 事件入口；远程页面不能调用 CookieVault。
- 关闭或崩溃的旧 WebView 的迟到事件不能进入新 Embedded session。

### 现有能力回归

- production 与 DEV Extension 都继续声明 `nativeMessaging`，并保持不同 Extension ID、Host、
  bundle、socket、数据库与 Keychain service。
- 现有浏览器字幕、播放/暂停、seek、列表/影院/菜单栏形态和多视频仲裁不变。
- 两个 Chrome Profile 的 bridge 路由不串线；Host 缺失仍不影响 Extension 字幕体验。
- BrowserSource 活跃时不创建视频 WebView，不增加资源占用或重复播放。
- 进入/退出 EmbeddedSource 后，原 appMode 与 list/cinema 偏好保持不变。

### 最低自动验证

```bash
pnpm --filter @listenup/extension test
pnpm build:extension
pnpm build:extension:native-demo
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

真实回归至少覆盖两个受支持的 macOS 大版本。完整 Desktop bundle 回归后必须运行
`pnpm clean:desktop:bundles`，避免残留 `.app` 被 macOS 登记为重复应用。

## 文档与决策同步要求

实现时必须同步：

- `docs/modules/listenup-desktop/README.md`；
- `docs/topics/native-messaging.md`；
- `docs/testing.md`；
- 涉及 Extension 字幕核心抽取时的 Extension 模块文档；
- 涉及源码的 AI 文件头；
- 一条 ADR，记录双来源权威、Embedded 锁、浏览器重接屏障和远程 WebView 信任边界。

任何实施中发现的新 Feature、Bug、技术债、回归缺口或后续事项继续回写 Plane；不要只留在
实现计划、源码 TODO 或评论中。

## 交付边界

本规格可以进入一个独立实施计划，但实施必须保持可回退：删除 Player、EmbeddedSource、
CookieVault 和 SourceCoordinator 的 Embedded 分支后，现有 BrowserSource 行为应恢复原样。
首个可发布版本只以单链接、自播、字幕、控制、手动 Cookie 和安全隔离为范围；完整 YouTube
浏览或账号体系需另立 Plane work item 和新规格，不在本设计上继续膨胀。
