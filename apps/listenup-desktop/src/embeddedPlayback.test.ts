/**
 * @purpose 锁定 Desktop URL 安全门、双入口显示条件和恢复态动作集合。
 * @role    Desktop Node 前端回归测试。
 * @deps    node:test、node:assert、embeddedPlayback、useViewerSession
 * @gotcha  无效链接测试必须证明不会产生可传给 Rust 的规范化 URL。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  embeddedRecoveryActions,
  normalizeYoutubeWatchUrl,
  shouldShowSourceEntry,
} from "./embeddedPlayback.ts";
import { EMPTY_VIEWER_SNAPSHOT } from "./useViewerSession.ts";

test("normalizes supported watch and youtu.be links", () => {
  assert.equal(
    normalizeYoutubeWatchUrl("https://youtu.be/abcdefghijk?t=3"),
    "https://www.youtube.com/watch?v=abcdefghijk"
  );
  assert.equal(
    normalizeYoutubeWatchUrl(
      "https://www.youtube.com/watch?feature=share&v=abc_def-123"
    ),
    "https://www.youtube.com/watch?v=abc_def-123"
  );
});

test("rejects non-watch, non-HTTPS and ambiguous short links", () => {
  for (const invalid of [
    "http://www.youtube.com/watch?v=abcdefghijk",
    "https://www.youtube.com/",
    "https://www.youtube.com/channel/x?v=abcdefghijk",
    "https://youtu.be/abcdefghijk/extra",
    "https://example.com/watch?v=abcdefghijk",
  ]) {
    assert.throws(() => normalizeYoutubeWatchUrl(invalid), invalid);
  }
});

test("shows dual source entry only in coordinator empty state", () => {
  assert.equal(shouldShowSourceEntry(EMPTY_VIEWER_SNAPSHOT), true);
  assert.equal(
    shouldShowSourceEntry({
      ...EMPTY_VIEWER_SNAPSHOT,
      sourceMode: "browserActive",
    }),
    false
  );
  assert.equal(
    shouldShowSourceEntry({
      ...EMPTY_VIEWER_SNAPSHOT,
      sourceMode: "enteringEmbedded",
    }),
    false
  );
});

test("recovery exposes reload, change-link and explicit exit only", () => {
  assert.deepEqual(embeddedRecoveryActions("embeddedRecovering"), [
    "reload",
    "changeLink",
    "exit",
  ]);
  assert.deepEqual(embeddedRecoveryActions("embeddedActive"), []);
});
