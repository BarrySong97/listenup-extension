import { ImageSearchEngine } from "@src/services/ai/aiSettings";

export interface ImageSearchResult {
  thumbnailUrl: string;
  sourceUrl: string;
}

interface ImageSearchFetchResponse {
  ok: boolean;
  html?: string;
  error?: string;
}

function htmlUnescape(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseBing(html: string, count: number): ImageSearchResult[] {
  const results: ImageSearchResult[] = [];
  const pattern = /class="iusc"[^>]*m="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    if (results.length >= count) break;
    try {
      const json = JSON.parse(htmlUnescape(match[1])) as {
        murl?: string;
        turl?: string;
      };
      if (json.turl) {
        results.push({
          thumbnailUrl: json.turl,
          sourceUrl: json.murl ?? json.turl,
        });
      }
    } catch {
      // skip malformed entries
    }
  }
  return results;
}

function parseGoogle(html: string, count: number): ImageSearchResult[] {
  const urls = new Set<string>();
  const pattern = /https?:\/\/[^"'\s\]>]+\.(?:jpg|jpeg|png|webp|gif)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    urls.add(match[0]);
  }
  const skip = [
    "gstatic.com",
    "google.com",
    "googleapis.com",
    "googleusercontent.com",
    "ggpht.com",
  ];
  const results: ImageSearchResult[] = [];
  for (const url of urls) {
    if (results.length >= count) break;
    if (skip.some((d) => url.includes(d))) continue;
    results.push({ thumbnailUrl: url, sourceUrl: url });
  }
  return results;
}

function parseBaidu(body: string, count: number): ImageSearchResult[] {
  // Baidu HTML page embeds a JS object `app.setData({ ... })` but a simpler
  // approach is to regex out objURL / thumbURL strings.
  const results: ImageSearchResult[] = [];
  const pattern = /"thumbURL":"([^"]+)"(?:[\s\S]{0,400}?"middleURL":"([^"]+)")?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    if (results.length >= count) break;
    const thumb = match[1];
    const middle = match[2];
    if (thumb) {
      results.push({
        thumbnailUrl: thumb,
        sourceUrl: middle && middle.length > 0 ? middle : thumb,
      });
    }
  }
  return results;
}

export function buildWebSearchUrl(
  engine: ImageSearchEngine,
  query: string
): string {
  const encoded = encodeURIComponent(query);
  switch (engine) {
    case "google":
      return `https://www.google.com/search?q=${encoded}&tbm=isch`;
    case "baidu":
      return `https://image.baidu.com/search/index?tn=baiduimage&word=${encoded}`;
    case "bing":
    default:
      return `https://www.bing.com/images/search?q=${encoded}`;
  }
}

export async function searchImages(
  engine: ImageSearchEngine,
  query: string,
  count = 8
): Promise<ImageSearchResult[]> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: "IMAGE_SEARCH_FETCH",
      engine,
      query,
    })) as ImageSearchFetchResponse | undefined;
    if (!response || !response.ok || !response.html) {
      return [];
    }
    switch (engine) {
      case "bing":
        return parseBing(response.html, count);
      case "google":
        return parseGoogle(response.html, count);
      case "baidu":
        return parseBaidu(response.html, count);
      default:
        return [];
    }
  } catch (error) {
    console.warn("[imageSearch] failed", error);
    return [];
  }
}
