/**
 * @purpose 字幕加载的总编排：聚合两个轨道来源、选轨、下载、解析、处理、读写缓存。
 * @role    subtitle-domain 的核心，useSubtitles 唯一调用的入口。
 * @deps    captions/*、subtitles/subtitleParser、SubtitleCache、SubtitleProcessor、SubtitleTransport、youtube-sdk
 * @gotcha  SPA 切换后五秒内只接受页面、playerResponse、字幕 URL 三方 videoId 一致的轨道；缓存前后都要复验
 */
import {
  bridgeCaptionSource,
} from "../captions/BridgeCaptionSource";
import {
  playerResponseCaptionSource,
} from "../captions/PlayerResponseCaptionSource";
import { selectCaptionTrack } from "../captions/SubtitleTrackSelector";
import { buildSubtitleUrl } from "../captions/SubtitleUrlBuilder";
import {
  CaptionTrackDescriptor,
  CaptionListResponse,
  TrackPreference,
} from "../captions/types";
import { validateCaptionVideoIdentity } from "../captions/videoIdentity";
import { youtubeSDK } from "../youtube-sdk";
import { parseSubtitleContent } from "../subtitles/subtitleParser";
import { SubtitleItem } from "../subtitles/subtitleTypes";
import { SubtitleCache, subtitleCache } from "./SubtitleCache";
import { SubtitleLoadError } from "./errors";
import {
  createConfigHash,
  getSubtitleProcessingConfig,
  processSubtitles,
} from "./SubtitleProcessor";
import { subtitleDebug } from "./subtitleDebug";
import { fetchSubtitleDocument } from "./SubtitleTransport";

export interface SubtitleLoadSuccess {
  ok: true;
  videoId: string;
  track: CaptionTrackDescriptor;
  rawSubtitles: SubtitleItem[];
  processedSubtitles: SubtitleItem[];
  fromCache: boolean;
}

export interface SubtitleLoadFailure {
  ok: false;
  code: SubtitleLoadError["code"];
  message: string;
}

export type SubtitleLoadResult = SubtitleLoadSuccess | SubtitleLoadFailure;

