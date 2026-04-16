import { CaptionTrackDescriptor } from "../captions/types";
import { SubtitleItem } from "../subtitles/subtitleTypes";

export interface SubtitleCacheEntry {
  videoId: string;
  track: Pick<
    CaptionTrackDescriptor,
    "languageCode" | "vssId" | "kind"
  >;
  rawSubtitles: SubtitleItem[];
  processedSubtitles: SubtitleItem[];
  createdAt: number;
  configHash: string;
}

const CACHE_VERSION = "v2";

export class SubtitleCache {
  private buildKey(
    videoId: string,
    track: Pick<CaptionTrackDescriptor, "vssId">,
    configHash: string
  ) {
    return `subtitle:${videoId}:${track.vssId}:${configHash}:${CACHE_VERSION}`;
  }

  public async get(
    videoId: string,
    track: Pick<CaptionTrackDescriptor, "vssId">,
    configHash: string
  ): Promise<SubtitleCacheEntry | null> {
    const key = this.buildKey(videoId, track, configHash);
    const data = await chrome.storage.local.get(key);
    return data[key] || null;
  }

  public async set(
    videoId: string,
    track: Pick<CaptionTrackDescriptor, "languageCode" | "vssId" | "kind">,
    configHash: string,
    value: Pick<SubtitleCacheEntry, "rawSubtitles" | "processedSubtitles">
  ) {
    const key = this.buildKey(videoId, track, configHash);
    const entry: SubtitleCacheEntry = {
      videoId,
      track,
      rawSubtitles: value.rawSubtitles,
      processedSubtitles: value.processedSubtitles,
      createdAt: Date.now(),
      configHash,
    };

    await chrome.storage.local.set({
      [key]: entry,
    });
  }
}

export const subtitleCache = new SubtitleCache();

