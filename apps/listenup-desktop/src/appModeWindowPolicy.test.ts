/**
 * @purpose 固定 appMode 切换不覆盖 Desktop 窗口尺寸的回归契约。
 * @role    appModeWindowPolicy 的 Node 内建测试。
 * @deps    node:test、node:assert、appModeWindowPolicy
 * @gotcha  运行中进入 Menubar 必须保留当前几何；不要恢复固定 400×640。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppModeWindowPolicy } from "./appModeWindowPolicy.ts";

test("runtime switch to menubar keeps the current desktop size", () => {
  assert.deepEqual(
    resolveAppModeWindowPolicy({
      nextMode: "menubar",
      desktopMode: "list",
      initial: false,
    }),
    { viewMode: "list", sizeMode: "list", resize: false }
  );
});

test("menubar startup restores the last desktop view size", () => {
  assert.deepEqual(
    resolveAppModeWindowPolicy({
      nextMode: "menubar",
      desktopMode: "cinema",
      initial: true,
    }),
    { viewMode: "list", sizeMode: "cinema", resize: true }
  );
});

test("runtime switch back to desktop lets Rust restore captured geometry", () => {
  assert.deepEqual(
    resolveAppModeWindowPolicy({
      nextMode: "desktop",
      desktopMode: "cinema",
      initial: false,
    }),
    { viewMode: "cinema", sizeMode: "cinema", resize: false }
  );
});
