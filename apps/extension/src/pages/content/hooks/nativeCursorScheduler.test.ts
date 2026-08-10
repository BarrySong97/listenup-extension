/**
 * @purpose 锁定 Native cursor 的普通节流、seek 强制刷新和 session 清理时序。
 * @role    nativeCursorScheduler 的 Node 内建测试。
 * @deps    node:test、node:assert、nativeCursorScheduler
 * @gotcha  fake timer 必须显式推进，避免测试依赖真实墙钟。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  NATIVE_SUBTITLE_PROTOCOL_VERSION,
  type NativeSubtitleCursorPayload,
} from "../../../shared/nativeSubtitleProtocol.ts";
import {
  NATIVE_CURSOR_THROTTLE_MS,
  NativeCursorScheduler,
} from "./nativeCursorScheduler.ts";

const cursor = (
  currentTime: number,
  currentIndex: number
): NativeSubtitleCursorPayload => ({
  version: NATIVE_SUBTITLE_PROTOCOL_VERSION,
  sessionId: "session",
  videoId: "video",
  playbackEpoch: 1,
  currentTime,
  currentIndex,
  isPaused: false,
  isAdPlaying: false,
  sentAt: currentTime * 1000,
});

const createHarness = () => {
  let now = 0;
  let nextTimerId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const sent: NativeSubtitleCursorPayload[] = [];
  const scheduler = new NativeCursorScheduler({
    throttleMs: NATIVE_CURSOR_THROTTLE_MS,
    now: () => now,
    schedule: (callback, delayMs) => {
      const id = ++nextTimerId;
      timers.set(id, { at: now + delayMs, callback });
      return { cancel: () => timers.delete(id) };
    },
    send: (value) => sent.push(value),
  });
  const advanceTo = (target: number) => {
    while (true) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at)[0];
      if (!due) break;
      const [id, timer] = due;
      timers.delete(id);
      now = timer.at;
      timer.callback();
    }
    now = target;
  };
  return { scheduler, sent, advanceTo, timers };
};

test("throttles normal cursor updates and sends only the latest value", () => {
  const harness = createHarness();
  harness.scheduler.update(cursor(1, 0));
  harness.advanceTo(20);
  harness.scheduler.update(cursor(1.02, 0));
  harness.advanceTo(50);
  harness.scheduler.update(cursor(1.05, 0));

  assert.deepEqual(
    harness.sent.map((value) => value.currentTime),
    [1]
  );
  harness.advanceTo(NATIVE_CURSOR_THROTTLE_MS);
  assert.deepEqual(
    harness.sent.map((value) => value.currentTime),
    [1, 1.05]
  );
});

test("force cancels a pending timer and immediately sends a seek cursor", () => {
  const harness = createHarness();
  harness.scheduler.update(cursor(1, 0));
  harness.advanceTo(50);
  harness.scheduler.update(cursor(1.05, 0));
  harness.advanceTo(80);
  harness.scheduler.update(cursor(90, 8), { force: true });

  assert.deepEqual(
    harness.sent.map((value) => [value.currentTime, value.currentIndex]),
    [
      [1, 0],
      [90, 8],
    ]
  );
  assert.equal(harness.timers.size, 0);
});

test("seek into a subtitle gap sends index minus one immediately", () => {
  const harness = createHarness();
  harness.scheduler.update(cursor(1, 0));
  harness.advanceTo(20);
  harness.scheduler.update(cursor(20, -1), { force: true });

  assert.equal(harness.sent.at(-1)?.currentIndex, -1);
});

test("dispose cancels pending work and rejects late updates", () => {
  const harness = createHarness();
  harness.scheduler.update(cursor(1, 0));
  harness.advanceTo(10);
  harness.scheduler.update(cursor(1.01, 0));
  harness.scheduler.dispose();
  harness.advanceTo(500);
  harness.scheduler.update(cursor(2, 1), { force: true });

  assert.deepEqual(
    harness.sent.map((value) => value.currentTime),
    [1]
  );
  assert.equal(harness.timers.size, 0);
});
