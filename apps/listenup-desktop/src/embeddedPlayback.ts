/**
 * @purpose 纯函数校验/规范化 Desktop 播放链接，并决定 main/player 的来源空态动作。
 * @role    UI 在调用 start_embedded_playback 前的无副作用安全门。
 * @deps    URL、types
 * @gotcha  只接受 HTTPS watch/youtu.be 单视频链接；最终始终输出 www.youtube.com/watch。
 */
import type { ViewerSnapshot } from "./types";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const normalizeYoutubeWatchUrl = (input: string) => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("请输入有效的 YouTube 链接");
  }
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error("只支持标准 HTTPS YouTube 链接");
  }

  let videoId: string | null = null;
  if (
    (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") &&
    url.pathname === "/watch"
  ) {
    videoId = url.searchParams.get("v");
  } else if (url.hostname === "youtu.be") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 1) videoId = segments[0];
  }
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    throw new Error("链接中没有有效的 YouTube videoId");
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
};

export const shouldShowSourceEntry = (viewer: ViewerSnapshot) =>
  viewer.sourceMode === "empty" && viewer.activeSession === null;

export const embeddedRecoveryActions = (sourceMode: ViewerSnapshot["sourceMode"]) =>
  sourceMode === "embeddedRecovering"
    ? (["reload", "changeLink", "exit"] as const)
    : ([] as const);
