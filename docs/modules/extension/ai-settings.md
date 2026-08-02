# AI 设置

Options 页（`apps/extension/src/pages/options/Options.tsx`）和面板内滑出的设置卡片共用同一个表单组件 `src/components/ai/AiSettingsForm.tsx`。数据存 `chrome.storage.local`，键为 `ai_settings`。

## 字段

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `baseUrl` | `https://api.openai.com/v1` | OpenAI 兼容端点（OpenAI / Groq / OpenRouter / Azure / 自托管） |
| `apiKey` | 空 | **明文存储**；UI 默认遮挡，点眼睛切换显示 |
| `model` | `gpt-4o-mini` | 任何兼容 `/v1/chat/completions` 且能返回 JSON 的模型 |
| `imageSearchEngine` | `bing` | `bing` / `google` / `baidu`，用于 Explain 卡片的 Visual Reference 区 |

读写逻辑在 `src/services/ai/aiSettings.ts`。

## Test connection

点击后先保存当前设置，再调 `testAiConnection`——它跑的是一次**完整的 Explain 请求**（选中词 `hello`，上下文 `She waved and said hello.`），所以它同时验证了连通性、模型可用性和 JSON 输出是否能通过 schema。成功显示 `Connected · sample: …`，失败显示报错原文。

## 故障排查

- **401 / 403** — 检查 API key，以及 base URL 是否匹配该 key 的账户体系
- **CORS / network error** — 扩展的 fetch 走扩展上下文；若用自建代理，需要在 `manifest.json` 的 `host_permissions` 里加该域名
- **Invalid JSON / 不符合 schema** — 网关不完整支持结构化输出。当前实现会自动回退到文本 JSON 提取；仍失败就换更强模型（如 `gpt-4o`）或更标准的兼容端点
- **图片栏为空** — 检查 `manifest.json` 权限是否覆盖对应搜索引擎域名，或换一个引擎

## 相关

- [Explain 卡片](explain-card.md) · [入口页面](entry-pages.md)
