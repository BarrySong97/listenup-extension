# AI 设置

Options 页（`src/pages/options/Options.tsx`）提供 Explain 卡片所需的全部配置，数据存 `chrome.storage.local`，键为 `ai_settings`。

## 字段

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `baseUrl` | `https://api.openai.com/v1` | OpenAI 兼容端点（支持 OpenAI / Groq / OpenRouter / Azure / 自托管） |
| `apiKey` | 空 | 明文存储；UI 上默认遮挡，点眼睛切换显示 |
| `model` | `gpt-4o-mini` | 任何兼容 `/v1/chat/completions` 且支持 JSON 输出的模型 |
| `imageSearchEngine` | `bing` | `bing` / `google` / `baidu`，用于 Explain 卡片的 Visual Reference 区 |

## Test connection

点击后会保存当前设置并调用 `testAiConnection`（跑一次 `hello` 短 prompt）；成功则显示 "Connected · sample: …"，失败显示报错。

Explain 请求默认优先走 AI SDK 的结构化输出；如果当前 OpenAI-compatible 提供方不完整支持 schema / `response_format`，前端会自动回退到普通文本生成，再从文本里提取 JSON。

## 故障排查

- **401 / 403**：检查 API key 是否正确、base URL 是否匹配该 key 的账户体系。
- **CORS / network error**：扩展的 fetch 走扩展上下文，但若使用自建代理，需要在 `manifest.json` 的 `host_permissions` 中加入该域名。
- **生成内容不符合 schema / Invalid JSON**：不少 OpenAI-compatible 网关只“看起来兼容”，但不完整支持结构化输出。当前实现会自动回退到文本 JSON 提取；如果仍失败，优先检查该模型是否会稳定返回纯 JSON，必要时换更强模型（如 `gpt-4o`）或更标准的兼容端点。
- **图片栏为空**：检查 `manifest.json` 权限是否包含对应搜索引擎域名，必要时切换到其它引擎。
