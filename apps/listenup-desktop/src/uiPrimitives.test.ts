/**
 * @purpose 防止 Desktop 业务 JSX 绕过 HeroUI primitives 重新使用原生交互元素。
 * @role    pnpm desktop test 的 UI 架构棘轮，扫描 src 下全部业务 TSX。
 * @deps    node:assert、node:fs、node:path、node:test、node:url
 * @gotcha  components/ui 是唯一允许封装第三方 primitives 的目录，不扫描 node_modules 或生成物。
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
