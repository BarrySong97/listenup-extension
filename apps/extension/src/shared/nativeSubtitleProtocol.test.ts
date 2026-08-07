/**
 * @purpose 锁定 Native Messaging v4 playback command 的版本、身份、action 与 seek 时间守卫。
 * @role    nativeSubtitleProtocol 的 Node 内建测试。
 * @deps    node:test、node:assert、nativeSubtitleProtocol
 * @gotcha  tabId 必须是整数；seekTime 只允许跟随 seek，且必须有限、非负。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  isNativeSubtitlePlaybackCommand,
  NATIVE_SUBTITLE_PROTOCOL_VERSION,
} from "./nativeSubtitleProtocol.ts";

const validCommand = {
  kind: "playbackCommand",
  version: NATIVE_SUBTITLE_PROTOCOL_VERSION,
  commandId: "command-1",
  tabId: 42,
  sessionId: "session-1",
  videoId: "video-1",
  action: "pause",
};

test("accepts a complete v4 playback command", () => {
  assert.equal(isNativeSubtitlePlaybackCommand(validCommand), true);
});

test("accepts seek only with a finite non-negative target", () => {
  assert.equal(
    isNativeSubtitlePlaybackCommand({
      ...validCommand,
      action: "seek",
      seekTime: 12.5,
    }),
    true
  );

  for (const seekTime of [undefined, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      isNativeSubtitlePlaybackCommand({
        ...validCommand,
        action: "seek",
        seekTime,
      }),
      false
    );
  }
});

test("rejects old versions, unknown actions and non-integer tab ids", () => {
  for (const candidate of [
    { ...validCommand, version: 3 },
    { ...validCommand, action: "toggle" },
    { ...validCommand, seekTime: 12.5 },
    { ...validCommand, tabId: 2.5 },
    { ...validCommand, sessionId: null },
  ]) {
    assert.equal(isNativeSubtitlePlaybackCommand(candidate), false);
  }
});
