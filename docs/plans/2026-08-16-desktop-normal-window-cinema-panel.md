# Desktop 普通窗口与独立影院浮层 — 实现计划

- 日期：2026-08-16
- 状态：已完成
- Plane：LISTENUP-30

## 方案概述

删除 `desktop | menubar` 双 appMode，应用始终以 macOS `Regular` 形态运行。字幕列表与
Desktop Playback 使用正常、可聚焦的主 `NSWindow`，不再 class-swap 为 `NSPanel`，因此文字输入、
复制粘贴和普通窗口焦点全部交给 AppKit / WKWebView 的标准链路。

影院模式改为独立、轻量的 `NSPanel` 浮层：只有它使用 `nonactivatingPanel`、高 window level、
`canJoinAllSpaces` 与 `fullScreenAuxiliary`。进入影院时隐藏主窗口并显示浮层；退出时关闭浮层并恢复
主窗口。两者复用同一个 Rust 字幕来源权威与播放命令，不复制 Native Messaging、SQLite 或更新状态。

保留菜单栏图标作为“显示主窗口 / 检查更新 / 退出”的辅助入口，但不再存在 Menubar Mode、
Accessory activation、tray 下方定位、失焦自动隐藏或形态切换菜单。

选择两个原生窗口而不是在同一个 Webview 上反复 `object_setClass`，是为了让普通窗口始终保持真实
`NSWindow` 语义，并把全屏浮层的 AppKit 私有行为隔离到影院窗口，避免再次污染输入焦点。

## 涉及文件 / 模块

- `apps/listenup-desktop/src-tauri/src/lib.rs` — 主窗口恢复正常 NSWindow；创建、显示和销毁影院 NSPanel；简化 tray。
- `apps/listenup-desktop/src-tauri/src/app_mode.rs` — 删除双形态状态机与 `desktop-preferences.json`。
- `apps/listenup-desktop/src-tauri/src/positioning.rs` — 删除 tray 面板定位；影院位置改走现有窗口尺寸/位置偏好。
- `apps/listenup-desktop/src/App.tsx` — 删除 appMode、根级键盘激活和 Menubar UI；按窗口 label 渲染主界面或影院浮层。
- `apps/listenup-desktop/src/types.ts`、`appModeWindowPolicy*` — 删除 appMode 类型、策略与旧测试。
- `apps/listenup-desktop/src/i18n/resources.ts` — 删除 Menubar Mode 文案。
- `scripts/check-environment-identifiers.mjs` — 固化“主窗口不得 NSPanel 化、不得根级激活、影院才允许 always-on-top”的棘轮。
- `docs/decisions/` — 新增 ADR 取代 ADR-0010/0011，并更新索引。
- `docs/modules/listenup-desktop/README.md`、`docs/testing.md` — 同步窗口架构与回归矩阵。

## 任务拆解

1. [x] 写 ADR：应用固定 Regular；主窗口为普通 NSWindow；影院为独立 NSPanel；旧 Menubar 决策退役。
2. [x] 删除 Rust appMode 持久化、Accessory 切换、失焦隐藏与 tray 定位代码，忽略已有旧偏好文件。
3. [x] 让主窗口保持 Tauri 创建的原生 NSWindow，恢复标准焦点、输入、复制粘贴和窗口层级。
4. [x] 建立独立影院窗口，只在影院模式启用 NSPanel、nonactivating、always-on-top 和 all Spaces。
5. [x] 在两个窗口间同步字幕显示模式、当前字幕、播放控制、语言和影院几何，不复制来源权威。
6. [x] 删除根级 `activate_text_input` 与原生命令；链接/Cookie 输入框走正常 WKWebView 输入链路。
7. [x] 删除 Menubar Mode 的 Header/tray 菜单、类型、策略、文案和测试；tray 左键只恢复主窗口。
8. [x] 增加确定性 sensors 与窗口策略测试，防止主窗口再次被 NSPanel 化或全局点击激活。
9. [x] 更新模块文档、测试手册、文件头和旧 ADR 状态。
10. [x] 跑自动化与真实 DEV `.app` 手工回归，回写 Plane、提交并交付验收。

## 风险 / 注意

- 两个 Webview 不能各自成为字幕来源权威；Rust coordinator、SQLite 和 Native socket 仍只有一份。
- 隐藏主窗口时不能销毁播放/字幕状态；退出影院后必须恢复进入前的主窗口位置、尺寸和列表状态。
- 影院浮层不包含文本输入，因此不得激活应用；字幕 seek / 播放按钮仍要在 nonactivating panel 中可点。
- tray 保留仅是辅助入口，不得重新引入 Accessory、自动隐藏或 tray rect 定位。
- 已有 `desktop-preferences.json` 可以保留在磁盘但停止读取，升级后必须无条件进入普通主窗口。
- 更新安装、Native Messaging GUI/bridge 分流和 production/DEV 隔离不得被窗口拆分影响。

## 验证方式

```bash
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
git diff --check
```

真实 macOS 回归至少覆盖：Production 冷启动只出现普通主窗口；列表和 Desktop Playback 可正常点击、
连续输入及使用物理 `Cmd+A/C/X/V`；普通点击不会隐藏或强制 always-on-top；进入影院后主窗口隐藏、
字幕浮层进入 Chrome 原生全屏 Space 且保持置顶；退出影院恢复原窗口几何；影院 hover、拖动、播放、
seek 正常且不抢 Chrome 焦点；tray 左键仅恢复主窗口；升级、重启和旧 Menubar 偏好不会恢复旧形态。

## 实施与验证记录

- 新增 [ADR-0019](../decisions/0019-desktop-normal-window-and-dedicated-cinema-panel.md)，并由环境 sensor
  固定主窗口非置顶、影院独立 capability、仅 cinema 可 class-swap，以及禁止全局激活。
- 自动化：Desktop Node test 34/34、Rust test 49/49、Desktop production frontend build、完整
  DEV `.app` bundle、环境 sensor、文档 sensor 与 `git diff --check` 均通过。
- Computer Use 回归完整 DEV `.app`：main 被 macOS 识别为 `standard window` 且 window layer 为 0；
  真实点击输入框可连续键入，`Cmd+A` + 删除生效，普通 Tab 点击不隐藏；进入后变为独立
  `ListenUp Cinema`，退出恢复 standard main 与原输入状态。测试 bundle 已按清理规范删除。
