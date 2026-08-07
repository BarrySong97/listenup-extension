/**
 * @purpose Service worker：代抓图片，并在内容脚本与 Desktop Native Host 间双向路由字幕/播放命令。
 * @role    内容脚本通过 chrome.runtime.sendMessage 调它；它是唯一持有 native port 的一方。
 * @deps    src/shared/nativeSubtitleProtocol、chrome.runtime.connectNative、fetch
 * @gotcha  playback command 只路由 Native Host 指定 tab，失败必须回同一 port；仍只在 session 到达时懒连接。见 docs/topics/native-messaging.md
 */
import {
  isNativeSubtitlePlaybackCommand,
  isNativeSubtitleExtensionMessage,
  NATIVE_SUBTITLE_HOST,
  NativeSubtitlePlaybackCommand,
  NativeSubtitlePlaybackCommandResultPayload,
  NativeSubtitleHostMessage,
} from "@src/shared/nativeSubtitleProtocol";

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

let nativeSubtitlePort: chrome.runtime.Port | null = null;
let nativeSubtitleSessionId: string | null = null;
let failedNativeSubtitleSessionId: string | null = null;

const playbackFailure = (
  command: NativeSubtitlePlaybackCommand,
  error: string
): NativeSubtitlePlaybackCommandResultPayload => ({
  version: command.version,
  commandId: command.commandId,
  sessionId: command.sessionId,
  videoId: command.videoId,
  ok: false,
  error,
});

const routePlaybackCommand = async (
  port: chrome.runtime.Port,
  command: NativeSubtitlePlaybackCommand
) => {
  let result: NativeSubtitlePlaybackCommandResultPayload;
  try {
    const response = await chrome.tabs.sendMessage(command.tabId, {
      type: "NATIVE_PLAYBACK_COMMAND",
      payload: command,
    });
    if (
      !response ||
      typeof response !== "object" ||
      response.commandId !== command.commandId ||
      response.sessionId !== command.sessionId ||
      response.videoId !== command.videoId ||
      typeof response.ok !== "boolean"
    ) {
      result = playbackFailure(command, "播放控制返回了无效响应");
    } else {
      result = {
        version: command.version,
        commandId: command.commandId,
        sessionId: command.sessionId,
        videoId: command.videoId,
        ok: response.ok,
        error: typeof response.error === "string" ? response.error : null,
      };
    }
  } catch (error) {
    result = playbackFailure(
      command,
      error instanceof Error ? error.message : "目标 YouTube 标签页不可用"
    );
  }

  if (nativeSubtitlePort !== port) return;
  try {
    port.postMessage({
      kind: "playbackCommandResult",
      tabId: command.tabId,
      ...result,
    } satisfies NativeSubtitleHostMessage);
  } catch (error) {
    console.warn(
      "[ListenUp:native-subtitles] Failed to return playback result:",
      error
    );
  }
};

const hasNativeMessagingPermission = () =>
  chrome.runtime.getManifest().permissions?.includes("nativeMessaging") ?? false;

const connectNativeSubtitleHost = (sessionId: string) => {
  if (!hasNativeMessagingPermission()) {
    return null;
  }
  if (nativeSubtitlePort) {
    return nativeSubtitlePort;
  }
  if (failedNativeSubtitleSessionId === sessionId) {
    return null;
  }

  nativeSubtitleSessionId = sessionId;
  const port = chrome.runtime.connectNative(NATIVE_SUBTITLE_HOST);
  nativeSubtitlePort = port;
  port.onMessage.addListener((message) => {
    if (isNativeSubtitlePlaybackCommand(message)) {
      void routePlaybackCommand(port, message);
    }
  });
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[ListenUp:native-subtitles] Native Host disconnected:",
        chrome.runtime.lastError.message
      );
    }
    if (nativeSubtitleSessionId) {
      failedNativeSubtitleSessionId = nativeSubtitleSessionId;
    }
    nativeSubtitlePort = null;
    nativeSubtitleSessionId = null;
  });
  return port;
};

const postToNativeSubtitleHost = (
  message: NativeSubtitleHostMessage,
  allowConnect: boolean
) => {
  const port = allowConnect
    ? connectNativeSubtitleHost(message.sessionId)
    : nativeSubtitlePort;
  if (!port) {
    return;
  }

  try {
    port.postMessage(message);
  } catch (error) {
    console.warn(
      "[ListenUp:native-subtitles] Failed to send Native Host message:",
      error
    );
    nativeSubtitlePort = null;
    nativeSubtitleSessionId = null;
  }
};

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
  if (isNativeSubtitleExtensionMessage(message) && _sender.tab?.id != null) {
    const tabId = _sender.tab.id;
    if (message.type === "NATIVE_SUBTITLE_SESSION") {
      if (failedNativeSubtitleSessionId !== message.payload.sessionId) {
        failedNativeSubtitleSessionId = null;
      }
      postToNativeSubtitleHost(
        { kind: "session", tabId, ...message.payload },
        true
      );
    } else if (message.type === "NATIVE_SUBTITLE_CURSOR") {
      postToNativeSubtitleHost(
        { kind: "cursor", tabId, ...message.payload },
        false
      );
    } else if (message.type === "NATIVE_SUBTITLE_END") {
      postToNativeSubtitleHost(
        { kind: "end", tabId, ...message.payload },
        false
      );
    } else {
      postToNativeSubtitleHost(
        { kind: "playbackCommandResult", tabId, ...message.payload },
        false
      );
    }
    return undefined;
  }
  return undefined;
});
