# 内容脚本概览

> 目的: 让协作者在 30 秒内理解 `src/pages/content/` 的职责、边界和主要组成部分
>
> 源码路径: `src/pages/content/`
>
> 覆盖范围: 模块职责、宿主环境、关键依赖、主要子目录，不覆盖实现细节

## 源码定位

- 主路径: `src/pages/content/index.tsx`
- 相关路径: `src/pages/content/app.tsx`
- 相关路径: `src/pages/content/components/subtitles.tsx`

## 模块职责

这个模块负责在 YouTube watch 页面中渲染字幕学习面板，并把以下能力组合起来：

- 发现和下载字幕轨
- 解析、清洗和合并字幕
- 将字幕与播放器时间同步
- 允许逐句跳转、循环播放、录音和复制学习 prompt
- 选中文字后弹出 Explain 卡片（词性 / 音标 / AI 讲解 / 图片参考）
- 根据 YouTube 主题和布局动态调整面板表现

## 边界

它依赖 YouTube DOM、播放器状态和页面桥接，因此不适合直接当成“普通 React 页面”理解。只有 `newtab` 里的 UI Preview 才是脱离宿主环境的演练场。

模块不负责：

- 扩展商店发布流程
- 后端服务或远程 API
- 独立的设置持久化中心之外的大规模全局状态

## 主要入口

- `index.tsx`: 创建 Shadow DOM、注入样式并挂载 React
- `app.tsx`: 监听 YouTube SPA 导航，只在视频页渲染主面板
- `components/subtitles.tsx`: 面板装配根节点

## 主要子目录

- `components/`: 面板 UI 组件
- `hooks/`: 和播放器、滚动、字幕加载相关的行为封装
- `lib/captions/`: 字幕轨发现和 URL 构建
- `lib/subtitle-domain/`: 字幕加载、缓存、处理编排
- `lib/subtitles/`: 纯字幕解析、清洗、合并逻辑
- `lib/youtube-sdk/`: YouTube 页面、播放器、主题和会话状态探测

## 关键依赖

- `@heroui/react`: UI 基础组件
- `framer-motion`: 面板与局部交互动效
- `virtua`: 虚拟列表
- `chrome.storage.local`: 字幕缓存

## 相关文档

- [内容脚本架构](architecture.md)
- [内容脚本 setup](setup.md)
- [内容脚本 FAQ](faq.md)
- [Explain 卡片](explain-card.md)
