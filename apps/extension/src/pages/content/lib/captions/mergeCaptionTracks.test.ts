/**
 * @purpose 锁定字幕轨跨来源去重时的身份合并，防止更换 URL 后丢失原始语言信号。
 * @role    mergeCaptionTracks 的 Node 内建测试。
 * @deps    node:test、node:assert、mergeCaptionTracks、captions/types
 * @gotcha  page bridge 常提供更好的请求 URL，但原始音轨/default 标记可能只存在于另一来源。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { CaptionTrackDescriptor } from "./types.ts";
import { mergeCaptionTracks } from "./mergeCaptionTracks.ts";

const baseTrack: CaptionTrackDescriptor = {
  source: "player-response",
  sourceVideoId: "lvKA9rH_WlU",
  languageCode: "en",
  displayName: "English",
  kind: "manual",
  vssId: ".en",
  baseUrl: "https://www.youtube.com/api/timedtext?v=lvKA9rH_WlU&lang=en",
  isDefault: true,
  isOriginalAudioLanguage: true,
  isTranslatable: true,
};

test("keeps original/default identity when the page bridge URL wins", () => {
  const [merged] = mergeCaptionTracks([
    baseTrack,
    {
      ...baseTrack,
      source: "page-bridge",
      requestUrl:
        "https://www.youtube.com/api/timedtext?v=lvKA9rH_WlU&lang=en&pot=token",
      hasPot: true,
      isDefault: false,
      isOriginalAudioLanguage: false,
    },
  ]);

  assert.equal(merged.source, "page-bridge");
  assert.equal(merged.hasPot, true);
  assert.equal(merged.isDefault, true);
  assert.equal(merged.isOriginalAudioLanguage, true);
});
