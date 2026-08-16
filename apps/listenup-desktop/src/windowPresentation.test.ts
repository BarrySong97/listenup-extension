/**
 * @purpose 固定 Desktop 窗口 label、影院呈现事件与双窗口几何回归契约。
 * @role    windowPresentation 的 Node 内建确定性测试。
 * @deps    node:test、node:assert、windowPresentation
 * @gotcha  隐藏后复用的 cinema 必须有稳定呈现事件；CSS/native hover 细节由环境 sensor 锁定。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CINEMA_PRESENTED_EVENT,
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
