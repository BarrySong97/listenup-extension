# Desktop 内嵌 YouTube 与字幕通信 — 技术调研

- 日期：2026-08-10
- 状态：调研完成；建议先做受限 PoC，不直接替换 Chrome Extension 链路
- Plane：LISTENUP-7

## 问题与结论

目标是判断 ListenUp Desktop 能否在应用内打开 YouTube，并继续提供完整字幕、实时游标、
播放 / 暂停和字幕 seek。

**结论：技术上可行，但应理解为新增一条“Desktop 内嵌来源”，不是把 Chrome Extension 原样
搬进 Desktop。** 当前 macOS/Tauri 技术栈可以加载 YouTube watch 页、在页面启动时注入脚本，
并直接从页面播放器读取字幕轨、播放状态和字幕文档；本机探针已经验证到完整字幕 JSON。
主要障碍不在字幕通信，而在 Google 登录、远程页面安全边界、YouTube 私有页面 API 的稳定性，
以及现有 NSPanel 字幕浮窗不适合同时充当完整视频浏览器。

因此推荐：保留现有 Chrome Extension → Native Messaging 为稳定主路径；新增一个普通
`NSWindow` 的实验性 ListenUp Player，仅先支持无需登录的公开视频。Player 内的 YouTube
WebView 直接向 Rust 上报与现有协议等价的 session/cursor，现有字幕浮窗、SQLite、双语和
seek 继续复用。登录、会员、年龄限制视频在 PoC 阶段明确不承诺。

## 当前架构约束

现有字幕数据的权威来源在 Chrome 内容脚本，不在 Desktop：

```text
YouTube/Chrome content script
  → Extension service worker（补 tabId）
  → Chrome Native Messaging
  → Desktop bridge process / Unix socket
  → HostStore
  → React 字幕窗口 + SQLite
```

- 页面播放器与字幕轨读取依赖 `#movie_player.getPlayerResponse()`、`getAudioTrack()`、
  `window.ytInitialPlayerResponse` 和字幕 track URL。
- `useNativeSubtitleBridge.ts` 使用 `chrome.runtime` 把 session/cursor 发给 service worker，
  反向命令也经 Chrome tab 路由；这些 API 在 WKWebView 中不存在。
- Desktop 当前唯一窗口被 class-swap 成 non-activating `NSPanel`，并带 always-on-top、透明、
  list/cinema 与 menubar 生命周期。这种窗口适合字幕带，不适合承担完整 YouTube 浏览、文本输入、
  登录和原生全屏。
- `capabilities/default.json` 当前按 `windows: ["main"]` 授权；Tauri 明确说明在多 WebView
  窗口中按 window 授权会让窗口内所有 WebView 合并权限边界。远程 YouTube WebView 绝不能
  直接放进现有 `main` 权限范围。

## 本机探针证据

2026-08-10 在 arm64、macOS 26.5.1 上，用一次性 `WKWebView` 探针加载公开视频
`M7lc1UVf-VE`；探针完成后源文件和二进制均已删除，未改产品代码。

探针结果：

```json
{
  "hasPlayer": true,
  "hasVideo": true,
  "videoId": "M7lc1UVf-VE",
  "trackCount": 2,
  "currentTrackCount": 2,
  "firstTrackLanguage": "en",
  "firstTrackHasRequestUrl": true,
  "requestUrlHasPot": true,
  "subtitleStatus": 200,
  "subtitleContentType": "application/json; charset=UTF-8",
  "subtitleBytes": 65976
}
```

裸 renderer `baseUrl + fmt=json3` 返回 200 但空文档；复用现有 ListenUp 策略，从
`getAudioTrack().captionTracks[].url` 取得带 POT 的 request URL，并补 `xorb/xobt/xovt`
等请求参数后，得到 65,976 字节的字幕 JSON。这说明现有字幕发现、POT 等待、身份校验和
解析逻辑有实际复用价值，也说明“只换一个官方字幕 URL”不足以工作。

这次探针证明的是单个、无需登录的公开视频在当前机器上可加载和取字幕；没有证明 Google
登录、受限内容、长时间播放、广告、多音轨、SPA 连续切换或不同 macOS 版本均可用。

### 未登录清晰度补充探针

