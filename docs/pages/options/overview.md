# Options 概览

> 目的: 解释为什么 options 页目前几乎不包含独立逻辑，以及它和 preview 页的关系
>
> 源码路径: `src/pages/options/`
>
> 覆盖范围: options 当前角色、转发关系和未来扩展提醒

## 源码定位

- 主路径: `src/pages/options/Options.tsx`

## 当前职责

`Options.tsx` 目前只是直接返回 `Newtab` 组件，因此 options 页本质上是 UI Preview 的另一个入口，而不是一个独立的设置系统。

## 为什么这样做

浏览器扩展里 options 页更适合承载一个完整独立页面。当前项目借用了这一点，把预览工具挂在 options 下，方便：

- 从 popup 直接打开
- 不依赖 YouTube 环境快速验证 UI

## 后续扩展

如果未来真的加入用户设置，这里应当重新拆分：

- 预览工具保留在单独页面
- options 页改为真实设置面板

## 相关文档

- [Popup 概览](../popup/overview.md)
- [Newtab / UI Preview 概览](../newtab/overview.md)
