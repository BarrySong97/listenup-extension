# Popup 概览

> 目的: 说明扩展弹窗现在真正承担什么职责，避免把它误当成完整功能页
>
> 源码路径: `src/pages/popup/`
>
> 覆盖范围: popup 的当前状态、入口动作和与 preview 页的关系

## 源码定位

- 主路径: `src/pages/popup/Popup.tsx`

## 当前职责

当前 popup 很轻，它的主要作用是显示一个简短说明，并把用户带到 `src/pages/options/index.html`。这个入口本质上是为了开发和视觉调试服务，而不是正式的 end-user settings 面板。

## 当前行为

- 显示 ListenUp 的简短说明
- 点击按钮后通过 `chrome.tabs.create()` 打开 preview 页面
- 打开后自动关闭 popup

## 边界

如果未来要把 popup 做成真实产品入口，这个模块将需要新的独立文档和更完整的架构说明。当前阶段不应该把用户核心能力堆进 popup。

## 相关文档

- [Options 概览](../options/overview.md)
- [Newtab / UI Preview 概览](../newtab/overview.md)
