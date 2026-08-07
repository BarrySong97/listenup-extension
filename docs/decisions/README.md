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
| [0009](0009-native-messaging-bidirectional-playback-control.md) | Native Messaging 按 bridge/session 精确路由的双向播放控制 | 已采纳 | 2026-08-07 |
| [0010](0010-desktop-and-menubar-app-modes.md) | 同一 NSPanel 支持自由 Desktop 与菜单栏 App 双形态 | 已采纳 | 2026-08-07 |
