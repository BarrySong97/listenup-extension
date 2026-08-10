/**
 * @purpose 在受限 YouTube child WebView 主 frame 中发现字幕、发送 10Hz cursor 并执行固定播放命令。
 * @role    EmbeddedSource 的远程页面适配器，由 Rust 在 document-start 注入；只调用固定 bridge API。
 * @deps    @listenup/youtube-core、YouTube #movie_player/video DOM
 * @gotcha  不能引用 Tauri invoke；来源身份由 Rust 注入的 bridge 自动附加，iframe 不运行本脚本。
 */
import {
  buildSubtitleUrl,
  normalizeCaptionTracksFromPlayerResponse,
  parseJSONSubtitles,
  PlaybackEpochTracker,
  selectCaptionTrack,
  validateCaptionVideoIdentity,
  type SubtitleItem,
  type YouTubePlayerResponse,
} from "@listenup/youtube-core";

interface EmbeddedControlCommand {
  commandId: string;
  action: "play" | "pause" | "seek";
  seekTime?: number;
}

interface EmbeddedBridge {
  emit(event: Record<string, unknown>): void;
  onControl(listener: (command: EmbeddedControlCommand) => void): void;
}

declare global {
  interface Window {
    __listenupEmbeddedBridge?: EmbeddedBridge;
    ytInitialPlayerResponse?: YouTubePlayerResponse;
  }
}

const bridge = window.__listenupEmbeddedBridge;
if (!bridge || window.location.origin !== "https://www.youtube.com") {
  throw new Error("ListenUp Embedded bridge is unavailable for this origin");
}

const playbackEpoch = new PlaybackEpochTracker();
let subtitles: SubtitleItem[] = [];
let activeVideoId = "";
let activeSessionGeneration = 0;
let sessionSettled = false;
let loadInFlight = false;
let lastLoadAttempt = 0;

const currentVideoId = () => new URL(window.location.href).searchParams.get("v") || "";
const playerElement = () =>
  document.querySelector("#movie_player") as
    | (HTMLElement & { getPlayerResponse?: () => YouTubePlayerResponse })
    | null;
const videoElement = () => document.querySelector("video") as HTMLVideoElement | null;
const isAdPlaying = () => playerElement()?.classList.contains("ad-showing") ?? false;

const emitSession = (
  videoId: string,
  response: YouTubePlayerResponse | null,
  status: "loading" | "ready" | "empty" | "error",
  error: string | null,
  track: ReturnType<typeof selectCaptionTrack>,
  items: SubtitleItem[]
) => {
  bridge.emit({
    kind: "session",
    version: 1,
    videoId,
    title: response?.videoDetails?.title || document.title.replace(/\s*-\s*YouTube$/, ""),
    identityStatus: response?.videoDetails?.videoId === videoId ? "verified" : "pending",
    status,
    error,
    track: track
      ? {
          languageCode: track.languageCode,
          displayName: track.displayName,
          kind: track.kind,
          vssId: track.vssId,
          isDefault: track.isDefault,
        }
      : null,
    subtitles: items,
  });
};

const loadSession = async () => {
  if (loadInFlight) return;
  loadInFlight = true;
  lastLoadAttempt = Date.now();
  const generation = ++activeSessionGeneration;
  const videoId = currentVideoId();
  if (!videoId) {
    loadInFlight = false;
    return;
  }
  activeVideoId = videoId;
  subtitles = [];
  sessionSettled = false;

  const response = playerElement()?.getPlayerResponse?.() || window.ytInitialPlayerResponse || null;
  emitSession(videoId, response, "loading", null, null, []);
  if (!response || response.videoDetails?.videoId !== videoId) {
    loadInFlight = false;
    return;
  }

  const track = selectCaptionTrack(
    normalizeCaptionTracksFromPlayerResponse(response, "player-response")
  );
  if (!track) {
    emitSession(videoId, response, "empty", null, null, []);
    sessionSettled = true;
    loadInFlight = false;
    return;
  }
  if (
    !validateCaptionVideoIdentity({
      expectedVideoId: videoId,
      sessionVideoId: response.videoDetails?.videoId || null,
      track,
    }).ok
  ) {
    emitSession(videoId, response, "error", "字幕轨与当前视频身份不一致", null, []);
    sessionSettled = true;
    loadInFlight = false;
    return;
  }

  try {
    const request = await fetch(buildSubtitleUrl(track), {
      credentials: "include",
      headers: { Accept: "application/json,text/plain,*/*" },
    });
    if (!request.ok) throw new Error(`字幕请求失败 (${request.status})`);
    const items = parseJSONSubtitles(await request.text());
    if (generation !== activeSessionGeneration || currentVideoId() !== videoId) return;
    subtitles = items;
    emitSession(videoId, response, items.length ? "ready" : "empty", null, track, items);
    sessionSettled = true;
  } catch (error) {
    if (generation !== activeSessionGeneration) return;
    emitSession(
      videoId,
      response,
      "error",
      error instanceof Error ? error.message : "字幕初始化失败",
      track,
      []
    );
    sessionSettled = true;
  } finally {
    loadInFlight = false;
  }
};

const currentSubtitleIndex = (time: number) => {
  let low = 0;
  let high = subtitles.length - 1;
  let match = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (subtitles[middle].startTime <= time) {
      match = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match >= 0 && time <= subtitles[match].endTime + 0.25 ? match : -1;
};

window.setInterval(() => {
  const videoId = currentVideoId();
  if (
    videoId &&
    (videoId !== activeVideoId || !sessionSettled) &&
    Date.now() - lastLoadAttempt >= 500
  ) {
    void loadSession();
  }
  const video = videoElement();
  if (!video || !videoId) return;
  const adPlaying = isAdPlaying();
  const epoch = adPlaying
    ? playbackEpoch.suspend()
    : playbackEpoch.update(!video.paused);
  bridge.emit({
    kind: "cursor",
    version: 1,
    videoId,
    playbackEpoch: epoch,
    currentTime: video.currentTime || 0,
    currentIndex: currentSubtitleIndex(video.currentTime || 0),
    isPaused: video.paused,
    isAdPlaying: adPlaying,
    sentAt: Date.now(),
  });
}, 100);

bridge.onControl(async (command) => {
  const video = videoElement();
  let error: string | null = null;
  try {
    if (!video) throw new Error("YouTube 播放器不可用");
    if (command.action === "play") await video.play();
    else if (command.action === "pause") video.pause();
    else if (Number.isFinite(command.seekTime) && (command.seekTime ?? -1) >= 0) {
      video.currentTime = command.seekTime!;
    } else {
      throw new Error("字幕跳转时间无效");
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "播放控制失败";
  }
  bridge.emit({
    kind: "controlResult",
    version: 1,
    videoId: currentVideoId(),
    commandId: command.commandId,
    ok: error === null,
    error,
  });
});

void loadSession();
