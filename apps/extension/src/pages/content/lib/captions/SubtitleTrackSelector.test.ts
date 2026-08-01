/**
 * @purpose 锁定原语选轨规则，防止默认行为重新退化成固定英语优先。
 * @role    SubtitleTrackSelector 的 Node 内建测试。
 * @deps    node:test、node:assert、SubtitleTrackSelector
 * @gotcha  语言之间按 default/首轨决定；manual 优先只发生在同一语言内。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { CaptionTrackDescriptor } from "./types.ts";
import { selectCaptionTrack } from "./SubtitleTrackSelector.ts";

const track = (
  languageCode: string,
  kind: CaptionTrackDescriptor["kind"],
  options: { isDefault?: boolean; vssId?: string } = {}
): CaptionTrackDescriptor => ({
  source: "player-response",
  sourceVideoId: "abcdefghijk",
  languageCode,
  displayName: `${languageCode} ${kind}`,
  kind,
  vssId: options.vssId ?? `.${languageCode}.${kind}`,
  baseUrl: `https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=${languageCode}`,
  isDefault: Boolean(options.isDefault),
  isTranslatable: true,
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

test("still honors an explicit preferred language override", () => {
  const selected = selectCaptionTrack(
    [track("ja", "manual", { isDefault: true }), track("en-US", "manual")],
    { preferredLanguages: ["en"] }
  );

  assert.equal(selected?.languageCode, "en-US");
});
