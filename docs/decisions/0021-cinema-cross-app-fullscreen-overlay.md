# 0021. 影院使用跨应用全屏浮层策略

- 状态：已否决并被 [ADR-0023](0023-main-dynamically-switches-list-window-and-cinema-panel.md) 取代
- 日期：2026-08-31
- 扩展：[ADR-0020](0020-cinema-keeps-standard-nswindow.md)
- Plane：LISTENUP-31

## 背景

ADR-0020 为修复 cinema WebView 在 runtime class-swap 后收不到鼠标移动事件的问题，让影院保留
Tauri 创建的标准 `NSWindow`，同时沿用 AppKit level 25、`canJoinAllSpaces` 与
`fullScreenAuxiliary`。0.5.5 发布后的真实使用发现：hover 已恢复，但 cinema 无法稳定覆盖 Chrome
YouTube 的原生全屏 Space。此前对旧单窗口架构的本机测试也已经记录，status level 25 与 legacy
collection behavior 对普通 `NSWindow` 不足以提供跨应用全屏置顶。

macOS 26 新增 `canJoinAllApplications`，明确用于让合格的浮动窗口或系统 overlay 加入其他 App 的
全屏 Space。它解决的是跨应用资格；window level 仍决定加入同一 Space 后的前后顺序。

## 决策

1. `main` 与 `cinema` 继续保留标准 `NSWindow`；不得恢复 `object_setClass(NSPanel)`、
   `nonactivatingPanel` 或内部仍依赖同类 runtime class-swap 的第三方封装。
2. 只有 `cinema` 在进入影院和可见期间动态使用 screen-saver window level 1000；`main` 继续
   `alwaysOnTop=false`、系统默认 level 0。
3. cinema 整体替换 collection behavior 为 `canJoinAllSpaces | stationary |
   fullScreenAuxiliary`；macOS 26 及以上额外加入 `canJoinAllApplications`。新标记按运行时系统版本
   启用，旧 macOS 保留 legacy fallback，不能收到未知的新语义组合。
4. cinema 首次 `show` 后立即应用策略并 `orderFrontRegardless`；可见期间的既有 2 秒 keeper 复用
   同一策略，处理其他 App 新建全屏 Space 或系统重排窗口层级。退出影院只隐藏 cinema 并恢复 main。
5. 保留 `desktop-cinema-presented`、两帧后 tracking refresh 与 CSS `group-hover`。跨应用置顶策略
   与 WebView mouse tracking 是两条独立链路，不能用恢复其中一条来替代另一条。
6. environment sensor 必须禁止 status level 25、遗漏 macOS 26 跨应用标记、首次显示 / keeper 策略
   漂移或 runtime class-swap 回归。

## 理由

- `canJoinAllApplications` 直接表达跨 App 全屏浮层意图，不需要破坏 Tauri 管理的原生窗口类与
  WKWebView responder / tracking 假设。
- screen-saver level 高于普通全屏内容；只在面积有限、用户显式进入的 cinema 可见期间使用，避免
  普通列表窗口压住其他 App 或系统交互。
- 首次显示与 keeper 共用策略函数，消除旧实现中两份 level / bitmask 魔法数字发生漂移的风险。

## 后果

- macOS 26 上 cinema 可以加入并覆盖其他 App 的原生全屏 Space，同时保留 0.5.5 已恢复的 hover、
  click、拖动、播放与 seek 事件链。
- 旧 macOS 会获得更高的 screen-saver level 和 legacy 全屏辅助行为，但没有
  `canJoinAllApplications`；发布验收以当前 macOS 26 Production `.app` 为权威。
- screen-saver level 属于高层窗口能力；以后新增窗口时不得复用，只有 label 为 `cinema` 的独立窗口
  可以进入这条原生策略函数。
- 自动化只能锁定策略配置，不能替代 WindowServer 行为验证。发布前必须分别验证“先影院后 Chrome
  全屏”和“Chrome 已全屏后进入影院”。

## 验证结果

DEV 原生日志确认 level 1000 与全部 collection behavior 已写入独立标准窗口，但用户按“先影院、
再 Chrome 原生全屏”实测仍完全不可见。该方案因此否决；高 level 与 macOS 26 新 bit 不得作为
“写入成功即覆盖成功”的替代证据。
