#!/usr/bin/env node
/**
 * @purpose 校验环境标识、Native 协议、原语选轨、CLI 构建/数据边界与 migration 不会漂移。
 * @role    环境隔离 sensor；被 pre-commit 与人工验证调用。
 * @deps    环境矩阵、extension manifests/protocol/selector、Tauri/CLI/Query 配置、node assert/crypto/fs
 * @gotcha  ADR-0008：不得恢复英语优先、协议 v2、环境串库、sidecar 自举失败、watcher 或轮询。
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
const cliTauri = await readJson(
  "apps/listenup-desktop/src-tauri/tauri.cli.conf.json"
);
assert.equal(productionTauri.identifier, production.desktopBundleId);
assert.equal(productionTauri.productName, production.desktopProductName);
assert.equal(
  productionTauri.mainBinaryName,
  "listenup-desktop",
  "ADR-0008: the CLI binary must never replace the Tauri GUI executable"
);
assert.equal(developmentTauri.identifier, development.desktopBundleId);
assert.equal(developmentTauri.productName, development.desktopProductName);
assert.deepEqual(developmentTauri.bundle.externalBin, [
  "target/sidecars/listenup",
]);
assert.deepEqual(cliTauri.bundle.externalBin, ["target/sidecars/listenup"]);

const prepareCliSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/scripts/prepare-cli.mjs"),
  "utf8"
);
assert.match(
  prepareCliSource,
  /delete cargoEnvironment\.TAURI_CONFIG/,
  "CLI sidecar bootstrap must not inherit Tauri's externalBin overlay"
);

const protocolSource = await readFile(
  resolve(
    ROOT,
    "apps/extension/src/shared/nativeSubtitleProtocol.ts"
  ),
  "utf8"
);
assert.match(protocolSource, /__LISTENUP_NATIVE_HOST__/);
assert.match(protocolSource, /__LISTENUP_DEEP_LINK__/);
assert.match(protocolSource, /NATIVE_SUBTITLE_PROTOCOL_VERSION = 3/);
assert.match(protocolSource, /vssId: string/);
assert.match(protocolSource, /isDefault: boolean/);

const selectorSource = await readFile(
  resolve(
    ROOT,
    "apps/extension/src/pages/content/lib/captions/SubtitleTrackSelector.ts"
  ),
  "utf8"
);
assert.match(
  selectorSource,
  /preferredLanguages:\s*\[\]/,
  "ADR-0008: default caption selection must follow the video's source language"
);
assert.doesNotMatch(selectorSource, /preferredLanguages:\s*\[\s*["']en["']/);

const rustSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/lib.rs"),
  "utf8"
);
assert.match(rustSource, /const PROTOCOL_VERSION: u8 = 3/);

const cliSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/cli/mod.rs"),
  "utf8"
);
assert.match(cliSource, /"com\.listenup\.desktop"/);
assert.match(cliSource, /"com\.listenup\.desktop\.dev"/);
assert.match(cliSource, /conflicts_with = "commit"/);

const querySource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src/useSubtitleView.ts"),
  "utf8"
);
assert.match(querySource, /refetchOnWindowFocus: true/);
assert.doesNotMatch(querySource, /refetchInterval\s*:|PRAGMA\s+data_version|watchFile\s*\(/);

const initialMigration = await readFile(
  resolve(
    ROOT,
    "apps/listenup-desktop/src-tauri/migrations/20260801000000_subtitle_library.sql"
  )
);
assert.equal(
  createHash("sha384").update(initialMigration).digest("hex"),
  "19a225ad81360da4c6e8082f15762c47599b4bf90f92f7a9fb9331901cee7b5eaf439c600898afbc76421fb64f2bcbdc",
  "ADR-0008: published migrations are immutable; add a new migration instead"
);

console.log("✅ production/development environment identifiers are isolated");
