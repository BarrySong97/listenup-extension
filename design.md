# ListenUp — 设计系统

三个前端面（extension 面板 / desktop 浮窗 / website 落地页）视觉语言不同，**不要把一个面的 token 套到另一个面**。共同点只有：Tailwind v4 的 `@theme`、深浅色对比克制、图标统一用 iconify。

## 三个面的边界

| 面 | 组件库 | 主题来源 | 基调 |
|---|---|---|---|
| Extension 内容脚本 / 页面 | HeroUI **v2** | `apps/extension/src/assets/styles/tailwind.css`（只加了 `--animate-spin-slow`，其余用 HeroUI 默认主题） | 跟随 YouTube 明暗主题 |
| Desktop 浮窗 | 无组件库，手写 | `apps/listenup-desktop/src/styles.css` 的 `@theme` | 深色毛玻璃，macOS 原生质感 |
| Website 落地页 | HeroUI **v3**（catalog 统一版本） | `apps/website/app/globals.css` + `landing.css` 的 `:root` | 纯白 Linear/Vercel 风 |

## 设计 Token

### Desktop（`src/styles.css` 的 `@theme`，唯一权威）

- 背景：`--color-glass: rgba(10,10,13,.7)`（列表模式，header/列表/footer **共用这一个**，不要给局部单独加深）；`--color-glass-cinema: rgba(8,8,8,.32)`（影院模式，配合运行时关闭 vibrancy）
- 描边：`--color-hairline: rgba(255,255,255,.09)`
- 前景：`--color-fg: rgba(255,255,255,.94)` / `--color-fg-muted: .58` / `--color-fg-faint: .34`
- 交互底色：`--color-wash: rgba(255,255,255,.08)` / `--color-wash-active: .11`
- 语义色：`--color-yt: #ff0033`（当前句红点、YouTube 标志）/ `--color-ok: #30d158`（已连接）
- 字体：`--font-sans` = SF Pro Text / PingFang SC 系统栈

### Website（`app/landing.css` 的 `:root`）

- 中性阶：`--ink #0a0a0a` → `--ink-2 #404040` → `--ink-3 #737373` → `--ink-4 #a3a3a3`；分隔线 `--line #e5e5e5` / `--line-2 #ededed`
- 背景：`--bg #ffffff` / `--bg-soft #fafafa`；强调色就是墨色本身（`--accent #0a0a0a`，反白文字 `--accent-ink`）
- 圆角：`--radius-sm 6px` / `--radius 10px` / `--radius-lg 14px`
- 阴影：`--shadow-sm/md/lg` 三档，`lg` 用于悬浮的产品截图卡
- 字体：Geist Sans（正文）/ Geist Mono（版本号等元信息）/ Instrument Serif（点缀）

### Extension

没有自定义色板——**刻意的**：面板要融进 YouTube，颜色跟随 HeroUI v2 默认主题 + YouTube 的明暗态。新增颜色前先确认在 YouTube 深浅两种主题下都成立。

## 布局

- Extension 面板：挂在 YouTube 右侧栏位置，宽度随宿主布局；Explain 卡片是面板内的绝对定位覆盖层（`absolute inset-y-0 right-0`，`max-w-[26em]`）
- Desktop：无边框透明窗口，两种形态（列表 / 影院）各自记住尺寸，持久化在 `localStorage`
- Website：主容器 `max-w-[1180px]`，`lg` 断点切两栏；标题用 `clamp(42px,6vw,66px)`

## 组件规范

- **按钮**：Extension 一律 `onPressStart`（Shadow DOM 下 `onPress` 不稳，见 [ADR-0001](docs/decisions/0001-content-script-shadow-dom.md)）；Desktop 用 `.lu-iconbtn` 样式的图标按钮
- **下拉 / overlay**：Extension 必须用 `src/components/ui/Dropdown.tsx`，不要直接用 HeroUI Dropdown
- **列表**：字幕列表两端都用 `virtua` 的 `VList`；自动居中用 `scrollToIndex(i, { align: "center", smooth })`，切视频后的首跳不做平滑动画
- **图标**：`@iconify/react` 的 `mdi:*`，不手写 SVG（website 落地页的品牌 mark 例外，走 `@listenup/mock-ui` 的 `icons.tsx`）
- **状态四态**：loading / empty / error / ad —— Extension 由 `SubtitleStates` 统一渲染，预览页可逐个切换

## 交互与动效

- 面板与卡片入场用 framer-motion，Explain 卡片 `x: 40 → 0` 滑入
- Desktop 影院模式工具条：进入后先显示 3 秒再淡出，之后 hover 显示
- 滚动条只在滚动时可见（thumb 平时透明，靠 `.scrolling` class 切换）

## 无障碍

- Desktop mock 与真实窗口都给容器 `role="figure"` / `aria-label`；纯装饰图标 `aria-hidden`
- 深色毛玻璃上的次要文字不要低于 `--color-fg-faint`（.34 透明度）——再低在浅色桌面背景上不可读
- 键盘可达性目前是弱项：Extension 面板的字幕条与工具条尚未做完整键盘导航，新增交互时至少不要再降低可达性
