#!/usr/bin/env node
/**
 * @purpose 把 Tauri 生成的 GitHub API updater 资产 URL 改成无需 API 配额的公开下载 URL。
 * @role    Desktop Release 后处理脚本；修改草稿 Release 的 latest.json 后再允许公开发布。
 * @deps    node assert/fs、Tauri updater latest.json、GitHub Release 资产命名约定
 * @gotcha  必须校验 tag 与 JSON version 一致，避免把更新元数据指向另一个版本的签名包。
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const [metadataPath, repository, tag] = process.argv.slice(2);

assert.ok(
  metadataPath && repository && tag,
  "usage: rewrite-updater-json.mjs <latest.json> <owner/repo> <tag>"
);
assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);

const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
assert.equal(tag, `v${metadata.version}`, "release tag must match updater version");
assert.ok(
  metadata.platforms && typeof metadata.platforms === "object",
  "updater metadata must contain platforms"
);

const assetName = `ListenUp.Desktop_${metadata.version}_aarch64.app.tar.gz`;
const downloadUrl = `https://github.com/${repository}/releases/download/${tag}/${assetName}`;
const platforms = Object.values(metadata.platforms);

assert.ok(platforms.length > 0, "updater metadata must contain at least one platform");
for (const platform of platforms) {
  assert.ok(platform && typeof platform === "object", "invalid updater platform");
  assert.equal(typeof platform.signature, "string", "updater signature is required");
  platform.url = downloadUrl;
}

await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`rewrote ${platforms.length} updater URL(s) to ${downloadUrl}`);
