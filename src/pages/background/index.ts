type ImageSearchFetchRequest = {
  type: "IMAGE_SEARCH_FETCH";
  engine: "google" | "bing" | "baidu";
  query: string;
};

type ImageSearchFetchResponse =
  | { ok: true; html: string }
  | { ok: false; error: string };

const ENGINE_URL: Record<ImageSearchFetchRequest["engine"], (q: string) => string> = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=isch`,
  bing: (q) => `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&first=1&count=20`,
  baidu: (q) => `https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(q)}`,
};

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchSearchHtml(req: ImageSearchFetchRequest): Promise<ImageSearchFetchResponse> {
  try {
    const url = ENGINE_URL[req.engine](req.query);
    const res = await fetch(url, {
      headers: {
        "User-Agent": DESKTOP_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.8",
      },
      credentials: "omit",
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    return { ok: true, html };
  } catch (error) {
    return { ok: false, error: (error as Error)?.message ?? "fetch failed" };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return undefined;
  if ((message as { type?: string }).type === "IMAGE_SEARCH_FETCH") {
    fetchSearchHtml(message as ImageSearchFetchRequest).then(sendResponse);
    return true;
  }
  return undefined;
});