同日使用无持久 Cookie、`loggedIn=false` 的 WKWebView 加载 4K60 HDR 公共视频
`LXb3EKWsInQ`。YouTube 播放器实际返回以下手动清晰度档位：

```text
2160p60 / 1440p60 / 1080p60 / 720p60 / 480p / 360p / 240p / 144p
```

player response 同时提供 2160p60 VP9、2160p60 VP9.2 HDR 与 2160p60 AV1 HDR 格式；
`MediaCapabilities.decodingInfo()` 对 3840×2160、60fps、20Mbps VP9 返回
`supported=true`、`smooth=true`、`powerEfficient=true`。因此在本机 Apple Silicon 与当前
WebKit 上，**未登录不会把普通公开视频限制在 720p/1080p，4K60 可以出现并具备硬件友好的
解码能力**。

实际自动选择仍由 YouTube 根据网速、播放器尺寸、原视频质量和浏览器格式能力动态决定；小窗口
启动时可能先选较低清晰度，这不等于账号限制。官方建议 1080p 持续带宽约 5Mbps、4K 约
20Mbps，并说明 Safari/macOS 属于支持 YouTube 高质量格式的组合。
[YouTube 清晰度说明](https://support.google.com/youtube/answer/91449)、
[高质量格式浏览器支持](https://support.google.com/youtube/answer/6322658)、
[YouTube 推荐带宽](https://support.google.com/youtube/answer/3037019)

未登录真正缺少的是账号/Premium 能力：`1080p Premium` 是 Premium 会员专属的增强码率版本，
普通 1080p、1440p 和 4K 并不因此消失。部分年龄限制、未成年人相关或其他受限内容可能要求
登录，属于可播放范围问题，不是普通公开视频的清晰度降级。
[YouTube Premium 1080p](https://support.google.com/youtube/answer/6308116)、
[YouTube 播放错误与登录限制](https://support.google.com/youtube/answer/3037019)

产品上应保留 YouTube 原生齿轮与 Quality 菜单，并给 Player 足够大的布局；不需要自造一套
非官方清晰度强制接口。PoC 需记录实际 `videoWidth/videoHeight` 与 Stats for Nerds，而不能只
根据 player response 中“可用档位”判断最终播放清晰度。

## 平台与官方 API 边界

### Tauri / WKWebView

- Tauri 2 的 WebView API允许在已有 window 中创建远程 URL WebView；Rust
  `WebviewBuilder` 还提供 document-start initialization script、navigation allowlist 和
  new-window handler。[Tauri WebView API](https://v2.tauri.app/reference/javascript/api/namespacewebview/)、
  [Tauri WebviewBuilder](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html)
- macOS 上 Tauri 使用系统 WKWebView，不是 Chrome/Chromium；因此 MV3 Extension、
  `chrome.runtime`、service worker 和 Native Messaging port 不能原样复用。
  [Tauri WebView versions](https://tauri.app/reference/webview-versions/)
- 远程内容访问 Tauri IPC 必须显式配置 capability。Tauri 建议多 WebView 窗口按 webview
  标签隔离，避免权限合并。[Tauri capabilities](https://v2.tauri.app/security/capabilities/)

### YouTube 官方能力

- 官方 IFrame Player API 可以播放、暂停、seek、读取时间和播放状态，但 captions 模块只公开
  `fontSize` 与 `reload`，不提供完整 cue 文本。因此它不能单独满足 ListenUp 的逐句列表、
  SQLite 原文 revision 和双语映射。
  [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- YouTube Data API 的 `captions.list` / `captions.download` 都要求 OAuth 授权，并不是读取任意
  公共视频字幕的无授权替代方案。
  [Captions: list](https://developers.google.com/youtube/v3/docs/captions/list)、
  [Captions: download](https://developers.google.com/youtube/v3/docs/captions/download)
- 官方 embed 还受创作者禁止嵌入、年龄限制、Referer/错误 153 等约束。
  [YouTube embed 说明](https://support.google.com/youtube/answer/171780)
- Google OAuth 明确禁止把授权请求导向开发者控制的 embedded user-agent；macOS WKWebView
  内登录不能作为可靠产品能力。应把“浏览公开视频”和“登录后的完整 YouTube 体验”视为两个
  不同目标。[Google OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies)
- 若使用官方 embedded player，必须保持广告、标准控件、播放上下文与来源识别，不应覆盖或
  修改播放器本体。字幕学习 UI 应布局在播放器之外。
  [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies)、
  [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)

## 方案比较

| 方案 | 完整字幕 | 播放控制 | 登录/受限内容 | 工程与风险 | 结论 |
|---|---:|---:|---:|---|---|
| 全站 `youtube.com` + WKWebView 注入 | 可，已实测公共视频 | 可 | 不可靠 | 私有页面 API、远程安全、WebKit 兼容 | 适合受限 PoC |
| 官方 IFrame Player API | 不提供 cue 文本 | 可 | 有 embed 限制 | 官方、相对稳定，但能力不足 | 不能单独满足现需求 |
| 保持 Chrome + Extension + Native Messaging | 可，现有主路径 | 可 | 最完整 | 用户仍在浏览器 | 继续作为稳定主路径 |
| Electron/CEF 自带 Chromium | 可通过自有注入重做 | 可 | 仍有 Google 登录政策风险 | 包体、内存、发布与维护成本显著上升 | 当前不推荐 |

## 推荐架构

```text
                           ┌─ ChromeSource
Chrome + Extension ────────┤  Native Messaging ─┐
                           │                     │
ListenUp Player WKWebView ─┴─ EmbeddedSource ───┼→ HostStore → SQLite / React viewer
                                                 │
Desktop play/pause/seek ─────────────────────────┘
```

1. 新建普通、可聚焦的 `player` NSWindow；不要改变现有字幕 `main` NSPanel 的窗口语义。
2. `player-ui` 使用本地受信任页面，YouTube 放进独立 `youtube` child WebView；播放器上方不加
   遮挡层，学习控件放在旁栏或现有字幕窗口。
3. 将 capability 从 `windows: ["main"]` 收紧为具体本地 WebView 标签；`youtube` 远程 WebView
   默认零权限，只授予一个输入严格校验、限流、限消息大小的字幕事件入口。不得给它 clipboard、
   updater、process restart 或通用 `invoke` 能力。
4. 在 Rust 增加 `EmbeddedSource`，把注入端产生的 session/cursor 归一化到 HostStore 输入；
   Chrome 仍保留 bridgeId + tabId 路由，内嵌来源使用独立 source id，不伪造 Chrome tab。
5. 抽取并复用平台无关逻辑：videoId 三重身份校验、原始音轨选择、POT 轨优先、字幕 URL 构建、
   JSON3 解析、cursor 调度。`chrome.runtime` 和 Tauri transport 分别留在薄适配层。
6. navigation allowlist 只允许 YouTube 必需域名；账户登录、任意外链、popup 和下载交给系统
   浏览器或拒绝。首版不把 OAuth cookie 注入、复制 Safari/Chrome cookie 或伪装 user-agent
   当成解决方案。

## 建议的 PoC 边界与通过条件

PoC 只回答“无需登录的公开视频能否稳定成为第二字幕来源”，不先做完整内置浏览器：

- 一个固定公开视频和一个可粘贴 watch URL；不做首页、搜索、历史、账号。
- 连续播放 30 分钟，验证字幕 JSON、100ms cursor、暂停、seek、广告前后恢复。
- 验证 SPA 切换、多音轨原语、ASR、无字幕、禁止嵌入/年龄限制的明确失败态。
- 用单独 capability 文件证明 `youtube` WebView 无 clipboard/updater/process 权限，并验证
  非 YouTube 导航与 popup 不会留在内嵌 WebView。
- Desktop 退出后不后台播放；关闭 Player 不影响 Chrome Extension 主路径。
- 在至少两个受支持 macOS 大版本上运行；若登录是上线门槛，则该方向直接判失败，继续使用
  Chrome + Extension，不用非标准 cookie 搬运绕过 Google 策略。

## 决策建议

建议批准一个小型、可删除的 signed-out PoC，但暂不承诺“Desktop 内完整替代 YouTube/Chrome”。
如果产品目标只是减少窗口切换，这条路线值得验证；如果目标要求 Google 登录、会员内容、完整
YouTube 账户体验，则应继续把 Chrome Extension 作为播放器来源，把 Desktop 做成更紧密的伴随窗口。
