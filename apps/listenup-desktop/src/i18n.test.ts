/**
 * @purpose 锁定 Desktop 中英文资源键、语言规范化与 localStorage 持久化规则。
 * @role    Desktop i18n 的确定性棘轮，防止新增文案只翻译一种语言。
 * @deps    node:test、node:assert、./i18n/language、./i18n/resources
 * @gotcha  测试不初始化 React/i18next，确保可在纯 Node 环境运行。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeUiLanguage,
  readStoredUiLanguage,
  UI_LANGUAGE_STORAGE_KEY,
  writeStoredUiLanguage,
} from "./i18n/language.ts";
import { en, zhCN } from "./i18n/resources.ts";

const leafKeys = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    leafKeys(nested, prefix ? `${prefix}.${key}` : key)
  );
};

test("English and Chinese resources expose identical leaf keys", () => {
  assert.deepEqual(leafKeys(en).sort(), leafKeys(zhCN).sort());
});

test("normalizes Chinese variants and falls back other locales to English", () => {
  assert.equal(normalizeUiLanguage("zh-CN"), "zh-CN");
  assert.equal(normalizeUiLanguage("zh-Hant-TW"), "zh-CN");
  assert.equal(normalizeUiLanguage("EN-us"), "en");
  assert.equal(normalizeUiLanguage("ja"), "en");
  assert.equal(normalizeUiLanguage(null), "en");
});

test("persists and restores an explicit Desktop UI language", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };

  assert.equal(readStoredUiLanguage(storage), null);
  writeStoredUiLanguage("zh-CN", storage);
  assert.equal(values.get(UI_LANGUAGE_STORAGE_KEY), "zh-CN");
  assert.equal(readStoredUiLanguage(storage), "zh-CN");
});

test("Footer keeps language left and version beside updates on the right", () => {
  const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  const footerSource = appSource.slice(appSource.indexOf("<footer"), appSource.indexOf("</footer>") + 9);

  assert.ok(footerSource.includes("<LanguageSwitcher />"));
  assert.ok(footerSource.includes("justify-between"));
  assert.ok(footerSource.includes('t("footer.currentVersion"'));
  assert.ok(footerSource.includes('t("footer.checkUpdates")'));
  assert.ok(
    footerSource.indexOf('t("footer.currentVersion"') <
      footerSource.indexOf('t("footer.checkUpdates")')
  );
  assert.doesNotMatch(footerSource, /displayBlocks\.length|个语义块/);
});
