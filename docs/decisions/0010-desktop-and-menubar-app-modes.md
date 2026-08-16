# 0010. 同一 NSPanel 支持自由 Desktop 与菜单栏 App 双形态

- 状态：已被 [ADR-0019](0019-desktop-normal-window-and-dedicated-cinema-panel.md) 取代
- 日期：2026-08-07

## 背景

现有 Desktop 始终以 `ActivationPolicy::Regular` 运行，适合长期悬浮字幕，但有些用户希望像
Separate/Grove 一样只保留菜单栏入口：点击 tray 后在图标下方出现面板，失焦即收起。两个
独立窗口或两个 app 会复制字幕状态、连接和升级逻辑；仅隐藏 Dock 图标又不能定义窗口尺寸、
定位、失焦和升级兼容行为。

## 决策

1. 复用同一个 Tauri Webview / NSPanel，定义 `desktop | menubar` 两种 appMode。Desktop 使用
   `Regular`、可缩放并保留 list/cinema；Menubar 使用 `Accessory`、`skip_taskbar`、固定
   400×640 列表且不可缩放。固定尺寸部分后来被 [ADR-0011](0011-menubar-preserves-desktop-window-size.md)
   取代：Menubar 仍为列表且不可缩放，但继承 Desktop 当前尺寸。
2. tray 左键在 Menubar 形态切换面板显示/隐藏。显示时根据 tray rect、点击位置、monitor
   scale 与 work area 定位并 clamp；面板真正获得过焦点后，失焦自动隐藏。
3. Desktop → Menubar 前由 Rust 捕获运行时窗口位置/尺寸，切回时恢复；React 保存自由窗口的
   list/cinema 与重启偏好。tray 菜单和 header 都调用同一 Rust 状态机。
4. appMode 以版本化 `desktop-preferences.json` 存在当前环境 app-data；缺失、损坏或未知版本
   默认 Desktop。使用临时文件 + rename 原子保存，runtime 属性、窗口几何和持久化失败时
   回滚旧形态，成功后才更新内存并发事件。
5. production / DEV 依靠各自 bundle app-data 天然隔离。固定在 Dock 的快捷图标可以保留，
   但 Menubar 的 Accessory 形态不作为运行中 app 显示圆点或 Cmd+Tab 项。

## 理由

- 单窗口复用可让字幕、选择、更新和 Native 连接状态无缝延续，避免双实例仲裁。
- Rust 是 macOS activation、窗口属性、tray 与偏好的共同权威，能覆盖用户从 tray 菜单切换、
  React 未参与的路径，并提供事务回滚。
- 缺偏好默认 Desktop 保持升级前体验，不会让现有用户误以为 app 消失。
- Separate/Grove 已验证的 tray 定位与有效失焦语义符合菜单栏 app 的平台预期。

## 后果

- Menubar 形态不能使用影院视图或自由缩放；切回 Desktop 后恢复原视图与几何。
- activation policy 的含义是运行中 app 表现，不保证用户手工固定的 Dock 快捷图标被移除。
- 偏好写入错误必须显式反馈且保持旧形态，不能只更新 React 或只更新磁盘。
- 自动化棘轮由 appMode 偏好默认/往返测试与 panel 坐标 clamp 测试承担；真实 activation、
  tray、焦点和多显示器行为仍按 `docs/testing.md` 做 macOS 手工回归。