const dedupeTracks = (tracks: CaptionTrackDescriptor[]) => {
  const deduped = new Map<string, CaptionTrackDescriptor>();

  for (const track of tracks) {
    const key = `${track.languageCode}:${track.vssId}:${track.kind}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, track);
      continue;
    }

    if (isPreferredTrack(track, existing)) {
      deduped.set(key, track);
    }
  }

  return [...deduped.values()];
};

const isPreferredTrack = (
  candidate: CaptionTrackDescriptor,
  current: CaptionTrackDescriptor
) => {
  if (Boolean(candidate.hasPot) !== Boolean(current.hasPot)) {
    return Boolean(candidate.hasPot);
  }

  if (Boolean(candidate.requestUrl) !== Boolean(current.requestUrl)) {
    return Boolean(candidate.requestUrl);
  }

  if (candidate.source !== current.source) {
    return candidate.source === "page-bridge";
  }

  return false;
};

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (!signal) {
      return;
    }

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });

const hasUsablePotTrack = (tracks: CaptionTrackDescriptor[]) =>
  tracks.some((track) => track.source === "page-bridge" && track.hasPot);

const shouldRetryForPot = (results: CaptionListResponse[]) =>
  results.some(
    (result) =>
      result.ok &&
      result.tracks.some(
        (track) =>
          track.source === "page-bridge" &&
          track.urlSource === "current-track-url" &&
          !track.hasPot
      )
  );

const IDENTITY_RETRY_DELAYS_MS = [0, 250, 500, 750, 1_000, 1_250, 1_250];

interface VerifiedTrackDiscovery {
  tracks: CaptionTrackDescriptor[];
  sourceResults: CaptionListResponse[];
  sawIdentityMismatch: boolean;
}

export class SubtitleRepository {
  constructor(private readonly cache: SubtitleCache = subtitleCache) {}

  private async discoverVerifiedTracks(
    expectedVideoId: string,
    signal?: AbortSignal
  ): Promise<VerifiedTrackDiscovery> {
    const summarizeResults = (results: CaptionListResponse[]) =>
      results
        .flatMap((result) => (result.ok ? result.tracks : []))
        .map((track) => ({
          source: track.source,
          languageCode: track.languageCode,
          vssId: track.vssId,
          kind: track.kind,
          urlSource: track.urlSource,
          hasPot: track.hasPot,
          sourceVideoId: track.sourceVideoId,
        }));
    let latestResults: CaptionListResponse[] = [];
    let latestVerifiedTracks: CaptionTrackDescriptor[] = [];
    let sawIdentityMismatch = false;

    for (const delayMs of IDENTITY_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await delay(delayMs, signal);
      }

      const sessionVideoId = youtubeSDK.getSessionState().videoId;
      latestResults = await Promise.all([
        playerResponseCaptionSource.listTracks(),
        bridgeCaptionSource.listTracks(),
      ]);
      const discoveredTracks = dedupeTracks(
        latestResults.flatMap((result) => (result.ok ? result.tracks : []))
      );
      latestVerifiedTracks = discoveredTracks.filter((track) => {
        const identity = validateCaptionVideoIdentity({
          expectedVideoId,
          sessionVideoId,
          track,
        });
        if (!identity.ok) {
          sawIdentityMismatch = true;
          subtitleDebug.warn("reject caption track with mismatched video identity", {
            expectedVideoId,
            sessionVideoId,
            sourceVideoId: track.sourceVideoId,
            trackVideoId: identity.trackVideoId,
            vssId: track.vssId,
          });
        }
        return identity.ok;
      });

      subtitleDebug.log("caption source identity attempt", {
        delayMs,
        expectedVideoId,
        sessionVideoId,
        tracks: summarizeResults(latestResults),
        verifiedTrackCount: latestVerifiedTracks.length,
      });

      if (
        latestVerifiedTracks.length > 0 &&
        (hasUsablePotTrack(latestVerifiedTracks) ||
          !shouldRetryForPot(latestResults))
      ) {
        break;
      }
    }

    return {
      tracks: latestVerifiedTracks,
      sourceResults: latestResults,
      sawIdentityMismatch,
    };
  }

  private isTrackIdentityCurrent(
    expectedVideoId: string,
    track: CaptionTrackDescriptor
  ) {
    return validateCaptionVideoIdentity({
      expectedVideoId,
      sessionVideoId: youtubeSDK.getSessionState().videoId,
      track,
    }).ok;
  }

  public async load(input: {
    videoId: string;
    enabled: boolean;
    preference?: Partial<TrackPreference>;
    signal?: AbortSignal;
  }): Promise<SubtitleLoadResult> {
    subtitleDebug.log("repository.load called", input);

    if (!input.enabled) {
      return {
        ok: false,
        code: "PLAYER_NOT_READY",
        message: "Subtitle loading is disabled",
      };
    }

    const sessionState = youtubeSDK.getSessionState();
    subtitleDebug.log("current YouTube session state", sessionState);
    if (!sessionState.isWatchPage) {
      return {
        ok: false,
        code: "NOT_WATCH_PAGE",
        message: "Current page is not a watch page",
      };
    }

    if (!sessionState.isPlayerReady) {
      return {
        ok: false,
        code: "PLAYER_NOT_READY",
        message: "YouTube player is not ready",
      };
    }

    const discovery = await this.discoverVerifiedTracks(
      input.videoId,
      input.signal
    );
    const sourceResults = discovery.sourceResults;
    subtitleDebug.log(
      "caption source results",
      sourceResults.map((result) =>
        result.ok
          ? {
              ok: true,
              trackCount: result.tracks.length,
              tracks: result.tracks.map((track) => ({
                source: track.source,
                languageCode: track.languageCode,
                kind: track.kind,
                vssId: track.vssId,
              })),
            }
          : result
      )
    );

    const availableTracks = discovery.tracks;
    subtitleDebug.log("deduped caption tracks", {
      trackCount: availableTracks.length,
      tracks: availableTracks.map((track) => ({
        source: track.source,
        languageCode: track.languageCode,
        displayName: track.displayName,
        kind: track.kind,
        vssId: track.vssId,
        urlSource: track.urlSource,
        hasPot: track.hasPot,
        isDefault: track.isDefault,
      })),
    });

    if (availableTracks.length === 0) {
      if (
        discovery.sawIdentityMismatch ||
        youtubeSDK.getSessionState().videoId !== input.videoId
      ) {
        return {
          ok: false,
          code: "VIDEO_ID_MISMATCH",
          message: "视频切换尚未完成",
        };
      }

      const bridgeFailure = sourceResults.find(
        (result) => !result.ok && result.code === "BRIDGE_TIMEOUT"
      );
      return {
        ok: false,
        code: bridgeFailure ? "BRIDGE_TIMEOUT" : "NO_CAPTION_TRACKS",
        message: bridgeFailure
          ? bridgeFailure.message
          : "No caption tracks available for this video",
      };
    }

    const selectedTrack = selectCaptionTrack(availableTracks, input.preference);
    subtitleDebug.log("selected caption track", selectedTrack);
    if (!selectedTrack) {
      return {
        ok: false,
        code: "TRACK_SELECTION_FAILED",
        message: "Failed to select a caption track",
      };
    }

    if (!this.isTrackIdentityCurrent(input.videoId, selectedTrack)) {
      return {
        ok: false,
        code: "VIDEO_ID_MISMATCH",
        message: "视频切换尚未完成",
      };
    }

    const processingConfig = getSubtitleProcessingConfig();
    const configHash = createConfigHash(processingConfig);
    subtitleDebug.log("subtitle processing config", {
      processingConfig,
      configHash,
    });
    const cached = await this.cache.get(
      input.videoId,
      selectedTrack,
      configHash
    );

    if (cached) {
      if (!this.isTrackIdentityCurrent(input.videoId, selectedTrack)) {
        return {
          ok: false,
          code: "VIDEO_ID_MISMATCH",
          message: "视频切换尚未完成",
        };
      }

      subtitleDebug.log("subtitle cache hit", {
        videoId: input.videoId,
        track: selectedTrack,
        rawCount: cached.rawSubtitles.length,
        processedCount: cached.processedSubtitles.length,
      });
      return {
        ok: true,
        videoId: input.videoId,
        track: selectedTrack,
        rawSubtitles: cached.rawSubtitles,
        processedSubtitles: cached.processedSubtitles,
        fromCache: true,
      };
    }

    try {
      const subtitleUrl = buildSubtitleUrl(selectedTrack);
      subtitleDebug.log("built subtitle URL", subtitleUrl);
      const content = await fetchSubtitleDocument(subtitleUrl, input.signal);
      subtitleDebug.log("fetched subtitle document", {
        contentLength: content.length,
        preview: content.slice(0, 120),
      });
      const rawSubtitles = await parseSubtitleContent(content);
      subtitleDebug.log("parsed raw subtitles", {
        count: rawSubtitles.length,
      });
      const processedSubtitles = processSubtitles(rawSubtitles, processingConfig);
      subtitleDebug.log("processed subtitles", {
        count: processedSubtitles.length,
      });

      if (!this.isTrackIdentityCurrent(input.videoId, selectedTrack)) {
        return {
          ok: false,
          code: "VIDEO_ID_MISMATCH",
          message: "视频切换尚未完成",
        };
      }

      await this.cache.set(input.videoId, selectedTrack, configHash, {
        rawSubtitles,
        processedSubtitles,
      });
      subtitleDebug.log("stored subtitle cache entry", {
        videoId: input.videoId,
        track: selectedTrack,
      });

      return {
        ok: true,
        videoId: input.videoId,
        track: selectedTrack,
        rawSubtitles,
        processedSubtitles,
        fromCache: false,
      };
    } catch (error) {
      subtitleDebug.error("repository.load caught error", error);
      if (error instanceof SubtitleLoadError) {
        return {
          ok: false,
          code: error.code,
          message: error.message,
        };
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          ok: false,
          code: "NETWORK_ERROR",
          message: "Subtitle request was aborted",
        };
      }

      return {
        ok: false,
        code: "PARSE_ERROR",
        message:
          error instanceof Error ? error.message : "Subtitle loading failed",
      };
    }
  }
}

export const subtitleRepository = new SubtitleRepository();
