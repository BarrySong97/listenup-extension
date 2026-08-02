/**
 * @purpose 图片搜索结果缓存（chrome.storage.local，TTL 1 天）。
 * @role    imageSearch 的读写层。
 * @deps    chrome.storage.local（key: image_search_cache）
 * @gotcha  缓存键为 引擎::归一化查询词
 */
import { ImageSearchEngine } from "@src/services/ai/aiSettings";
import { ImageSearchResult } from "./imageSearch";

const STORAGE_KEY = "image_search_cache";
const TTL_MS = 24 * 60 * 60 * 1000;

interface Entry {
  value: ImageSearchResult[];
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

export function buildImageCacheKey(
  engine: ImageSearchEngine,
  query: string
): string {
  return `${engine}::${query.trim().toLowerCase()}`;
}

export async function getCachedImages(
  key: string
): Promise<ImageSearchResult[] | null> {
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

export async function setCachedImages(
  key: string,
  value: ImageSearchResult[]
): Promise<void> {
  const cache = await readCache();
  cache[key] = { value, createdAt: Date.now() };
  await writeCache(cache);
}
