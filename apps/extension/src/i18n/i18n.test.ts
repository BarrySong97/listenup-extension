/**
 * @purpose 锁定中英文资源键、插值变量与语言规范化行为。
 * @role    Extension i18n 的确定性棘轮，防止新增文案只翻译一种语言。
 * @deps    node:test、node:assert、./language、./resources、manifest locale JSON
 * @gotcha  资源比较递归到叶子键；插值变量也必须逐项一致。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  normalizeUiLanguage,
  readStoredUiLanguage,
  UI_LANGUAGE_STORAGE_KEY,
  writeStoredUiLanguage,
} from "./language.ts";
import { en, zhCN } from "./resources.ts";

const flatten = (value: unknown, prefix = ""): Record<string, string> => {
  if (typeof value === "string") {
    return { [prefix]: value };
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (result, [key, child]) => ({
      ...result,
      ...flatten(child, prefix ? `${prefix}.${key}` : key),
    }),
    {}
  );
};

const interpolationNames = (message: string) =>
  [...message.matchAll(/{{\s*([^},\s]+).*?}}/g)]
    .map((match) => match[1])
    .sort();

test("normalizes Chinese variants and falls back other locales to English", () => {
  assert.equal(normalizeUiLanguage("zh-CN"), "zh-CN");
  assert.equal(normalizeUiLanguage("zh-Hant-TW"), "zh-CN");
  assert.equal(normalizeUiLanguage(" EN-us "), "en");
  assert.equal(normalizeUiLanguage("ja"), "en");
  assert.equal(normalizeUiLanguage(null), "en");
});

test("persists and restores an explicit UI language", async () => {
  const values: Record<string, unknown> = {};
  const storageArea = {
    get: (
      _keys: string | string[] | Record<string, unknown> | null,
      callback: (items: Record<string, unknown>) => void
    ) => callback({ ...values }),
    set: (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(values, items);
      callback?.();
    },
  } as unknown as Pick<chrome.storage.StorageArea, "get" | "set">;

  assert.equal(await readStoredUiLanguage(storageArea), null);
  await writeStoredUiLanguage("zh-CN", storageArea);
  assert.equal(values[UI_LANGUAGE_STORAGE_KEY], "zh-CN");
  assert.equal(await readStoredUiLanguage(storageArea), "zh-CN");
});

test("English and Chinese React resources have identical keys and interpolation variables", () => {
  const english = flatten(en);
  const chinese = flatten(zhCN);

  assert.deepEqual(Object.keys(chinese).sort(), Object.keys(english).sort());
  for (const key of Object.keys(english)) {
    assert.deepEqual(
      interpolationNames(chinese[key]),
      interpolationNames(english[key]),
      `interpolation mismatch at ${key}`
    );
  }
});

test("manifest locales expose the same message keys", () => {
  const localeRoot = fileURLToPath(new URL("../locales/", import.meta.url));
  const english = JSON.parse(readFileSync(`${localeRoot}en/messages.json`, "utf8"));
  const chinese = JSON.parse(readFileSync(`${localeRoot}zh_CN/messages.json`, "utf8"));

  assert.deepEqual(Object.keys(chinese).sort(), Object.keys(english).sort());
});
