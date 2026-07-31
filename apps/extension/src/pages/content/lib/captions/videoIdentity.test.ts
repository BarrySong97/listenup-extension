/**
 * @purpose 锁定 videoId 三重校验规则，防止 SPA 切换时旧字幕进入新视频缓存。
 * @role    captions/videoIdentity 的 Node 内建测试。
 * @deps    node:test、node:assert、videoIdentity
 * @gotcha  缺少任一身份也必须失败，不能只测试显式不一致。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  extractVideoIdFromTrackUrl,
  validateCaptionVideoIdentity,
} from "./videoIdentity.ts";

const VIDEO_ID = "M_RcV4WSc3k";

test("extracts video id from a caption track URL", () => {
  assert.equal(
    extractVideoIdFromTrackUrl(
      `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en`
    ),
    VIDEO_ID
  );
});

test("accepts only matching page, player and track identities", () => {
  assert.deepEqual(
    validateCaptionVideoIdentity({
      expectedVideoId: VIDEO_ID,
      sessionVideoId: VIDEO_ID,
      track: {
        sourceVideoId: VIDEO_ID,
        baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en`,
      },
    }),
    { ok: true, trackVideoId: VIDEO_ID }
  );
});

test("rejects a stale player response", () => {
  assert.equal(
    validateCaptionVideoIdentity({
      expectedVideoId: VIDEO_ID,
      sessionVideoId: VIDEO_ID,
      track: {
        sourceVideoId: "old-video-id",
        baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en`,
      },
    }).ok,
    false
  );
});

test("rejects a stale or missing track URL identity", () => {
  for (const baseUrl of [
    "https://www.youtube.com/api/timedtext?v=old-video-id&lang=en",
    "https://www.youtube.com/api/timedtext?lang=en",
    "not-a-url",
  ]) {
    assert.equal(
      validateCaptionVideoIdentity({
        expectedVideoId: VIDEO_ID,
        sessionVideoId: VIDEO_ID,
        track: { sourceVideoId: VIDEO_ID, baseUrl },
      }).ok,
      false
    );
  }
});
