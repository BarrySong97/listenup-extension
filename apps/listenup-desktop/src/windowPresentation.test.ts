/**
 * @purpose 固定 Desktop 窗口 label、影院呈现事件与 hover 工具条回归契约。
 * @role    windowPresentation 的 Node 内建确定性测试。
 * @deps    node:test、node:assert、windowPresentation
 * @gotcha  工具条只允许由入场短显或真实 pointer 命中显示，不能退回永久显示。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CINEMA_PRESENTED_EVENT,
  resolveCinemaToolbarVisibility,
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

test("cinema presentation uses a stable native-to-webview event", () => {
  assert.equal(CINEMA_PRESENTED_EVENT, "desktop-cinema-presented");
});

test("cinema toolbar is visible only for the entry hint or pointer hover", () => {
  assert.equal(
    resolveCinemaToolbarVisibility({
      hintVisible: false,
      pointerInside: false,
    }),
    false
  );
  assert.equal(
    resolveCinemaToolbarVisibility({
      hintVisible: true,
      pointerInside: false,
    }),
    true
  );
  assert.equal(
    resolveCinemaToolbarVisibility({
      hintVisible: false,
      pointerInside: true,
    }),
    true
  );
});
