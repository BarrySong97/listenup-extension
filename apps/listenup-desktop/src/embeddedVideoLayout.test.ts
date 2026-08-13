/**
 * @purpose 验证 Embedded 视频专注模式的窗口高度计算。
 * @role    防止最小化后裁掉标题栏或 16:9 视频。
 * @deps    node:test、embeddedVideoLayout。
 * @gotcha  断言使用 logical/CSS 像素，不涉及设备 scale factor。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  EMBEDDED_VIDEO_ONLY_MIN_WIDTH,
  embeddedVideoOnlyHeight,
} from "./embeddedVideoLayout.ts";

test("computes the minimum height from the header and a 16:9 video", () => {
  assert.equal(
    embeddedVideoOnlyHeight(EMBEDDED_VIDEO_ONLY_MIN_WIDTH, 103),
    297
  );
});

test("rounds fractional video height up so the last pixel is not clipped", () => {
  assert.equal(embeddedVideoOnlyHeight(341, 100), 294);
});

test("sanitizes invalid or negative layout measurements", () => {
  assert.equal(embeddedVideoOnlyHeight(Number.NaN, -20), 2);
});
