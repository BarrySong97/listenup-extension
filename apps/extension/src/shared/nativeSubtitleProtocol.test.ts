/**
 * @purpose 锁定 Native Messaging v4 playback command 的版本、身份与 action 守卫。
 * @role    nativeSubtitleProtocol 的 Node 内建测试。
 * @deps    node:test、node:assert、nativeSubtitleProtocol
 * @gotcha  tabId 必须是整数，未知 action 和旧协议版本都要拒绝。
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

test("rejects old versions, unknown actions and non-integer tab ids", () => {
  for (const candidate of [
    { ...validCommand, version: 3 },
    { ...validCommand, action: "toggle" },
    { ...validCommand, tabId: 2.5 },
    { ...validCommand, sessionId: null },
  ]) {
    assert.equal(isNativeSubtitlePlaybackCommand(candidate), false);
  }
});
