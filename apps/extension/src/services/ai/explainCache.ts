/**
 * @purpose Explain 结果缓存（chrome.storage.local，TTL 7 天）。
 * @role    useExplain 请求前后的读写层。
 * @deps    chrome.storage.local（key: explain_cache）、./explainSchema
 * @gotcha  缓存键为 videoId|归一化文本|model；过期项在读取时清理
 */
import { ExplainResult } from "./explainSchema";

const STORAGE_KEY = "explain_cache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Entry {
  value: ExplainResult;
  createdAt: number;
}

type CacheShape = Record<string, Entry>;

async function readCache(): Promise<CacheShape> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored?.[STORAGE_KEY] as CacheShape) ?? {};
}

async function writeCache(cache: CacheShape): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: cache });
}

function normalizeText(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildExplainCacheKey(params: {
  videoId: string | null;
  text: string;
  model: string;
}): string {
  return [
    params.videoId?.trim() || "no-video",
    normalizeText(params.text),
    params.model.toLowerCase(),
  ].join("|");
}

export async function getCachedExplain(
  key: string
): Promise<ExplainResult | null> {
  const cache = await readCache();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    delete cache[key];
    await writeCache(cache);
    return null;
  }
  return entry.value;
}

export async function setCachedExplain(
  key: string,
  value: ExplainResult
): Promise<void> {
  const cache = await readCache();
  cache[key] = { value, createdAt: Date.now() };
  await writeCache(cache);
}

export async function clearExplainCache(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
