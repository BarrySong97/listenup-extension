#!/usr/bin/env node
/**
 * @purpose 校验 Extension 构建产物的入口页、i18n locale、环境名称和关键权限。
 * @role    Chrome/Firefox/DEV build 的收尾棘轮，防止 Preview 404 或 manifest 本地化漂移。
 * @deps    node:fs、node:path、构建产物 manifest.json 与 _locales
 * @gotcha  只读生成物，不修改 dist；Firefox background 必须保持 scripts 转换。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputName = process.argv[2];

if (!outputName) {
  throw new Error("Usage: node scripts/check-build.mjs <output-directory>");
}

const outputRoot = resolve(appRoot, outputName);
const requiredFiles = [
  "manifest.json",
  "src/pages/newtab/index.html",
  "src/pages/options/index.html",
  "src/pages/popup/index.html",
  "_locales/en/messages.json",
  "_locales/zh_CN/messages.json",
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(outputRoot, file))) {
    throw new Error(`${outputName}: missing required build output ${file}`);
  }
}

const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(outputRoot, relativePath), "utf8"));
const manifest = readJson("manifest.json");
const englishLocale = readJson("_locales/en/messages.json");
const chineseLocale = readJson("_locales/zh_CN/messages.json");
const isDev = outputName.includes("dev");
const isFirefox = outputName.includes("firefox");

if (manifest.default_locale !== "en") {
  throw new Error(`${outputName}: default_locale must remain en`);
}
if (!manifest.permissions?.includes("nativeMessaging")) {
  throw new Error(`${outputName}: nativeMessaging permission is required`);
}
if (manifest.name !== (isDev ? "__MSG_extNameDev__" : "__MSG_extName__")) {
  throw new Error(`${outputName}: localized extension name does not match the environment`);
}
if (JSON.stringify(Object.keys(englishLocale).sort()) !== JSON.stringify(Object.keys(chineseLocale).sort())) {
  throw new Error(`${outputName}: en and zh_CN manifest locale keys differ`);
}
if (isFirefox && !Array.isArray(manifest.background?.scripts)) {
  throw new Error(`${outputName}: Firefox background.scripts conversion is missing`);
}
if (!isFirefox && typeof manifest.background?.service_worker !== "string") {
  throw new Error(`${outputName}: Chrome background.service_worker is missing`);
}

console.log(`Extension build verified: ${outputName}`);
