# 内容脚本架构

> 目的: 解释内容脚本从初始化到字幕渲染的主要执行链路，帮助协作者在改动时知道该落在哪一层
>
> 源码路径: `src/pages/content/`
>
> 覆盖范围: 初始化、状态同步、字幕加载与处理、UI 分层，不覆盖每个组件的细枝末节

## 源码定位

- 主路径: `src/pages/content/index.tsx`
- 相关路径: `src/pages/content/components/subtitles.tsx`
- 相关路径: `src/pages/content/hooks/useSubtitles.ts`
- 相关路径: `src/pages/content/lib/subtitle-domain/SubtitleRepository.ts`

## 初始化链路

1. `index.tsx` 检查当前页面是否属于 `youtube.com`。
2. 创建 `#__listenup-extension-host`，并在其上挂载 Shadow Root。
3. 以 `style.css?inline` 方式引入内容脚本样式，并把所有 `rem` 替换成 `em`。
4. 使用 `Provider` 和 `HeroUIProvider` 渲染 `App`。
5. `app.tsx` 监听 `yt-navigate-finish`，当路径符合 watch 页面时渲染 `Subtitles`，并用 `videoId` 作为 key 强制重建状态。

## 面板装配层

`components/subtitles.tsx` 是内容脚本内部的装配根，它负责：

- 启动 `youtubeSDK`
- 监听主题、广告、播放器状态和会话变化
- 调用 `useSubtitles` 加载字幕
- 协调当前字幕索引、自动滚动、循环播放和面板布局

它既是“容器组件”，也是当前模块的主要编排层。

## 字幕加载层

`useSubtitles` 自身不处理字幕细节，只负责：

- 根据 `enabled` 和 `videoId` 触发加载
- 通过 `AbortController` 中断旧请求
- 调用 `subtitleRepository.load()`
- 将成功/失败结果映射为 React 状态

真正的领域逻辑在 `lib/subtitle-domain/`：

- `SubtitleRepository`: 聚合字幕轨来源、选择策略、下载、解析、缓存和处理
- `SubtitleProcessor`: 读取清洗/合并配置并调用纯处理逻辑
- `SubtitleCache`: 基于 `chrome.storage.local` 做配置感知缓存
- `SubtitleTransport`: 先直接拉取字幕文档，失败时再走页面桥接

## 字幕轨发现层

字幕轨来自两个来源：

- `playerResponseCaptionSource`
- `bridgeCaptionSource`

`SubtitleRepository` 会合并两边结果、去重并根据来源能力做偏好选择。它还包含一次针对 `pot` 参数缺失的重试逻辑，避免 YouTube 刚进入页面时拿到不完整的 track URL。

## 纯处理层

`lib/subtitles/` 承担无副作用的字幕处理逻辑：

- `subtitleParser.ts`: 自动识别 JSON / XML / WebVTT
- `subtitleCleaner.ts`: 去噪
- `subtitleMerger.ts`: 合并短句和相邻片段
- `subtitleConfig.ts`: 读取本地处理配置

这层比较适合未来抽离测试，因为它对 DOM 和浏览器 API 依赖最弱。

## UI 层次

- `SubtitleHeader`: 整体复制和下载
- `SubtitleItem`: 单条字幕交互
- `SubtitleFooter`: 录音和循环控制
- `SubtitleStates`: loading / error / empty / ad 状态
- `ActiveSegmentPanel`, `PlaybackDivider`, `ReturnToActiveButton`: 面板辅助交互

## 相关文档

- [内容脚本概览](overview.md)
- [内容脚本 setup](setup.md)
- [系统总览](../../architecture/system-overview.md)
