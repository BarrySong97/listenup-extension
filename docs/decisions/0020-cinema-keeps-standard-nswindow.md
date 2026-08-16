# 0020. 影院保留标准 NSWindow，不做运行时 NSPanel 转换

- 状态：已采纳
- 日期：2026-08-16
- 部分取代：[ADR-0019](0019-desktop-normal-window-and-dedicated-cinema-panel.md)
- Plane：LISTENUP-30

## 背景

ADR-0019 把影院拆成独立 WebviewWindow，但仍在创建后用 `object_setClass` 把 Tauri 的 `NSWindow`
强制改成 `NSPanel`，并追加 `nonactivatingPanel` style。该窗口以隐藏、`focused(false)` 状态创建，
从未进入标准 responder 链；Production 验收发现，即使 `show`、presentation 事件、两帧布局等待、
`setAcceptsMouseMovedEvents(true)` 与递归 `updateTrackingAreas` 全部成功，WKWebView 仍收不到
`mousemove` / `pointermove`，CSS `:hover` 永远为 false。

临时断点式诊断记录了工具条 opacity 正常完成 0 → 1 → 0 的入场动画，同时 DOM hover 始终 false。
同一构建仅跳过 runtime class-swap、保留标准 `NSWindow` 后，用户真实移入 / 移出立即恢复工具条，
从而把故障边界锁定在 class-swap，而不是 React、CSS 或 tracking refresh 的时机。

## 决策

1. `main` 与 `cinema` 都保留 Tauri 创建的标准 `NSWindow`，任何 WebviewWindow 都不得运行时
   `object_setClass` 为 `NSPanel`，也不得追加 `nonactivatingPanel` style。
2. `cinema` 仍是独立、无边框、透明、按需创建并隐藏复用的窗口；只有它设置 always-on-top、
   AppKit level 25、`canJoinAllSpaces` 与 `fullScreenAuxiliary`，继续覆盖其他 app 的全屏 Space。
3. 保留 `desktop-cinema-presented`、3 秒入场提示、两帧后 mouse tracking refresh 与 CSS
   `group-hover`。这些负责隐藏复用后的呈现生命周期，但不再承担修补错误原生类的职责。
4. 删除所有诊断命令、轮询、DOM 属性和环境开关。环境 sensor 必须拒绝 `object_setClass`、
   `nonactivatingPanel`、临时 hover 探针或 React pointer state 回归。

## 理由

- Tauri 创建并管理的是自己的 `NSWindow` 子类；运行时替换 Objective-C class 会绕开其初始化与
  responder / WebView 事件假设，结果无法由追补 tracking areas 稳定修复。
- 标准窗口同样可以配置高 level 与全屏辅助 collection behavior，满足影院置顶和跨 Space 的核心需求。
- 真实 Production A/B 已验证标准窗口恢复鼠标事件投递，比继续叠加 AppKit 私有补丁更可证伪、
  更容易维护。

## 后果

- 影院 hover、播放、seek 与拖动回到标准 WKWebView 事件链；工具条仍是“每次入场短显 + hover”。
- 影院窗口不再承诺 nonactivating panel 的点击语义；点击影院控件按标准 macOS 窗口规则处理焦点。
  仅移动鼠标不会激活应用。
- `refresh_window_mouse_tracking` 继续只授予 cinema，用于窗口重显、缩放、vibrancy 与跨 Space 后的
  tracking 重算；它不再掩盖 runtime class-swap。
