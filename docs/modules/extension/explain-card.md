# Explain 卡片

选中字幕中的文字后点击浮动工具条的 "Explain"，面板右侧滑出一张解释卡片（词性 / 音标 / AI 讲解 / 图片参考）。

## 触发路径

1. `SubtitleItem` 监听 `selectionchange`，选中文本时在字幕条内渲染浮动工具条（Copy / Explain）
2. 点 Explain → `onRequestExplain({ text, context })` 上抛到 `subtitles.tsx`
3. `subtitles.tsx` **先暂停当前视频**，注入当前 `videoId`，再写入 `explainTarget`
4. `useExplain(target)` 自动发起请求
5. `ExplainCard` 按 `target / data / loading / error / images` 渲染

## 数据流（`hooks/useExplain.ts`）

- 先读 `chrome.storage.local.ai_settings`，缺 API key → 抛 `MissingApiKeyError`
- 查 explain 缓存（TTL 7 天，同视频同选词直接命中）；未命中 → `fetchExplain`（`src/services/ai/explainClient.ts`）
- 并行触发图片搜索：查图片缓存（TTL 1 天）→ `searchImages` → 通过 `chrome.runtime.sendMessage` 把 Bing / Google / Baidu 的 HTML 抓取**委托给 background service worker**，再在前端解析
- `refresh()` 忽略两层缓存重跑

AI 请求走 `@ai-sdk/openai-compatible` + AI SDK 的 `streamText`（OpenAI 兼容协议）：**流式拿纯文本 → `extractJson()` 从文本/代码块里抠出 JSON → 用 `ExplainResultSchema` 校验**。Schema 与 prompt 见 `src/services/ai/explainSchema.ts` 和 `explainPromptBuilder.ts`。

这样做是因为不少 OpenAI-compatible 网关只是"看起来兼容"，不完整支持 schema / `response_format`，走文本提取反而更稳。

⚠️ **已知遗留**：`fetchExplain` 外面还包着一层 `catch` + `shouldFallbackToTextMode()` 的"降级"分支，但它 `catch` 里重试的是**同一个** `fetchExplainFromTextStream`——结构化输出那条路径已经被移除，只剩下这一条。所以那层实际效果只是"对疑似 schema 类错误重试一次"。改这块时别被函数名误导。

## 缓存键

- explain：`videoId | normalizedText | model` → `chrome.storage.local.explain_cache`
- images：`engine :: normalizedQuery` → `chrome.storage.local.image_search_cache`

过期条目在读取时清理。

## UI 约定

- 卡片是 `motion.div#listenup` 内的绝对定位覆盖层（`absolute inset-y-0 right-0`，`max-w-[26em]`），framer-motion 从 `x:40 → x:0` 滑入
- 头部三个操作：`AI Settings` / `Refresh` / `Close`；缺 key 或失败时错误区也给 `Open AI Settings` 入口
- `AI Settings` **不跳新标签页**，在面板内再滑出一张右侧设置卡片；header 菜单里的 `AI settings` 复用同一入口
- 加载分三段：skeleton → 收到流式文本后 Meaning / Details 区直接显示原始 JSON 文本 → JSON 完整并通过 schema 解析后替换成正式 UI
- 音标胶囊点击调 `speechSynthesis`（`src/services/tts/speak.ts`）做美 / 英音朗读，依赖浏览器内置 voices
- "More Images on Internet" 由 `buildWebSearchUrl(engine, query)` 生成，引擎来自设置
- 所有 HeroUI 交互按钮用 `onPressStart`

## 开发联调

- 预览页（`pnpm dev:extension` → `chrome-extension://<id>/src/pages/newtab/index.html`）有 "Show Explain Card" 按钮，用 mock 数据离线循环切 loaded / loading / error / hidden
- 真实联调需先在 Options 页填 base URL / API key / model，再回 YouTube 选词触发

## 相关

- [AI 设置](ai-settings.md) · [内容脚本分层](content.md)
