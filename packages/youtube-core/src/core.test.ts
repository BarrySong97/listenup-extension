/**
 * @purpose 锁定共享 YouTube 核心的选轨、POT URL、身份、JSON3 与播放世代行为。
 * @role    @listenup/youtube-core 的 Node 内建回归测试。
 * @deps    node:test、node:assert、index
 * @gotcha  fixture 必须使用虚构身份，不放入 Cookie 或用户数据。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSubtitleUrl,
  parseJSONSubtitles,
  PlaybackEpochTracker,
  selectCaptionTrack,
  validateCaptionVideoIdentity,
  type CaptionTrackDescriptor,
} from "./index.ts";

const VIDEO_ID = "abcdefghijk";
const track = (
  languageCode: string,
  kind: CaptionTrackDescriptor["kind"],
  options: Partial<CaptionTrackDescriptor> = {}
): CaptionTrackDescriptor => ({
  source: "player-response",
  sourceVideoId: VIDEO_ID,
  languageCode,
  displayName: `${languageCode} ${kind}`,
  kind,
  vssId: `.${languageCode}.${kind}`,
  baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=${languageCode}`,
  isDefault: false,
  isOriginalAudioLanguage: false,
  isTranslatable: true,
  ...options,
});

test("selects manual captions only inside the original audio language", () => {
  const selected = selectCaptionTrack([
    track("pt", "manual", { isDefault: true }),
    track("en", "asr", { isOriginalAudioLanguage: true }),
    track("en", "manual"),
  ]);
  assert.equal(selected?.languageCode, "en");
  assert.equal(selected?.kind, "manual");
});

test("builds a JSON3 URL from the current track request with POT context", () => {
  const url = new URL(
    buildSubtitleUrl(
      track("en", "manual", {
        requestUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en&pot=fake`,
        clientVersion: "2.test",
      })
    )
  );
  assert.equal(url.searchParams.get("fmt"), "json3");
  assert.equal(url.searchParams.get("pot"), "fake");
  assert.equal(url.searchParams.get("xorb"), "2");
  assert.equal(url.searchParams.get("cver"), "2.test");
});

test("rejects a caption URL whose video identity is stale", () => {
  assert.equal(
    validateCaptionVideoIdentity({
      expectedVideoId: VIDEO_ID,
      sessionVideoId: VIDEO_ID,
      track: {
        sourceVideoId: VIDEO_ID,
        baseUrl: "https://www.youtube.com/api/timedtext?v=oldvideo123&lang=en",
      },
    }).ok,
    false
  );
});

test("parses and orders non-empty JSON3 events", () => {
  assert.deepEqual(
    parseJSONSubtitles(
      JSON.stringify({
        events: [
          { tStartMs: 2000, dDurationMs: 500, segs: [{ utf8: "second" }] },
          { tStartMs: 1000, dDurationMs: 750, segs: [{ utf8: " first " }] },
          { tStartMs: 3000, dDurationMs: 500, segs: [{ utf8: " " }] },
        ],
      })
    ).map(({ startTime, endTime, text }) => ({ startTime, endTime, text })),
    [
      { startTime: 1, endTime: 1.75, text: "first" },
      { startTime: 2, endTime: 2.5, text: "second" },
    ]
  );
});

test("increments playbackEpoch only on a paused-to-playing transition", () => {
  const tracker = new PlaybackEpochTracker();
  assert.deepEqual(
    [false, true, true, true, false, false, true].map((isPlaying) =>
      tracker.update(isPlaying)
    ),
    [0, 1, 1, 1, 1, 1, 2]
  );
});
