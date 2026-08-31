# 0022. 影院在 WebView 可见后可逆升级为 NSPanel

- 状态：已否决并被 [ADR-0023](0023-main-dynamically-switches-list-window-and-cinema-panel.md) 取代
- 日期：2026-08-31
- 部分取代：[ADR-0020](0020-cinema-keeps-standard-nswindow.md)、[ADR-0021](0021-cinema-cross-app-fullscreen-overlay.md)
- Plane：LISTENUP-31

## 背景

ADR-0020 证实：把隐藏创建、从未进入 responder 链的 cinema WebView 立即 runtime class-swap 为
`NSPanel`，会让 WebKit 永久收不到 mouse move，CSS hover 直到重启都不能恢复。因此 0.5.5 改为
标准 `NSWindow`，hover 恢复，但用户随后发现影院字幕无法覆盖 Chrome / YouTube 原生全屏。

ADR-0021 尝试在不换类的前提下，把 cinema 提升到 screen-saver level 1000，并组合
`canJoinAllSpaces | stationary | fullScreenAuxiliary`；macOS 26+ 再启用 `canJoinAllApplications`。
Desktop DEV 日志确认 level 与全部 collection behavior 已真实写入原生窗口，用户按“先进入影院、再让
Chrome 全屏”回归仍完全看不到字幕。由此可证：这些属性解决层级和加入资格，但标准 `NSWindow`
依然不能稳定进入其他 App 的原生全屏 Space；本项目已知能通过同屏严格测试的原生语义仍是
`NSPanel + nonactivatingPanel`。

## 决策

1. `main` 始终保留 Tauri 创建的标准 `NSWindow`，永不 runtime class-swap，也不获得 cinema 的 level、
   style 或 collection behavior。
2. `cinema` 创建和首次显示时同样保留标准 `NSWindow`。只有 `desktop-cinema-presented` 之后，前端已等待
   两个可见 `requestAnimationFrame`，cinema-only 的 `refresh_window_mouse_tracking` 命令才允许在主线程
   执行 Panel 升级。
3. 升级前保存 cinema 原始 Objective-C class 与 style mask；随后换为 `NSPanel`、追加
   `nonactivatingPanel`，设置不随应用失活隐藏、不在关闭时释放，并重申跨应用全屏策略、
   `orderFrontRegardless` 与 WebView tracking areas。
4. `setBecomesKeyOnlyIfNeeded=false`：`nonactivatingPanel` 已阻止应用抢占 Chrome 焦点，但 panel 自身仍需
   在用户点击后把事件交给 WebView first responder，保证播放、seek、拖动和未来的输入控件可用。
5. 退出影院、关闭影院或 tray 唤回 main 时，必须先恢复保存的 style mask 与原始 class，再隐藏 cinema。
   下次进入重复“标准窗口显示 → 可见两帧 → Panel 升级”的完整生命周期。
6. environment sensor 必须把 runtime class 变化限制为成对的 cinema 升级 / 恢复，拒绝隐藏阶段换类、
   main 换类、缺少恢复路径或用 React pointer state 掩盖 native tracking 问题。

## 理由

- 失败证据排除了“level 或 macOS 26 behavior 没写上”；继续只调 bitmask 无法改变标准窗口的 Space 类型。
- ADR-0020 的故障边界是隐藏创建阶段换类，而不是所有时间点的换类。先让标准窗口和 WebView 完成可见
  布局，再升级，可以保留 responder / tracking 初始化，同时获得 Panel 的跨应用全屏资格。
- 保存并恢复 Tauri 的原始子类比硬编码类名安全；所有切换集中在 cinema-only 主线程函数中，影响面可控。

## 后果

- 该方案恢复了 cinema 的 nonactivating Panel 语义；仅移动鼠标或点击控件不应把 Chrome 从前台抢走。
- runtime class-swap 仍是需要真机验证的兼容层。自动化只能锁住调用时机、目标与成对恢复，不能证明
  WindowServer 层级或 WKWebView 事件投递。
- 采纳前必须在 Production `.app` 回归两种进入顺序，并同时验证 hover、拖动、播放、seek、影院退出与
  main 输入。任何 hover 再失效都否决本候选方案，不能用 DOM pointer state 兜底。

## 验证结果

完整重启后的 DEV 原生日志确认独立 cinema 已在可见两帧后升级为 nonactivating `NSPanel`，level 与
collection behavior 也正确；用户进入 Chrome 原生全屏后仍看不到字幕。回溯证明独立 cinema 从未有
全屏通过记录，因此否决这条拓扑，转回 ADR-0023 的单一已初始化 `main`。
