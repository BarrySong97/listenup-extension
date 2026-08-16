/**
 * @purpose 固定 Desktop 窗口 label 与视图形态的一对一回归契约。
 * @role    windowPresentation 的 Node 内建测试。
 * @deps    node:test、node:assert、windowPresentation
 * @gotcha  只有专用 cinema 窗口能进入影院视图；main 和未知 label 必须保持普通列表。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveWindowViewMode,
  WINDOW_GEOMETRY_STORAGE_KEYS,
} from "./windowPresentation.ts";

test("dedicated cinema window renders the cinema view", () => {
  assert.equal(resolveWindowViewMode("cinema"), "cinema");
});

test("main and unknown windows remain regular list views", () => {
  assert.equal(resolveWindowViewMode("main"), "list");
  assert.equal(resolveWindowViewMode("settings"), "list");
});

test("dedicated windows never reuse legacy single-panel geometry", () => {
  assert.deepEqual(WINDOW_GEOMETRY_STORAGE_KEYS, {
    list: {
      position: "listenup-window-position-main-v2",
      size: "listenup-window-size-main-v2",
    },
    cinema: {
      position: "listenup-window-position-cinema-v2",
      size: "listenup-window-size-cinema-v2",
    },
  });
});
