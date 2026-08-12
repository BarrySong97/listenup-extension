/**
 * @purpose 防止 Desktop 业务 JSX 绕过 UI primitives，并锁定 Tooltip、Modal 与字幕行交互边界。
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

test("Desktop icon tooltips use the explicit HeroUI compound trigger", () => {
  const source = readFileSync(
    path.join(UI_PRIMITIVES_ROOT, "DesktopIconButton.tsx"),
    "utf8"
  );

  assert.equal(source.includes("<Tooltip.Trigger>"), true);
  assert.equal(source.includes("</Tooltip.Trigger>"), true);
  assert.equal(
    source.indexOf("<Tooltip.Trigger>") < source.indexOf("<Tooltip.Content"),
    true
  );
});

test("Desktop dialogs share the HeroUI modal primitive and bottom animation", () => {
  const modalPrimitiveSource = readFileSync(
    path.join(UI_PRIMITIVES_ROOT, "DesktopModal.tsx"),
    "utf8"
  );
  const stylesSource = readFileSync(
    path.join(SOURCE_ROOT, "styles.css"),
    "utf8"
  );
  const dialogFiles = [
    "BrowserSourceSwitchModal.tsx",
    "CookieSettings.tsx",
    "EmbeddedLinkEditorModal.tsx",
    "VideoSessionPicker.tsx",
  ];

  assert.equal(modalPrimitiveSource.includes('from "@heroui/react"'), true);
  assert.equal(modalPrimitiveSource.includes("<Modal.Backdrop"), true);
  assert.equal(modalPrimitiveSource.includes("<Modal.Container"), true);
  assert.equal(modalPrimitiveSource.includes("<Modal.Dialog"), true);
  assert.equal(modalPrimitiveSource.includes('placement = "bottom"'), true);
  assert.equal(modalPrimitiveSource.includes("isDismissable = true"), true);
  assert.equal(modalPrimitiveSource.includes("isDismissable={false}"), true);
  assert.equal(modalPrimitiveSource.includes("bg-modal"), true);
  assert.equal(modalPrimitiveSource.includes("data-slot=\"modal-dialog\""), true);
  assert.equal(modalPrimitiveSource.includes("onPointerDownCapture"), true);
  assert.equal(modalPrimitiveSource.includes("data-tauri-drag-region"), false);
  assert.equal(modalPrimitiveSource.includes("startDragging()"), false);
  assert.equal(modalPrimitiveSource.includes("suppressDismissUntilRef"), false);
  assert.equal(modalPrimitiveSource.includes("bg-glass/95 backdrop-blur-xl"), true);
  assert.equal(modalPrimitiveSource.includes("activate_text_input"), false);

  const textFieldSource = readFileSync(
    path.join(UI_PRIMITIVES_ROOT, "DesktopTextField.tsx"),
    "utf8"
  );
  assert.equal(textFieldSource.includes("forwardRef"), true);
  assert.equal(textFieldSource.includes("ref={ref}"), true);

  for (const fileName of [
    "BrowserSourceSwitchModal.tsx",
    "EmbeddedLinkEditorModal.tsx",
  ]) {
    const source = readFileSync(path.join(SOURCE_ROOT, fileName), "utf8");
    assert.equal(/^\s+autoFocus$/m.test(source), false, fileName);
    assert.equal(source.includes("preventScroll: true"), true, fileName);
    assert.equal(
      /<DesktopTextField\s+ref=\{inputRef\}/.test(source),
      true,
      fileName
    );
  }

  const pickerSource = readFileSync(
    path.join(SOURCE_ROOT, "VideoSessionPicker.tsx"),
    "utf8"
  );
  assert.equal(pickerSource.includes("isDismissable={false}"), true);
  assert.equal(pickerSource.includes('bg-[#151517]'), true);
  assert.equal(pickerSource.includes('bg-[#151517]/95'), false);

  for (const fileName of dialogFiles) {
    const source = readFileSync(path.join(SOURCE_ROOT, fileName), "utf8");
    assert.equal(source.includes("<DesktopModal"), true, fileName);
    assert.equal(/aria-modal|role=["']dialog|absolute inset-0/.test(source), false, fileName);
  }

  assert.equal(
    stylesSource.includes('.desktop-modal-container[data-entering="true"]'),
    true
  );
  assert.equal(
    stylesSource.includes('.desktop-modal-container[data-exiting="true"]'),
    true
  );
  assert.equal(
    stylesSource.includes('.desktop-modal-backdrop[data-exiting="true"]'),
    true
  );
  assert.equal(stylesSource.includes("desktop-modal-mask-exit 240ms"), true);
  assert.equal(stylesSource.includes("translate3d(0, 100vh, 0)"), true);
  assert.equal(stylesSource.includes("prefers-reduced-motion: reduce"), true);
  assert.equal(stylesSource.includes("--color-modal: #17171b"), true);
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
