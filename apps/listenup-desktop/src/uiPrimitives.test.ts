/**
 * @purpose 防止 Desktop 业务 JSX 绕过 UI primitives，并锁定字幕行无 React state 的即时 CSS hover。
 * @role    pnpm desktop test 的 UI 架构棘轮，扫描 src 下全部业务 TSX。
 * @deps    node:assert、node:fs、node:path、node:test、node:url
 * @gotcha  components/ui 是唯一允许封装交互 primitives 的目录；虚拟字幕行必须保留无 React Aria hover state 的专用例外。
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
  const rowButtonSource = readFileSync(
    path.join(UI_PRIMITIVES_ROOT, "DesktopRowButton.tsx"),
    "utf8"
  );

  assert.equal(source.includes("group-hover:opacity-100"), true);
  assert.equal(source.includes("[will-change:opacity]"), true);
  assert.equal(source.includes("hover:bg-white/[0.07]"), false);
  assert.equal(source.includes("transition-[background-color"), false);
  assert.equal(source.includes("DesktopRowButton"), true);
  assert.equal(source.includes("DesktopButton"), false);
  assert.equal(/onMouse(?:Enter|Leave)/.test(source), false);
  assert.equal(rowButtonSource.includes('from "@heroui'), false);
  assert.equal(rowButtonSource.includes('from "react-aria'), false);
  assert.equal(/\buse(?:Hover|State)\s*\(/.test(rowButtonSource), false);
});
