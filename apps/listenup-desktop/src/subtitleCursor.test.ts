/**
 * @purpose 锁定 Desktop cursor 的原语直用、译文时间映射、间隙与播放完成语义。
 * @role    subtitleCursor 的 Node 内建测试。
 * @deps    node:test、node:assert、./subtitleCursor、./types
 * @gotcha  测试块必须按时间排序，与字幕 domain 输出契约一致。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { CursorState } from "./types.ts";
import {
  findSubtitleIndexAtTime,
  resolveSubtitleCursorPresentation,
  type TimedSubtitleBlock,
} from "./subtitleCursor.ts";

const blocks: TimedSubtitleBlock[] = [
  { startTime: 0, endTime: 1 },
  { startTime: 1.2, endTime: 2 },
  { startTime: 2, endTime: 3 },
];

const cursor = (
  currentTime: number,
  currentIndex: number
): CursorState => ({
  sessionId: "session",
  videoId: "video",
  currentTime,
  currentIndex,
  isPaused: false,
  isAdPlaying: false,
  sentAt: Date.now(),
});

test("uses the live source index without remapping stale currentTime", () => {
  assert.deepEqual(
    resolveSubtitleCursorPresentation(blocks, cursor(0.99, 1), true),
    { activeIndex: 1, playedThroughIndex: -1 }
  );
});

test("maps translated blocks by time and preserves subtitle gaps", () => {
  assert.equal(findSubtitleIndexAtTime(blocks, 1.1), -1);
  assert.deepEqual(
    resolveSubtitleCursorPresentation(blocks, cursor(1.1, 1), false),
    { activeIndex: -1, playedThroughIndex: 0 }
  );
  assert.equal(findSubtitleIndexAtTime(blocks, 1.2), 1);
});

test("keeps live source index minus one authoritative", () => {
  assert.deepEqual(
    resolveSubtitleCursorPresentation(blocks, cursor(1.25, -1), true),
    { activeIndex: -1, playedThroughIndex: 0 }
  );
});

test("keeps the earlier block active for overlapping source ranges", () => {
  const overlapping = [
    { startTime: 0, endTime: 2 },
    { startTime: 1.5, endTime: 3 },
  ];
  assert.equal(findSubtitleIndexAtTime(overlapping, 1.75), 0);
});

test("marks every block played after the final subtitle", () => {
  assert.deepEqual(
    resolveSubtitleCursorPresentation(blocks, cursor(4, -1), false),
    { activeIndex: -1, playedThroughIndex: 2 }
  );
});
