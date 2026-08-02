/**
 * @purpose 锁定原语选轨规则，防止字幕顺序、当前配音或固定英语覆盖视频原始音频语言。
 * @role    SubtitleTrackSelector 的 Node 内建测试。
 * @deps    node:test、node:assert、SubtitleTrackSelector
 * @gotcha  语言只按 original audio/default/首轨决定；manual 优先只发生在同一语言内。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { CaptionTrackDescriptor } from "./types.ts";
import { selectCaptionTrack } from "./SubtitleTrackSelector.ts";

const track = (
  languageCode: string,
  kind: CaptionTrackDescriptor["kind"],
  options: {
    isDefault?: boolean;
    isOriginalAudioLanguage?: boolean;
    vssId?: string;
  } = {}
): CaptionTrackDescriptor => ({
  source: "player-response",
  sourceVideoId: "abcdefghijk",
  languageCode,
  displayName: `${languageCode} ${kind}`,
  kind,
  vssId: options.vssId ?? `.${languageCode}.${kind}`,
  baseUrl: `https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=${languageCode}`,
  isDefault: Boolean(options.isDefault),
  isOriginalAudioLanguage: Boolean(options.isOriginalAudioLanguage),
  isTranslatable: true,
});

test("selects the original English audio language when Portuguese is first", () => {
  const selected = selectCaptionTrack([
    track("pt", "manual", { isDefault: true }),
    track("en", "asr", { isOriginalAudioLanguage: true }),
  ]);

  assert.equal(selected?.languageCode, "en");
});

test("selects the Japanese default language instead of an English track", () => {
  const selected = selectCaptionTrack([
    track("en", "manual"),
    track("ja", "asr", { isDefault: true }),
  ]);

  assert.equal(selected?.languageCode, "ja");
});

test("selects the English default language for an English video", () => {
  const selected = selectCaptionTrack([
    track("ja", "manual"),
    track("en", "asr", { isDefault: true }),
  ]);

  assert.equal(selected?.languageCode, "en");
});

test("prefers manual captions only within the default language", () => {
  const selected = selectCaptionTrack([
    track("en", "manual"),
    track("ja", "asr", { isDefault: true }),
    track("ja", "manual"),
  ]);

  assert.equal(selected?.languageCode, "ja");
  assert.equal(selected?.kind, "manual");
});

test("uses the first available language when YouTube has no default", () => {
  const selected = selectCaptionTrack([
    track("ja", "asr"),
    track("en", "manual"),
  ]);

  assert.equal(selected?.languageCode, "ja");
});

test("does not let another caption language override original Japanese audio", () => {
  const selected = selectCaptionTrack([
    track("en-US", "manual", { isDefault: true }),
    track("ja", "asr", { isOriginalAudioLanguage: true }),
  ]);

  assert.equal(selected?.languageCode, "ja");
});
