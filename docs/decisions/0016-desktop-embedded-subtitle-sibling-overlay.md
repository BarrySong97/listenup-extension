# 0016. Desktop Embedded 字幕使用可信 iframe 同级 Overlay

- 状态：已采纳
- 日期：2026-08-13
- 增量覆盖：[ADR-0015](0015-desktop-same-window-youtube-transports.md) 中“用户操作不改变窗口尺寸”的绝对表述

## 背景

Desktop 通过 YouTube 链接自播时，官方播放器位于跨域 iframe。用户希望收起完整字幕列表后仍能在
视频画面上看到并拖动 ListenUp 当前字幕，但应用不能读取、修改或向 YouTube iframe DOM 注入内容。
原有视频专注模式只留下标题栏与视频，既没有字幕，也把隐藏入口放在视频行标题栏，用户难以发现。

## 决策

1. ListenUp 字幕由可信 `main` React 页面渲染为 `EmbeddedVideoPanel` 内 iframe 的同级 Overlay；
   不修改 loopback 包装页，不把字幕传给 iframe，不读取 YouTube DOM，也不新增 capability。
2. Overlay 根层使用 `pointer-events: none`，只有字幕卡可接收指针；只有独立手柄能通过 Pointer
   Capture 启动拖动，正文保持可选择。YouTube 播放、进度条、音量、设置与全屏仍由 iframe 处理。
3. Overlay 只消费现有 active `DisplayBlock`，跟随原语 / 译文 / 双语选择；不订阅连续
   `currentTime`，字幕间隙不保留上一句，缺译文复用明确的紧凑引导。
4. 位置以扣除卡片尺寸和安全边距后的可移动范围比例保存为版本 1 偏好。ResizeObserver 在视频或
   卡片尺寸变化后重新换算并 clamp；所有 Embedded 视频共用位置，拖动结束或键盘移动结束时才持久化。
5. 开关只在 EmbeddedSource 显示并紧邻 ListenUp 播放按钮。用户显式开启后，应用保存展开尺寸，
   隐藏列表与 Footer，并把窗口缩成“标题栏 + 16:9 视频”；关闭或退出 EmbeddedSource 时恢复。
   进入、换链接、reload 和 Cookie 操作本身仍不得隐式改变窗口尺寸；换链接时显式开启状态保持。

## 理由

- 可信同级层可以形成“字幕在视频里”的视觉效果，同时保持跨域 iframe 与 Tauri 权限隔离。
- 精确 pointer 边界和独立手柄同时满足拖动、文字选择与官方播放器控件可用性。
- 复用现有字幕块与显示偏好避免第二套游标、翻译回退或高频渲染事实源。
- 归一化位置能跨窗口尺寸和字幕高度复用，版本化解析可安全丢弃损坏或未来格式。
- 只有显式开关可以 resize，避免推翻 ADR-0015 对普通 Embedded 生命周期不扰动窗口的约束。

## 后果

- `EmbeddedVideoPanel` 同时组合官方 iframe 与本地字幕层，但播放 transport、包装页和权限不变。
- 字幕卡会覆盖一小块画面；用户可用手柄移动，卡片始终被约束在视频区域内。
- `uiPrimitives.test.ts` 锁定同级层的 pointer、文字选择、Pointer Capture、帧合并和无字幕
  `postMessage` 边界；位置换算由独立 Node tests 覆盖。
- 手工回归必须在真实打包 DEV `.app` 中验证开关、拖动四边、文字选择、YouTube 控件、三种字幕
  模式、窗口恢复、换链接与重启位置记忆。
