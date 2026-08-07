/**
 * @purpose 防止 Desktop 业务 JSX 绕过 HeroUI primitives，并锁定字幕行的即时 CSS hover 反馈。
 * @role    pnpm desktop test 的 UI 架构棘轮，扫描 src 下全部业务 TSX。
 * @deps    node:assert、node:fs、node:path、node:test、node:url
 * @gotcha  components/ui 是唯一允许封装第三方 primitives 的目录；字幕 hover 不得改回 mouse state 或背景 transition。
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const UI_PRIMITIVES_ROOT = path.join(SOURCE_ROOT, "components", "ui");

const collectBusinessTsx = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (absolutePath.startsWith(UI_PRIMITIVES_ROOT)) return [];
    if (entry.isDirectory()) return collectBusinessTsx(absolutePath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [absolutePath] : [];
  });

test("Desktop business JSX uses HeroUI primitives instead of native controls", () => {
  const violations = collectBusinessTsx(SOURCE_ROOT).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    return /<(button|select)\b/i.test(source)
      ? [path.relative(SOURCE_ROOT, filePath)]
      : [];
  });

  assert.deepEqual(
    violations,
    [],
    `native button/select found outside components/ui: ${violations.join(", ")}`
  );
});

test("subtitle rows use immediate CSS hover without mouse state", () => {
  const source = readFileSync(path.join(SOURCE_ROOT, "SubtitleList.tsx"), "utf8");

  assert.equal(source.includes("hover:bg-white/[0.07]"), true);
  assert.equal(source.includes("transition-[background-color"), false);
  assert.equal(/onMouse(?:Enter|Leave)/.test(source), false);
});
