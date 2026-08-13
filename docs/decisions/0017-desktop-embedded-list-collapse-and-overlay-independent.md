# 0017. Desktop Embedded 列表收起与视频 Overlay 独立

- 状态：已采纳
- 日期：2026-08-13
- 部分取代：[ADR-0016](0016-desktop-embedded-subtitle-sibling-overlay.md) 第 5 条的单开关耦合行为

## 背景

ADR-0016 首版把“收起底部完整字幕列表”和“在视频上显示当前字幕”合并为一个悬浮字幕开关。
实际用户意图是两个独立选择：用户可能只想扩大视频区域而不覆盖任何字幕，也可能在保留完整列表
时同时查看视频字幕。单状态无法表达这两种组合，并让“收起字幕”按钮的含义变得不可信。

## 决策

1. `App.tsx` 分别维护 `embeddedSubtitleListCollapsed` 与
   `embeddedSubtitleOverlayEnabled`，不得由其中一个状态推导另一个。
2. Embedded 标题栏提供收起 / 展开按钮，只控制 `SubtitleViewer`、Footer、视频填充布局和进入前
   窗口尺寸恢复；使用眼睛图标表达底部模块的显隐动作。
3. 播放按钮旁保留视频悬浮字幕按钮，只控制 iframe 同级 Overlay 的挂载，不调用窗口 resize，
   也不隐藏或显示底部列表。
4. 四种组合都合法：列表展开 / 收起 × Overlay 关闭 / 开启。换链接保持当前两个显式选择；退出
   EmbeddedSource 时 Overlay 关闭，若列表已收起则恢复普通列表尺寸与布局。
5. 静态测试必须分别锁定 `fillAvailableSpace` 由列表收起状态驱动、`overlayEnabled` 由 Overlay 状态
   驱动，防止未来再次耦合。

## 理由

- “收起模块”和“显示另一种字幕”是不同用户动作，独立控制符合按钮承诺。
- Overlay 可能增加阅读价值，但不应成为扩大视频区域的强制代价。
- 两个布尔状态直接表达四种 UI，不需要含糊的复合枚举或隐式副作用。
- 只让列表收起状态触发 resize，缩小了窗口状态与字幕渲染之间的耦合。

## 后果

- 标题栏增加一个 Embedded 专用眼睛按钮，较窄窗口下标题可以继续截断，但操作按钮保持可见。
- 用户收起列表后默认得到纯视频；需要字幕时再单独打开播放按钮旁的字幕图标。
- ADR-0016 的可信 sibling Overlay、pointer、位置持久化和权限边界保持不变。
