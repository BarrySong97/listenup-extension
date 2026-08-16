# 0019. Desktop 固定普通主窗口，影院使用独立 NSPanel

- 状态：已采纳
- 日期：2026-08-16
- 取代：[ADR-0010](0010-desktop-and-menubar-app-modes.md)、[ADR-0011](0011-menubar-preserves-desktop-window-size.md)
- Plane：LISTENUP-30

## 背景

旧实现把同一个主 `NSWindow` class-swap 成 `NSPanel + nonactivatingPanel`，再通过
`desktop | menubar` appMode 修改 activation policy、窗口层级、失焦隐藏和 tray 定位。这个模型适合
不抢视频应用焦点的字幕浮层，却不适合包含链接、Cookie 等文本输入的完整 Desktop UI：普通窗口虽然
看起来获得了 DOM focus，但物理按键和 `Cmd+A/C/X/V` 仍可能留在上一个活跃应用。后来加入的
`activate_text_input` 和根级点击激活只是补偿这条错误的原生焦点链路，并导致 Production 中任意点击
触发激活、窗口拒绝成为 key window 后消失。

产品现在只需要两种职责：常规的字幕列表 / Desktop Playback，以及覆盖视频的影院字幕浮层。菜单栏
图标仍可作为辅助入口，但不再需要一种独立的 Menubar App 形态。

## 决策

1. 应用固定使用 macOS `Regular` activation policy。`main` 保持 Tauri 创建的标准 `NSWindow`，不再
   class-swap、不再 always-on-top、不再失焦隐藏；输入、选择、复制粘贴全部走 AppKit → key window →
   WKWebView first responder 的标准链路。
2. 影院模式使用 label 为 `cinema` 的独立 WebviewWindow。只有该窗口转换为
   `NSPanel + nonactivatingPanel`，使用高 window level、`canJoinAllSpaces`、
   `fullScreenAuxiliary` 和 always-on-top。影院不承载文本输入，因此保持不激活视频应用。
3. 进入影院时保存主窗口几何、隐藏 `main` 并显示 `cinema`；退出时隐藏影院并恢复、聚焦主窗口。
   两个 Webview 只负责呈现，Native Messaging、来源协调、SQLite 和播放命令仍以同一 Rust 状态为权威。
4. 删除 Menubar appMode、版本化偏好读取、Accessory 切换、tray 下方定位、失焦自动隐藏、Header/tray
   形态切换和 `activate_text_input`。已有 `desktop-preferences.json` 留在磁盘但不再读取。
5. tray 仅提供“显示字幕窗口 / 检查更新 / 退出”。主窗口与影院使用独立 Tauri capability，影院只获得
   字幕读取、播放控制、会话选择、视觉设置和退出影院所需的最小权限。

## 理由

- 标准主窗口天然满足文本输入和菜单快捷键，不需要跨层级强制激活或根级 pointer 副作用。
- 独立影院窗口把 macOS 全屏 Space 所需的私有 AppKit 行为限制在真正需要的地方，避免再次污染主窗口。
- 两个呈现窗口共享 Rust 权威，比在同一原生对象上反复 class-swap 更容易推理和回归，也不会复制连接。
- 取消不再需要的 Menubar 形态后，窗口语义与用户看到的产品模式一致。

## 后果

- 列表和 Desktop Playback 与普通 macOS app 一样出现在 Dock / Cmd+Tab，可被其他窗口遮挡，点击后正常
  成为 key window。
- 影院浮层仍能跨 Space 覆盖原生全屏视频，但不得新增文本输入；如未来需要输入，应先退出影院回主窗口。
- tray 左键永远恢复主窗口并退出影院，不再提供失焦自动收起或 appMode 切换。
- `windowPresentation.test.ts` 与 `scripts/check-environment-identifiers.mjs` 固定窗口 label、capability、
  主窗口非置顶、仅影院 NSPanel 化以及禁止全局激活的架构棘轮。
