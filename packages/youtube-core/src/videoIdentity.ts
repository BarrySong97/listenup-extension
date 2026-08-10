/**
 * @purpose 校验页面、播放器响应与字幕轨 URL 是否共同指向同一 YouTube videoId。
 * @role    两种字幕来源进入缓存、下载与 ready 状态前的纯函数安全门。
 * @deps    types、URL
 * @gotcha  任一身份缺失都失败，不能用页面 URL 替代播放器或字幕轨身份。
 */
import type { CaptionTrackDescriptor } from "./types.ts";

export interface CaptionVideoIdentityInput {
  expectedVideoId: string;
  sessionVideoId: string | null;
  track: Pick<CaptionTrackDescriptor, "sourceVideoId" | "baseUrl" | "requestUrl">;
}

export interface CaptionVideoIdentityResult {
  ok: boolean;
  trackVideoId: string | null;
}

export const extractVideoIdFromTrackUrl = (url: string): string | null => {
  try {
    return new URL(url).searchParams.get("v");
  } catch {
    return null;
  }
};

export const validateCaptionVideoIdentity = ({
  expectedVideoId,
  sessionVideoId,
  track,
}: CaptionVideoIdentityInput): CaptionVideoIdentityResult => {
  const trackVideoId = extractVideoIdFromTrackUrl(track.requestUrl || track.baseUrl);
  return {
    ok:
      Boolean(expectedVideoId) &&
      sessionVideoId === expectedVideoId &&
      track.sourceVideoId === expectedVideoId &&
      trackVideoId === expectedVideoId,
    trackVideoId,
  };
};
