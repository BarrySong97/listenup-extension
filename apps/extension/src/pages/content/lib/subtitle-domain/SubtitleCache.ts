/**
 * @purpose 基于 chrome.storage.local 的字幕缓存（同时存原始与处理后结果）。
 * @role    SubtitleRepository 的持久层。
 * @deps    chrome.storage.local、captions/types、subtitles/subtitleTypes
 * @gotcha  缓存键含 CACHE_VERSION 与 configHash；改条目结构必须提 CACHE_VERSION，否则读到旧结构
 */
import { CaptionTrackDescriptor } from "../captions/types";
import { SubtitleItem } from "../subtitles/subtitleTypes";

export interface SubtitleCacheEntry {
  videoId: string;
  sourceVideoId: string;
  track: Pick<
    CaptionTrackDescriptor,
    "languageCode" | "vssId" | "kind"
  >;
  rawSubtitles: SubtitleItem[];
  processedSubtitles: SubtitleItem[];
  createdAt: number;
  configHash: string;
}

const CACHE_VERSION = "v3";

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
    track: Pick<CaptionTrackDescriptor, "vssId" | "sourceVideoId">,
    configHash: string
  ): Promise<SubtitleCacheEntry | null> {
    const key = this.buildKey(videoId, track, configHash);
    const data = await chrome.storage.local.get(key);
    const entry = data[key] as SubtitleCacheEntry | undefined;
    if (
      !entry ||
      entry.videoId !== videoId ||
      entry.sourceVideoId !== videoId ||
      track.sourceVideoId !== videoId
    ) {
      return null;
    }

    return entry;
  }

  public async set(
    videoId: string,
    track: Pick<
      CaptionTrackDescriptor,
      "languageCode" | "vssId" | "kind" | "sourceVideoId"
    >,
    configHash: string,
    value: Pick<SubtitleCacheEntry, "rawSubtitles" | "processedSubtitles">
  ) {
    const key = this.buildKey(videoId, track, configHash);
    const entry: SubtitleCacheEntry = {
      videoId,
      sourceVideoId: track.sourceVideoId,
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
