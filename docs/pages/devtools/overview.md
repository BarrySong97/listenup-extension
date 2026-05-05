# DevTools 概览

> 目的: 说明当前 DevTools 模块实际只有一个最小入口，避免误判其能力
>
> 源码路径: `src/pages/devtools/`
>
> 覆盖范围: DevTools 面板初始化方式和当前限制

## 源码定位

- 主路径: `src/pages/devtools/index.ts`
- 相关路径: `src/pages/devtools/index.html`

## 当前职责

当前 DevTools 模块只是在浏览器 DevTools 中注册一个名为 `Dev Tools` 的面板。它没有复杂的状态管理，也没有承接主要产品逻辑。

## 适合放什么

如果未来要补开发辅助工具，例如字幕调试、日志导出、播放器状态面板，这里是合理入口。但在当前代码里，它仍属于预留扩展面。

## 相关文档

- [页面模块文档索引](../README.md)
- [内容脚本测试](../content/testing.md)
