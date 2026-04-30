# Options 概览

> 目的: 说明 options 页现在是正式 AI 设置入口，而不是 preview 页的别名
>
> 源码路径: `src/pages/options/`
>
> 覆盖范围: options 当前角色、与 preview 页的分工、用户入口

## 源码定位

- 主路径: `src/pages/options/Options.tsx`

## 当前职责

`Options.tsx` 现在承载真正的 AI 设置表单，用来配置 Explain 卡片所需的 base URL、API key、model 和图片搜索引擎。

## 与 Preview 的分工

- `options`：正式设置入口，面向真实使用
- `newtab`：UI Preview / 调试入口，面向开发迭代

Options 页顶部保留了一个 `Open UI Preview` 按钮，方便在配置完成后切回独立预览页面继续调样式。

## 用户入口

- 浏览器扩展 popup 中可直接打开 `AI Settings`
- `options` 页面仍是完整设置页入口
- 内容脚本面板 header 的设置菜单里提供 `AI settings`，会在面板内右侧滑出设置卡片
- Explain 卡片头部和错误态也复用同一个右侧设置卡片入口

## 相关文档

- [Popup 概览](../popup/overview.md)
- [Newtab / UI Preview 概览](../newtab/overview.md)
