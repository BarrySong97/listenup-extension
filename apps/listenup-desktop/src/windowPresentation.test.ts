/**
 * @purpose 固定 Desktop 窗口 label 与视图形态的一对一回归契约。
 * @role    windowPresentation 的 Node 内建测试。
 * @deps    node:test、node:assert、windowPresentation
 * @gotcha  只有专用 cinema 窗口能进入影院视图；main 和未知 label 必须保持普通列表。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveWindowViewMode } from "./windowPresentation.ts";

test("dedicated cinema window renders the cinema view", () => {
  assert.equal(resolveWindowViewMode("cinema"), "cinema");
});

test("main and unknown windows remain regular list views", () => {
  assert.equal(resolveWindowViewMode("main"), "list");
  assert.equal(resolveWindowViewMode("settings"), "list");
});
