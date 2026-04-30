# ListenUp 系统总览

> 目的: 用一篇文档解释这个扩展在做什么、主要运行面有哪些、核心链路如何串起来
>
> 源码路径: `manifest.json`, `src/pages/content/`, `src/pages/popup/`, `src/pages/newtab/`, `src/pages/options/`, `src/pages/devtools/`
>
> 覆盖范围: 产品职责、入口页面职责、内容脚本的高层数据流，不深入到某个 hook 或组件的实现细节

## 源码定位

- 主路径: `manifest.json`
- 相关路径: `src/pages/content/`
- 相关路径: `src/pages/popup/`
- 相关路径: `src/pages/newtab/`

## 这个项目是什么

ListenUp 是一个 Manifest V3 浏览器扩展。它的核心价值不是“通用扩展框架”，而是在 YouTube 页面上注入一个字幕学习面板，围绕字幕做阅读、跳转、循环播放、录音和复制解释 prompt。

虽然 `manifest.json` 当前把内容脚本匹配到了 `<all_urls>`，但真正的 React UI 只会在 `index.tsx` 里检测到 `youtube.com` 时初始化。也就是说，权限和注入范围目前偏宽，运行时逻辑仍然把 YouTube watch 页面当成唯一有效宿主。

## 主要运行面

- `src/pages/content/`: 真正的产品主界面，运行在 YouTube 页面内的 Shadow DOM
- `src/pages/popup/`: 扩展图标弹窗，目前主要用来打开 UI Preview
- `src/pages/options/`: Explain / AI 能力的正式设置页
- `src/pages/newtab/`: 面板实验室，脱离 YouTube 也能迭代组件视觉和状态
- `src/pages/devtools/`: 一个最小 DevTools 面板入口，当前内容很轻

## 核心链路

1. 浏览器根据 `manifest.json` 注入内容脚本。
2. `src/pages/content/index.tsx` 检查当前域名是否包含 `youtube.com`。
3. 命中后创建 `#__listenup-extension-host`，挂载 Shadow Root，并把 `style.css` 以 inline 方式注入。
4. `src/pages/content/app.tsx` 监听 `yt-navigate-finish`，只在 watch 页面渲染字幕面板。
5. `components/subtitles.tsx` 启动 `youtubeSDK`，同步播放器时间、主题和广告状态，并调用 `useSubtitles` 触发字幕加载。
6. `useSubtitles` 通过 `SubtitleRepository` 聚合字幕轨道发现、URL 构建、下载、解析、清洗、合并和缓存。
7. UI 组件基于当前字幕索引驱动逐句高亮、自动滚动、循环播放和复制操作。

## 为什么预览页单独存在

内容脚本依赖 YouTube DOM、播放器状态和 Shadow DOM，直接在页面里调样式的反馈循环很慢。`src/pages/newtab/Newtab.tsx` 把主要字幕组件重新装配到一个独立页面里，并用 mock 数据模拟 loaded / loading / empty / error / ad 等状态，方便快速迭代视觉和交互。

现在 `options` 和 `newtab` 已经拆分：

- `options` 面向真实使用，用来配置 AI provider
- `newtab` 面向开发调试，用来做独立 UI Preview

`popup` 同时暴露这两个入口，内容脚本里的 Explain 卡片和 header 菜单也能直接跳到设置页。

## 相关文档

- [仓库结构](repo-layout.md)
- [运行时、权限与构建](runtime-permissions-and-builds.md)
- [内容脚本概览](../pages/content/overview.md)
