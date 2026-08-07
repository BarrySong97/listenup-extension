# 0012. Desktop 业务交互统一经过 HeroUI 3 primitives

- 状态：已采纳
- 日期：2026-08-07

## 背景

Desktop 的按钮、图标操作、字幕模式切换和目标语言选择原先直接散落为原生 `button` /
`select`。相同的尺寸、禁用态和焦点行为重复定义，纯图标操作还依赖浏览器原生 `title`，
难以保证每个入口都有一致 Tooltip。直接在所有业务组件中改用 HeroUI 仍会让 variant、样式覆盖
和提示参数继续分散。

仓库 workspace catalog 已统一 HeroUI 3.1.0，Website 使用同一 catalog；Extension 仍有自己
既有的 HeroUI 2 依赖和 Shadow DOM 约束。Desktop 需要复用 catalog 版本，但不能把三端 UI
迁移混成一次跨模块重构。

## 决策

1. Desktop 通过 `catalog:` 使用 `@heroui/react` 与 `@heroui/styles`，不声明私有版本。
2. Desktop 业务组件只使用 `components/ui/` 中的 HeroUI primitives：
   `DesktopButton`、`DesktopIconButton`、`SubtitleModeControl`、`TargetLanguageSelect`。
3. HeroUI 提供交互、焦点和无障碍语义；现有 Tailwind token、像素尺寸、透明度和毛玻璃视觉
   继续由 Desktop 样式决定，不采用 HeroUI 默认视觉重设计产品。
4. 所有纯图标操作必须经过 `DesktopIconButton`，同时提供 Tooltip 与 aria label。带可见文字的
   按钮和纯展示图标不重复制造 Tooltip。
5. 除 primitives 目录外，Desktop 业务 TSX 禁止直接出现原生 `button` 或 `select`；Node test
   扫描这一边界并在回归时失败。
6. 本决策只约束 Desktop。Website 保持 HeroUI 3 的现有使用方式；Extension 的 HeroUI 2 与
   Shadow DOM `onPressStart` / Dropdown 红线不在本次迁移范围。

## 理由

- 单一适配层能在不改变现有视觉的情况下统一 HeroUI 事件和状态语义。
- `DesktopIconButton` 的必填 props 比逐页检查 `title` 更可靠，禁用按钮也能解释不可用原因。
- workspace catalog 避免 Desktop 和 Website 漂移出两套 HeroUI 3 版本，同时允许 Extension
  在单独迁移前继续保留 v2。
- 可执行的原生元素扫描比只写文档更能防止未来业务组件绕过 primitives。

## 后果

- Desktop 前端 bundle 会包含 HeroUI 3 / React Aria 交互实现，体积高于原生控件版本；当前以
  统一交互和可访问性优先，构建仍只产生一个本地 Tauri 页面。
- HeroUI 升级需要先在 primitives 层验证 Button、Tooltip、ToggleButtonGroup 和 Select，
  业务组件不直接适配版本差异。
- 若未来确需新的原生交互元素，应先扩充 primitives，而不是放宽扫描测试。
