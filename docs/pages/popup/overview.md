# Popup 概览

> 目的: 说明扩展弹窗现在真正承担什么职责，避免把它误当成完整功能页
>
> 源码路径: `src/pages/popup/`
>
> 覆盖范围: popup 的当前状态、入口动作和与 preview 页的关系

## 源码定位

- 主路径: `src/pages/popup/Popup.tsx`

## 当前职责

当前 popup 很轻，主要提供两个快捷入口：

- `AI Settings`：打开正式设置页
- `UI Preview`：打开独立预览页

## 当前行为

- 显示 ListenUp 的简短说明
- 点击按钮后通过 `chrome.tabs.create()` 打开对应扩展页面
- 打开后自动关闭 popup

## 边界

如果未来要把 popup 做成真实产品入口，这个模块将需要新的独立文档和更完整的架构说明。当前阶段不应该把用户核心能力堆进 popup。

## 相关文档

- [Options 概览](../options/overview.md)
- [Newtab / UI Preview 概览](../newtab/overview.md)
