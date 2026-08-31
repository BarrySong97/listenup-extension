# 决策日志（ADR）

记录重要技术/架构决策的「为什么」，防止 agent（或未来的人）推翻已定设计、重复踩坑。

## 怎么用

- 每条决策一个文件：`NNNN-<短标题>.md`（NNNN 递增）。
- 复制 [0000-template.md](0000-template.md) 作为新条目。
- 在下方索引登记一行。
- 决策一旦写下尽量不改；要推翻就新增一条「取代 NNNN」的决策。

## archgate：给架构类决策配可执行规则

- 架构/边界类 ADR 应**配一条可执行规则**（linter 规则、结构测试、检查脚本）。
- 把 ADR 编号写进报错信息里，既拦住违规、又顺手「教育」agent 为什么。
- 原则：可执行规则承载「强制」，ADR 承载「为什么」。agent 能忽略文档，但检查失败绕不过去。
- 现状：本仓库只有 [ADR-0006](0006-adopt-ai-doc-system.md) 配了可执行规则（`scripts/check-docs.mjs`）。0001 / 0003 / 0004 目前只有文字约束，是最该补守卫的地方。

## 索引

| 编号 | 标题 | 状态 | 日期 |
|---|---|---|---|
| [0001](0001-content-script-shadow-dom.md) | 内容脚本 Shadow DOM + rem→em 样式注入 | 已采纳 | 2026-07-25（回填） |
| [0002](0002-dev-prod-separate-desktop-apps.md) | dev / production 桌面端做成两个独立 app | 已采纳 | 2026-07-25（回填） |
| [0003](0003-native-messaging-single-binary.md) | 单二进制双模式 + Unix socket 的 Native Messaging | 已采纳 | 2026-07-25（回填） |
| [0004](0004-website-static-export.md) | 官网静态导出 + Cloudflare Pages | 已采纳 | 2026-07-25（回填） |
| [0005](0005-polyform-noncommercial-license.md) | PolyForm Noncommercial 1.0.0 许可证 | 已采纳 | 2026-07-25（回填） |
| [0006](0006-adopt-ai-doc-system.md) | 采用 AI-Doc-System，文档收敛到根 docs/ | 已采纳 | 2026-07-25 |
| [0007](0007-desktop-owned-video-session-selection.md) | Desktop 统一仲裁多视频字幕会话，字幕轨做 videoId 三重校验 | 已采纳 | 2026-07-31 |
| [0008](0008-desktop-sqlite-bilingual-subtitles-and-safe-cli.md) | Desktop SQLite 原语/译文与安全 AI CLI | 已采纳 | 2026-08-01 |
| [0009](0009-native-messaging-bidirectional-playback-control.md) | Native Messaging 按 bridge/session 精确路由的双向播放控制 | 部分被 0018 取代 | 2026-08-07 |
| [0010](0010-desktop-and-menubar-app-modes.md) | 同一 NSPanel 支持自由 Desktop 与菜单栏 App 双形态 | 已被 0019 取代 | 2026-08-07 |
| [0011](0011-menubar-preserves-desktop-window-size.md) | 菜单栏形态保留 Desktop 窗口尺寸 | 已被 0019 取代 | 2026-08-07 |
| [0012](0012-desktop-heroui-ui-primitives.md) | Desktop 业务交互统一经过 HeroUI 3 primitives | 已采纳 | 2026-08-07 |
| [0013](0013-desktop-react-compiler-and-cursor-render-boundaries.md) | Desktop 使用 React Compiler 并隔离实时 cursor 渲染边界 | 已采纳 | 2026-08-07 |
| [0014](0014-desktop-subtitle-row-seek-control.md) | Desktop 字幕行通过既有 Native 控制链路跳转视频 | 已采纳 | 2026-08-07 |
| [0015](0015-desktop-same-window-youtube-transports.md) | Desktop 同窗 YouTube 的播放与字幕传输边界 | 已采纳 | 2026-08-11 |
| [0016](0016-desktop-embedded-subtitle-sibling-overlay.md) | Desktop Embedded 字幕使用可信 iframe 同级 Overlay | 已采纳 | 2026-08-13 |
| [0017](0017-desktop-embedded-list-collapse-and-overlay-independent.md) | Desktop Embedded 列表收起与视频 Overlay 独立 | 已采纳 | 2026-08-13 |
| [0018](0018-desktop-backward-compatible-native-protocol.md) | Desktop 对商店上一版 Native Messaging 协议保持向后兼容 | 已采纳 | 2026-08-14 |
| [0019](0019-desktop-normal-window-and-dedicated-cinema-panel.md) | Desktop 固定普通主窗口，影院使用独立 NSPanel | 部分被 0020 取代 | 2026-08-16 |
| [0020](0020-cinema-keeps-standard-nswindow.md) | 影院保留标准 NSWindow，不做运行时 NSPanel 转换 | 已被 0023 取代 | 2026-08-16 |
| [0021](0021-cinema-cross-app-fullscreen-overlay.md) | 影院使用跨应用全屏浮层策略 | 已否决并被 0023 取代 | 2026-08-31 |
| [0022](0022-cinema-promotes-after-visible-webview.md) | 影院在 WebView 可见后可逆升级为 NSPanel | 已否决并被 0023 取代 | 2026-08-31 |
| [0023](0023-main-dynamically-switches-list-window-and-cinema-panel.md) | main 动态切换普通列表窗口与影院 Panel | 候选，待 Production 复验 | 2026-08-31 |
