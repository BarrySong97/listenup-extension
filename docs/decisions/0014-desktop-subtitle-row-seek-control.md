# 0014. Desktop 字幕行通过既有 Native 控制链路跳转视频

- 状态：已采纳
- 日期：2026-08-07

## 背景

Desktop 已能通过按 bridge/session 精确路由的 Native Messaging v4 命令播放或暂停 YouTube，
但完整字幕列表仍是只读展示。播放器适配层已有 `seekTo()`，Extension 也会在 `seeking` 和
`seeked` 时立即发送 cursor；缺少的是从 Desktop 字幕行到该能力的安全命令契约。

译文与双语可能按 AI 语义重组字幕块，因此 Desktop 不能假设显示行索引与 YouTube 原始字幕索引
一致。直接在 GUI 乐观修改 cursor 也会在播放器拒绝、广告或 session 切换时制造假高亮。

## 决策

1. Native Messaging v4 的 `playbackCommand` 以加法扩展 `seek` action；seek 必须携带有限、非负
   的 `seekTime`，play/pause 不得携带它。无需为这个可选 action 升协议版本。
2. Desktop 点击任意原语、译文或双语显示块时发送该块自身的 `startTime`。这只提供字幕块定点
   跳转，不开放任意进度条、音量或倍速遥控。
3. 命令继续携带并逐层校验 bridgeId、tabId、sessionId、videoId 与 commandId；广告、断连、
   无 cursor、多视频未选择或 pending 时不允许发起。
4. Rust 与 Extension 协议守卫都校验 action/时间组合；content 最终调用当前页面真实播放器的
   `seekTo()`，失败沿既有 command result 返回。
5. seek 不改变播放器原有播放/暂停状态，也不在 Desktop 乐观修改时间或高亮。只有随后真实
   `seeking` / `seeked` cursor 才驱动红点、已播放边界与自动滚动。
6. 字幕行使用专用 `DesktopRowButton` 的原生 button 语义，支持鼠标、Enter 和 Space；现有三列
   视觉保留，只增加整行 hover、focus-visible 与 disabled 反馈。这里是 HeroUI 基础组件规则的
   明确热路径例外：React Aria Button 的 `useHover` 会在逐行移入时触发 state render。列表仍只
   接收稳定 callback/primitive，不接收连续时间。毛玻璃窗口的 hover 背景使用预创建的独立层，
   CSS 只切换其 opacity，并以 paint containment 避免重绘字幕文字与更大的 vibrancy 区域。

## 理由

- 复用现有双向链路可保留跨 Chrome Profile 的精确路由与统一错误、超时处理。
- 显示块的 `startTime` 同时适用于原语和 AI 重组译文，不需要反推不稳定的原始行索引。
- 真实 cursor 作为唯一事实源，能让点击跳转与 YouTube 自带进度条跳转保持同一同步语义。
- 原生 button 保留键盘和禁用语义，并避免 React Aria hover state 破坏 memo 与 virtua 热路径。

## 后果

- 使用字幕 seek 需要 Extension 与 Desktop 都升级到包含该 action 的版本；旧 Desktop 的
  play/pause 与新 Extension 仍兼容。
- 协议自动化必须覆盖合法 seek、缺失/负数/非有限时间和 play/pause 夹带 seekTime。
- UI 棘轮测试必须阻止字幕行重新依赖 HeroUI / React Aria hover state 或背景 transition。
- 手工回归必须同时覆盖播放中、暂停中、译文/双语、广告、断连和多 Profile 精确路由。
- 100ms cursor 下的视觉性能验收使用 production frontend bundle；React Development 的额外检查、
  未压缩模块与 HMR 可能占用 WKWebView 主线程，不能把其 hover 帧率等同于发布版。
