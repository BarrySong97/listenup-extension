# 0023. main 动态切换普通列表窗口与影院 Panel

- 状态：候选，等待 Production 真机复验
- 日期：2026-08-31
- 取代：[ADR-0019](0019-desktop-normal-window-and-dedicated-cinema-panel.md)、[ADR-0020](0020-cinema-keeps-standard-nswindow.md)、[ADR-0021](0021-cinema-cross-app-fullscreen-overlay.md)、[ADR-0022](0022-cinema-promotes-after-visible-webview.md) 的窗口拓扑与影院浮层参数
- Plane：LISTENUP-31

## 背景

列表模式需要标准 `NSWindow` 的 responder / 文本输入语义；影院模式又必须覆盖 Chrome / YouTube
原生全屏。为同时满足两者，ADR-0019 起把影院拆成独立窗口，但这条路线没有留下 Chrome 原生全屏
通过证据：隐藏阶段升级 Panel 会破坏 WebKit hover；改回标准窗口后，即使原生日志确认
screen-saver level、`canJoinAllApplications` 和辅助 Space 标记全部生效，用户仍看不到字幕；再改成
独立窗口可见两帧后升级 Panel，完整重启后仍失败。

回溯提交和 LISTENUP-30 验收记录后，真正通过同屏 Chrome 原生全屏严格测试的是 `57eebdc`：只有
一个已经初始化的 `main` WebView；同一原生窗口使用 `NSPanel + nonactivatingPanel`、level 25，
并把 collection behavior **整体替换**为 `canJoinAllSpaces | fullScreenAuxiliary`。后来拆出的独立
cinema 从未复现这条已验证拓扑。

## 决策

1. Desktop 只使用 Tauri 初始化的 `main` WebViewWindow；不得创建、隐藏复用或授权独立
   `cinema` WebViewWindow。
2. list 模式保持 Tauri 原始标准 `NSWindow`、默认 level / collection behavior 与
   `alwaysOnTop=false`。首次进入影院前保存原始 Objective-C class、style mask、level 和
   collection behavior。
3. React 先在同一 WebView 提交影院 DOM、尺寸、位置、阴影与 vibrancy，等待两个
   `requestAnimationFrame` 后，Rust 才在 AppKit 主线程把 `main` 升级成
   `NSPanel + nonactivatingPanel`，并使用 `setBecomesKeyOnlyIfNeeded=true`、level 25 与精确的
   `canJoinAllSpaces | fullScreenAuxiliary`。不得叠加 screen-saver level、`stationary` 或
   `canJoinAllApplications`。
4. 返回 list、关闭窗口和 tray 唤回都必须走同一个成对恢复函数：先恢复原始 style、class、level、
   collection behavior 和 mouse tracking，再渲染 / 聚焦普通列表。原生侧通过稳定事件通知同一
   React WebView 回到 list。
5. 2 秒 keeper 只在 `main` 已处于 cinema Panel 且可见时重申同一历史策略；切回 list 后不得改变
   普通窗口层级。
6. environment sensor 必须拒绝独立 cinema capability / builder、失败实验的高 level / 新 bit、
   隐藏 WebView 换类、缺失完整恢复或超过成对两处的 `object_setClass`。

## 理由

- 这是仓库里唯一同时拥有代码参数和真实 Chrome 原生全屏通过记录的窗口拓扑，不再根据单项
  AppKit 属性“应该可行”推测组合行为。
- 同一 WebView 已经完成 Tauri / WebKit 初始化，避免隐藏创建的第二个 WebView 在 class-swap 后
  丢失 hover；list 又能在使用输入控件前恢复标准窗口语义。
- 保存并恢复真实原始值，不硬编码 list level / behavior，能够与 Tauri 后续默认值保持兼容。

## 后果

- list / cinema 仍各自持久化尺寸和位置，但它们是同一窗口的两种呈现，不是两套 WebView 生命周期。
- updater、字幕 session、React 状态和 capability 只存在于 `main`，不再复制或同步到影院窗口。
- 自动化只能锁定拓扑、参数和成对恢复；WindowServer 层级、WebKit hover、播放 / seek / 拖动仍需
  在 Production `.app` 分别验证“先影院后 Chrome 全屏”和“Chrome 已全屏后进入影院”。
