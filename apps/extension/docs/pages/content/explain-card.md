# Explain 卡片

选中字幕中的文字后点击浮动工具条的 "Explain"，面板右侧会滑出一张解释卡片。

## 触发路径

1. `SubtitleItem` 内监听 `selectionchange`，选中文本时在字幕条内渲染浮动工具条（Copy / Explain）。
2. 点击 Explain 调用 `onRequestExplain({ text, context })` 上抛到 `subtitles.tsx`。
3. `subtitles.tsx` 在写入 `explainTarget` 前会先暂停当前视频，并注入当前 `videoId`，避免用户边听边读 explain 卡片时错过后续内容。
4. `subtitles.tsx` 把目标写入 `explainTarget`，`useExplain(target)` 自动发起请求。
5. `ExplainCard` 根据 `target / data / loading / error / images` 渲染。

## 数据流

- `useExplain` (`src/pages/content/hooks/useExplain.ts`)：
  - 先读 `chrome.storage.local.ai_settings`，缺 API key → 抛 `MissingApiKeyError`
  - 先查 explain 缓存（TTL 7 天，同一视频里的同一选词直接命中）；未命中 → 调 `fetchExplain` (`src/services/ai/explainClient.ts`)
  - 并行触发图片搜索：先查图片缓存（TTL 1 天）→ `searchImages` → 通过 `chrome.runtime.sendMessage` 把 Bing/Google/Baidu 的 HTML 抓取委托给 background service worker，再在前端解析
  - `refresh()` 会忽略两层缓存重跑
- AI 请求使用 Vercel AI SDK `generateObject` + `@ai-sdk/openai-compatible`，走 OpenAI 兼容协议。Schema / prompt 见 `src/services/ai/explainSchema.ts` 与 `explainPromptBuilder.ts`。

## UI 约定

- 卡片作为 `motion.div#listenup` 内的绝对定位覆盖层（`absolute inset-y-0 right-0`），宽度 `max-w-[26em]`；使用 framer-motion 从 x:40 → x:0 滑入。
- Explain 卡片头部提供 `AI Settings / Refresh / Close` 三个操作；缺 key 或请求失败时，错误区也会给出 `Open AI Settings` 入口。
- `AI Settings` 不再跳新标签页，而是在内容脚本面板内再滑出一张右侧设置卡片；header 菜单里的 `AI settings` 也复用同一个入口。
- Explain 加载分三段：请求刚发出时先显示 skeleton；收到流式文本后，Meaning 和 Details & Usage 的正文区域会直接切成原始 JSON 文本；等 JSON 完整并通过 schema 解析后，再替换成正式的 Meaning / Details / Visual Reference UI。
- 音标胶囊点击即调用 `speechSynthesis`（`src/services/tts/speak.ts`）做美/英音朗读，依赖浏览器内置 voices。
- "More Images on Internet" 链接由 `buildWebSearchUrl(engine, query)` 生成，当前引擎来自设置页。
- 所有 HeroUI 交互按钮使用 `onPressStart`（Shadow DOM 稳定约定）。
- 发生错误时（缺 API key / 网络错 / 模型返回不合 schema）在卡片内以红色条显示 `error`。

## 缓存键

- explain：`videoId | normalizedText | model`
- images：`engine :: normalizedQuery`

缓存都存 `chrome.storage.local`，键分别是 `explain_cache` 与 `image_search_cache`。过期条目在读时被清理。

## 开发联调

- Newtab 预览（`pnpm dev:extension` → `chrome-extension://<id>/src/pages/newtab/index.html`）里有 "Show Explain Card" 按钮，可在不联网的情况下用 mock 数据循环切换 loaded / loading / error / hidden 四种状态。
- 真实联调需先在 Options 页填入 base URL / API key / model，然后回到 YouTube 视频页选词触发。
