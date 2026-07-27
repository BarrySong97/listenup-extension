#!/usr/bin/env node
/**
 * @purpose 校验正式/DEV 的扩展 ID、Host、Desktop 标识和 Native Messaging 权限不会漂移。
 * @role    环境隔离 sensor；被 pre-commit 与人工验证调用。
 * @deps    config/listenup-environments.json、extension manifests、Tauri configs、node assert/crypto/fs
 * @gotcha  正式扩展 ID 固定为 Chrome Web Store 条目 nocah…；生产 manifest 不得携带本地 key。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = process.cwd();
const readJson = async (path) =>
  JSON.parse(await readFile(resolve(ROOT, path), "utf8"));

const environments = await readJson("config/listenup-environments.json");
const production = environments.production;
const development = environments.development;

const extensionIdPattern = /^[a-p]{32}$/;
assert.match(production.extensionId, extensionIdPattern);
assert.match(development.extensionId, extensionIdPattern);
assert.equal(
  production.extensionId,
  "nocahdalbgboblhbjkacpneakljldfjh",
  "production Extension ID must match the published Chrome Web Store item"
);

for (const field of [
  "extensionId",
  "nativeHostName",
  "desktopBundleId",
  "desktopProductName",
  "deepLinkScheme",
]) {
  assert.notEqual(
    production[field],
    development[field],
    `${field} must differ between production and development`
  );
}

const productionManifest = await readJson("apps/extension/manifest.json");
const developmentManifest = await readJson("apps/extension/manifest.dev.json");
assert.ok(
  productionManifest.permissions.includes("nativeMessaging"),
  "production extension must include nativeMessaging"
);
assert.ok(
  developmentManifest.permissions.includes("nativeMessaging"),
  "development extension must include nativeMessaging"
);
assert.ok(
  !Object.hasOwn(productionManifest, "key"),
  "production manifest must not include a local key; Chrome Web Store owns its ID"
);

const extensionIdFromKey = (key) => {
  const digest = createHash("sha256")
    .update(Buffer.from(key, "base64"))
    .digest()
    .subarray(0, 16);
  return [...digest]
    .flatMap((byte) => [byte >> 4, byte & 0x0f])
    .map((nibble) => String.fromCharCode("a".charCodeAt(0) + nibble))
    .join("");
};

assert.equal(
  extensionIdFromKey(developmentManifest.key),
  development.extensionId,
  "development manifest key must generate the configured DEV Extension ID"
);

const productionTauri = await readJson(
  "apps/listenup-desktop/src-tauri/tauri.conf.json"
);
const developmentTauri = await readJson(
  "apps/listenup-desktop/src-tauri/tauri.dev.conf.json"
);
assert.equal(productionTauri.identifier, production.desktopBundleId);
assert.equal(productionTauri.productName, production.desktopProductName);
assert.equal(developmentTauri.identifier, development.desktopBundleId);
assert.equal(developmentTauri.productName, development.desktopProductName);

const protocolSource = await readFile(
  resolve(
    ROOT,
    "apps/extension/src/shared/nativeSubtitleProtocol.ts"
  ),
  "utf8"
);
assert.match(protocolSource, /__LISTENUP_NATIVE_HOST__/);
assert.match(protocolSource, /__LISTENUP_DEEP_LINK__/);

console.log("✅ production/development environment identifiers are isolated");
