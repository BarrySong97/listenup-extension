/**
 * @purpose 锁定播放器 100ms 采样只在播放且有订阅者时运行，并在暂停后清理。
 * @role    YouTubePlayerFacade 的 Node 内建时序测试。
 * @deps    node:test、node:assert、./YouTubePlayerFacade
 * @gotcha  fake window 同时会捕获 2 秒 video watchdog，断言必须按 interval delay 区分。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYBACK_SAMPLE_INTERVAL_MS,
  YouTubePlayerFacade,
} from "./YouTubePlayerFacade.ts";

class FakeVideo extends EventTarget {
  currentTime = 0;
  duration = 120;
  isConnected = true;
  paused = true;
  volume = 1;
}

test("samples while playing and stops the sampling clock on pause", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const intervals = new Map<
    number,
    { callback: () => void; delay: number }
  >();
  let nextIntervalId = 0;
  const video = new FakeVideo();
  let currentVideo: FakeVideo | null = video;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearInterval: (id: number) => intervals.delete(id),
      setInterval: (callback: () => void, delay: number) => {
        const id = ++nextIntervalId;
        intervals.set(id, { callback, delay });
        return id;
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelector: () => currentVideo,
    },
  });

  try {
    const facade = new YouTubePlayerFacade();
    const updates: Array<{ currentTime: number; reason: string }> = [];
    const unsubscribe = facade.subscribeState((state, reason) => {
      updates.push({ currentTime: state.currentTime, reason });
    });

    assert.equal(
      [...intervals.values()].some(
        (interval) => interval.delay === PLAYBACK_SAMPLE_INTERVAL_MS
      ),
      false
    );

    video.paused = false;
    video.dispatchEvent(new Event("play"));
    const playbackInterval = [...intervals.values()].find(
      (interval) => interval.delay === PLAYBACK_SAMPLE_INTERVAL_MS
    );
    assert.ok(playbackInterval);

    video.currentTime = 1.25;
    playbackInterval.callback();
    assert.deepEqual(updates.at(-1), {
      currentTime: 1.25,
      reason: "timeupdate",
    });

    video.paused = true;
    video.dispatchEvent(new Event("pause"));
    assert.equal(
      [...intervals.values()].some(
        (interval) => interval.delay === PLAYBACK_SAMPLE_INTERVAL_MS
      ),
      false
    );

    unsubscribe();
    currentVideo = null;
    facade.reset();
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  }
});

