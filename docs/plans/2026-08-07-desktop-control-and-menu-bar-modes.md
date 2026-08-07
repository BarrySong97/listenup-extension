# Desktop 播放控制、seek 同步与菜单栏形态 — 实施计划

- 日期：2026-08-07
- 状态：执行中
- 关联设计：
  - `docs/spark/2026-08-07-desktop-seek-sync-design.md`
  - `docs/spark/2026-08-07-desktop-playback-control-design.md`
  - `docs/spark/2026-08-07-desktop-menu-bar-mode-design.md`
- Plane：LISTENUP-3、LISTENUP-1、LISTENUP-2

## 方案概述

按依赖顺序交付三条独立变更：先让 seek 产生可强制发送的可靠 cursor，再把现有 Native
Messaging 链路升级为按 bridge/session 精确路由的双向播放命令，最后复用同一个 NSPanel
实现自由 Desktop 与 tray 下方菜单栏面板的动态切换。

每条变更独立补测试、文档和提交，避免 cursor 缺陷、协议升级与 macOS 窗口生命周期混成
不可回滚的大提交。

## 涉及文件 / 模块

- `apps/extension/src/pages/content/lib/youtube-sdk/` — 保留播放器事件原因和 seek 手势边界。
- `apps/extension/src/pages/content/hooks/` — cursor 调度、命令校验和播放器执行。
- `apps/extension/src/shared/nativeSubtitleProtocol.ts` — Native Messaging v4 契约。
- `apps/extension/src/pages/background/index.ts` — Native Host 命令与 tab 路由。
- `apps/listenup-desktop/src-tauri/src/` — bridge 双向 I/O、HostStore 路由、偏好、tray、定位和窗口形态。
- `apps/listenup-desktop/src/` — 播放控件、appMode 状态和两种窗口 shell。
- `docs/topics/native-messaging.md`、Desktop/Extension 模块文档、`docs/testing.md` — 行为与回归同步。
- `docs/decisions/` — 双向协议和双形态生命周期 ADR。

## 执行批次

1. [x] 提取可测试的 cursor 调度器，让 seek 开始/结束强制刷新且普通播放保持 250ms 节流。
2. [x] 用真实事件原因贯通 YouTubePlayerFacade → React → Native cursor，并补 Extension 测试。
3. [x] 升级协议到 v4，增加 playback command/result 类型与严格守卫。
4. [x] 为每个 GUI socket 分配 bridgeId，保存可写句柄并把 session 绑定到来源 bridge。
5. [x] 打通 GUI → bridge stdout → background → content → result/cursor 的完整命令往返。
6. [x] 在 Desktop 列表和影院 UI 中加入非乐观播放/暂停控件、pending 与错误反馈。
7. [x] 增加 appMode Rust 偏好、动态 activation policy、事务回滚和前端状态同步。
8. [x] 从 Separate/Grove 适配 tray 左键切换、多显示器定位与有效失焦隐藏。
9. [x] 菜单栏形态使用 list panel 并保留 Desktop 当前尺寸；切回恢复位置和 list/cinema 模式。
10. [x] 同步文件头、模块/专题文档、测试清单和两条 ADR。
11. [ ] 运行全部受影响构建、测试、sensors 和可执行的 macOS 窗口回归。
12. [x] 按 Native 播放同步、双形态、文档与可执行棘轮拆成 Conventional Commits。

## 风险 / 注意

- bridge 模式 stdout 只能写 Chrome Native Messaging 长度帧，任何日志必须继续写 stderr。
- 不同 Chrome Profile 的 tabId 可能相同，反向命令必须同时依赖 bridgeId 与 sessionId。
- GUI 未运行时 bridge 仍只缓存 session、丢弃 cursor；不能让视频播放自动弹窗。
- activation policy、窗口属性和偏好写入必须作为可回滚事务，失败时不能留下错误的持久模式。
- Menubar 失焦隐藏必须带 hadFocus/native-dialog 防护，不能在窗口刚显示时立即吞掉。
- 生产与 DEV 的 Extension ID、Host、bundle、socket、数据库和 appMode 偏好继续完全隔离。
- 不修改生成物，不放宽 docs 或环境 sensors。

## 验证方式

```bash
pnpm --filter @listenup/extension test
pnpm build:extension
pnpm build:extension:native-demo
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

真实链路按三份设计的回归清单执行；完整 `.app` bundle 回归结束后运行：

```bash
pnpm clean:desktop:bundles
```

## 本轮验证记录

- [x] Extension Node tests：21/21（含 cursor 调度与 v4 command 守卫）。
- [x] Desktop Rust tests：23/23（含 bridge 路由、错误 result、appMode 偏好与 panel clamp）。
- [x] production / DEV Extension 构建、Desktop 前端构建、DEV `.app` bundle 构建。
- [x] `check-environment-identifiers.mjs` 与 `check-docs.mjs`。
- [x] DEV bundle 从自由 Desktop 切到 Menubar 后，系统应用列表由 running 变为非 running，
  且 `desktop-preferences.json` 原子写入 `menubar`；回归 bundle 已清理。
- [ ] Native 播放控制与 seek 需要装载本次 DEV Extension 后在真实 YouTube 页面端到端确认。
- [ ] 当前 Computer Use 驱动无法读取 macOS 状态栏 item；tray 左键显示/隐藏、图标下方定位、
  多显示器 clamp、有效失焦隐藏和从 tray 切回 Desktop 仍需人工按 `docs/testing.md` 回归。
- [x] 用户回归发现 Menubar 固定 400×640 会覆盖 Desktop 当前尺寸；已由 ADR-0011 改为
  运行中不 resize，并增加 `appModeWindowPolicy.test.ts` 棘轮。
