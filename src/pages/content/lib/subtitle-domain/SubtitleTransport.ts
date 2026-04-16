import { SubtitleLoadError } from "./errors";
import { pageBridge } from "../captions/PageBridge";
import { subtitleDebug } from "./subtitleDebug";

export const fetchSubtitleDocument = async (
  url: string,
  signal?: AbortSignal
): Promise<string> => {
  const response = await fetch(url, {
    signal,
    credentials: "include",
  });
  if (!response.ok) {
    throw new SubtitleLoadError(
      "NETWORK_ERROR",
      `Failed to fetch subtitles: ${response.status} ${response.statusText}`
    );
  }

  const content = await response.text();
  subtitleDebug.log("direct subtitle response", {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
    contentLength: content.length,
  });

  if (content.length > 0) {
    return content;
  }

  subtitleDebug.warn("direct subtitle response empty; retry page bridge fetch");
  const bridgedResponse = await pageBridge.fetchSubtitleDocument(url);
  subtitleDebug.log("page bridge subtitle response", {
    status: bridgedResponse.status,
    statusText: bridgedResponse.statusText,
    contentType: bridgedResponse.contentType,
    contentLength: bridgedResponse.content.length,
  });

  if (bridgedResponse.status < 200 || bridgedResponse.status >= 300) {
    throw new SubtitleLoadError(
      "NETWORK_ERROR",
      `Failed to fetch subtitles via page bridge: ${bridgedResponse.status} ${bridgedResponse.statusText}`
    );
  }

  return bridgedResponse.content;
};
