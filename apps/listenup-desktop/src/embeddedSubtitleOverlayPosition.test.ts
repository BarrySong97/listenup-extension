/**
 * @purpose 验证 Embedded 悬浮字幕位置的版本化存储、换算、移动和越界收敛。
 * @role    防止窗口缩放、卡片变高或损坏偏好让字幕离开视频区域。
 * @deps    node:assert、node:test、embeddedSubtitleOverlayPosition。
 * @gotcha  测试使用 CSS logical 像素，不涉及屏幕 scale factor。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_EMBEDDED_SUBTITLE_OVERLAY_POSITION,
  moveOverlayPositionByPixels,
  overlayPixelsToPosition,
  overlayPositionToPixels,
  parseOverlayPosition,
  type OverlayLayoutBounds,
} from "./embeddedSubtitleOverlayPosition.ts";

const bounds: OverlayLayoutBounds = {
  containerWidth: 400,
  containerHeight: 225,
  itemWidth: 200,
  itemHeight: 50,
  inset: 12,
};

test("rejects missing, malformed, outdated, and out-of-range storage", () => {
  for (const raw of [
    null,
    "not-json",
    '{"version":2,"x":0.2,"y":0.3}',
    '{"version":1,"x":-1,"y":0.3}',
    '{"version":1,"x":0.2,"y":null}',
  ]) {
    assert.deepEqual(parseOverlayPosition(raw), DEFAULT_EMBEDDED_SUBTITLE_OVERLAY_POSITION);
  }
});

test("round trips normalized positions through pixel coordinates", () => {
  const position = { version: 1 as const, x: 0.25, y: 0.8 };
  const pixels = overlayPositionToPixels(position, bounds);
  assert.deepEqual(pixels, { x: 56, y: 132.8 });
  assert.deepEqual(overlayPixelsToPosition(pixels, bounds), position);
});

test("clamps dragging to all video edges", () => {
  const start = { version: 1 as const, x: 0.5, y: 0.5 };
  assert.deepEqual(moveOverlayPositionByPixels(start, { x: -999, y: -999 }, bounds), {
    version: 1,
    x: 0,
    y: 0,
  });
  assert.deepEqual(moveOverlayPositionByPixels(start, { x: 999, y: 999 }, bounds), {
    version: 1,
    x: 1,
    y: 1,
  });
});

test("centers an item on an axis when it cannot travel", () => {
  const pixels = overlayPositionToPixels(DEFAULT_EMBEDDED_SUBTITLE_OVERLAY_POSITION, {
    ...bounds,
    containerWidth: 180,
    itemWidth: 220,
  });
  assert.equal(pixels.x, 0);
  assert.equal(
    overlayPixelsToPosition(pixels, {
      ...bounds,
      containerWidth: 180,
      itemWidth: 220,
    }).x,
    0.5
  );
});
