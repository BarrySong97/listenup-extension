/**
 * @purpose AI 设置的类型、默认值与 chrome.storage.local 读写/订阅。
 * @role    Explain 链路与设置表单的共同数据源。
 * @deps    chrome.storage.local（key: ai_settings）
 * @gotcha  API key 明文存储；改默认值要同步 docs/modules/extension/ai-settings.md 的字段表
 */
export type ImageSearchEngine = "google" | "bing" | "baidu";

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  imageSearchEngine: ImageSearchEngine;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  imageSearchEngine: "bing",
};

const STORAGE_KEY = "ai_settings";

export async function loadAiSettings(): Promise<AiSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const value = stored?.[STORAGE_KEY] as Partial<AiSettings> | undefined;
  return { ...DEFAULT_AI_SETTINGS, ...(value ?? {}) };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

export function subscribeAiSettings(
  listener: (settings: AiSettings) => void
): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "local" || !(STORAGE_KEY in changes)) return;
    const next = changes[STORAGE_KEY].newValue as Partial<AiSettings> | undefined;
    listener({ ...DEFAULT_AI_SETTINGS, ...(next ?? {}) });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
