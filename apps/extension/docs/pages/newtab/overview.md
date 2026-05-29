# Newtab / UI Preview 概览

> 目的: 说明 Preview 页面为什么存在、能解决什么问题、不能替代什么验证
>
> 源码路径: `src/pages/newtab/`
>
> 覆盖范围: mock 数据来源、可模拟状态、与真实内容脚本的关系

## 源码定位

- 主路径: `src/pages/newtab/Newtab.tsx`
- 相关路径: `src/pages/content/components/`

## 当前职责

这个页面是字幕面板的实验室。它直接复用内容脚本中的大部分 UI 组件，通过 mock 数据和本地 state 模拟字幕面板，目的是降低 UI 迭代成本。

## 当前提供的能力

- 模拟 loaded / loading / empty / error / ad 五种状态
- 提供足够长的 mock 字幕列表验证滚动和返回活动项
- 复用 header、item、footer 等组件看整体视觉效果

## 为什么重要

真实内容脚本依赖 YouTube 宿主页面。每次为了调一个间距、hover、阴影或列表状态都去重载扩展，会显著拉低开发速度。Preview 页面把这部分成本降下来了。

## 使用边界

Preview 页面不能证明以下行为正确：

- YouTube 页面生命周期
- 字幕抓取
- 播放器同步
- 广告检测
- Shadow DOM 下的所有细节

涉及这些点时，仍要回到内容脚本环境验证。

## 相关文档

- [内容脚本概览](../content/overview.md)
- [内容脚本 setup](../content/setup.md)
- [Popup 概览](../popup/overview.md)
