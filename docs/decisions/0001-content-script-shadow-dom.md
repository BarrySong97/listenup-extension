# 0001. 内容脚本运行在 Shadow DOM，样式 inline 注入并把 rem 转成 em

- 状态：已采纳
- 日期：2026-07-25（回填历史决策）

## 背景

字幕面板要注入进 YouTube 页面。YouTube 自身样式庞大且随时改版，双向污染风险都很高：我们的样式可能破坏 YouTube 布局，YouTube 的全局 `font-size` / reset 也会把面板尺寸带偏。

## 决策

1. 内容脚本挂在 `#__listenup-extension-host` 上的 **Shadow Root** 里渲染
2. 样式用 `style.css?inline` 以字符串形式注入 Shadow Root，注入时把所有 `rem` 替换成 `em`（`tailwind-rem-to-em.js`）
3. Shadow DOM 下 HeroUI 交互按两条固定约定写：按钮用 `onPressStart` 而非 `onPress`；下拉菜单用自建 `src/components/ui/Dropdown.tsx`，不用 HeroUI Dropdown

## 理由

- Shadow DOM 是浏览器原生的样式隔离，比前缀命名 / CSS-in-JS 作用域更彻底
- `rem` 相对文档根字号，在 Shadow DOM 里**不会**被隔离，宿主改字号面板就变形；`em` 相对自身字号，配合面板根节点设定的基准就能自洽
- HeroUI 的两条约定不是审美偏好，是踩过的坑：`onPress` 依赖的事件在 Shadow 边界上不稳定，HeroUI Dropdown 的 portal 会挂到 Shadow Root 之外导致失去样式

备选方案：iframe 注入（隔离更强，但要处理跨文档通信、尺寸自适应、字体加载，成本远高于收益）；纯类名前缀（挡不住宿主的继承式样式）。

## 后果

- 好处：面板样式与 YouTube 互不干扰；改版风险集中在 `youtube-sdk` 的选择器上，而不是样式上
- 代价：任何依赖 portal / 全局事件的第三方组件都要先在**真实内容脚本**里验证，预览页通过不算数
- 代价：样式里不能直接用 `rem`，也不能绕过 inline 注入改用普通 `<link>` 样式表
- 新增 overlay 类组件时默认怀疑它，别默认信它
