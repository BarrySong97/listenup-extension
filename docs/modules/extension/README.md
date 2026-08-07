# extension（`apps/extension/`）

## 职责

Manifest V3 浏览器扩展，在 YouTube watch 页面注入一个字幕学习面板：抓取并处理字幕、与播放器时间同步、支持逐句跳转 / 循环 / 录音，选中文本可弹出 AI 解释卡片。

边界：**管** YouTube 页面内的字幕体验、AI 解释、扩展自身的设置与预览页；**不管** 后端服务、桌面窗口的渲染（那是 [listenup-desktop](../listenup-desktop/README.md)）、商店发布流程。

虽然 `manifest.json` 的 `content_scripts.matches` 是 `<all_urls>`，真正的 React UI 只在 `index.tsx` 检测到 `youtube.com` 时才初始化——**注入范围宽，运行范围窄**。

## 文件清单与关系

```
src/pages/content/     内容脚本，产品主体
  index.tsx            建 Shadow DOM、注样式、挂 React
  app.tsx              监听 yt-navigate-finish，只在 watch 页渲染
  components/          面板 UI（Header/Item/Footer/States/ExplainCard/…）
  hooks/               播放器、滚动、字幕加载、录音、Explain 的行为封装
  lib/captions/        字幕轨发现与 URL 构建
  lib/subtitle-domain/ 加载编排、缓存、传输、错误
  lib/subtitles/       纯解析 / 清洗 / 合并（无副作用）
  lib/youtube-sdk/     播放器与广告状态探测
src/pages/popup/       扩展图标弹窗，两个跳转入口
src/pages/options/     正式 AI 设置页
src/pages/newtab/      UI Preview（mock 数据调面板）
src/pages/devtools/    最小 DevTools 面板入口
src/pages/background/  service worker（图片搜索代理 + Native Messaging 转发）
src/components/ui/     跨页面共享基础件（Dropdown / iconScale）
src/components/ai/     AiSettingsForm（options 页与面板内设置卡片共用）
src/services/ai/       Explain 请求、缓存、prompt、schema、设置读写
src/services/search/   图片搜索与缓存
src/services/tts/      speechSynthesis 朗读
src/shared/            与桌面端共享的 Native Messaging 协议定义
public/scripts/        注入页面上下文的桥接脚本（web-accessible）
```

调用关系：`app.tsx → components/subtitles.tsx → useSubtitles → SubtitleRepository → {captions 来源, SubtitleTransport, SubtitleProcessor, SubtitleCache}`

## 数据流

1. 浏览器按 `manifest.json` 注入内容脚本
2. `index.tsx` 判域名 → 建 `#__listenup-extension-host` + Shadow Root → 注入 `style.css?inline`（`rem`→`em`）
3. `app.tsx` 监听 SPA 导航，watch 页渲染 `Subtitles`，用 `videoId` 作 key 强制重建
4. `components/subtitles.tsx` 启动 `youtubeSDK`，同步播放时间 / 主题 / 广告态，调 `useSubtitles`
5. `SubtitleRepository` 聚合轨道来源 → 下载 → 解析 → 清洗合并 → 写缓存
6. UI 按当前字幕索引驱动高亮、自动滚动、循环、复制
7. `useNativeSubtitleBridge` 把 session / cursor 交给 background；background 也把 Desktop 的
   播放 / 暂停 / 字幕 seek 命令精确转发回来源标签页

## 对外接口

- 浏览器侧：`manifest.json` 声明的 popup / options / devtools 页面、内容脚本、`web_accessible_resources`
- 对桌面端：`src/shared/nativeSubtitleProtocol.ts` 定义的 v4 双向 session / cursor /
  playback command-result 消息（见 [Native Messaging 专题](../../topics/native-messaging.md)）
- 对用户数据：`chrome.storage.local` 的 `ai_settings` / `explain_cache` / `image_search_cache` / 字幕缓存

## 注意事项

- Shadow DOM 下 HeroUI 部分交互不稳，按钮用 `onPressStart`，下拉用自建 `Dropdown.tsx`。详见 [faq.md](faq.md)
- `src/locales/` 的 i18n 默认关闭，只有在 `vite.config.base.ts` 打开 `localize` 才参与构建
- 扩展用 HeroUI **v2**，website 用 v3 走 pnpm catalog——不要互相串版本
- `dist_chrome*/`、`dist_firefox/`、`public/manifest.json` 都是生成物

## 子页

- [content.md](content.md) — 内容脚本分层与字幕链路（最常改的地方）
- [explain-card.md](explain-card.md) — Explain 卡片触发路径、缓存与降级
- [ai-settings.md](ai-settings.md) — AI 设置字段、连通性测试与排错
- [entry-pages.md](entry-pages.md) — popup / options / newtab / devtools 四个轻量入口
- [build-and-manifest.md](build-and-manifest.md) — MV3 权限、Chrome/Firefox 构建差异、本地加载
- [youtube-sdk.md](youtube-sdk.md) — 播放器与广告状态探测 SDK
- [faq.md](faq.md) — Shadow DOM / SPA / 字幕抓取的坑
