/**
 * @purpose 固定 Desktop 单窗口原生返回事件与分模式几何回归契约。
 * @role    windowPresentation 的 Node 内建确定性测试。
 * @deps    node:test、node:assert、windowPresentation
 * @gotcha  tray/关闭恢复 list 必须有稳定事件；native Panel 切换细节由环境 sensor 锁定。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  RETURN_TO_LIST_EVENT,
  WINDOW_GEOMETRY_STORAGE_KEYS,
} from "./windowPresentation.ts";

test("single main keeps separate list and cinema geometry", () => {
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

test("native close and tray paths use a stable return-to-list event", () => {
  assert.equal(RETURN_TO_LIST_EVENT, "desktop-return-to-list");
});
