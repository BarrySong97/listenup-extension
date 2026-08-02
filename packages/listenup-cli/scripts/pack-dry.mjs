#!/usr/bin/env node
/**
 * @purpose 对生成的 npm 包执行 dry-run，并拒绝任何意外文件进入 tarball。
 * @role    npm 发布前的确定性包内容安全门。
 * @deps    npm CLI、node:child_process、node:fs
 * @gotcha  允许列表必须与 build.mjs 生成的最小目录同步更新。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmRoot = join(packageRoot, "npm");
const expectedFiles = new Set([
  "LICENSE",
  "README.md",
  "bin/listenup.mjs",
  "package.json",
  "vendor/darwin-arm64/listenup",
]);
const npmCache =
  process.env.npm_config_cache ??
  join(process.env.TMPDIR ?? "/tmp", "listenup-cli-npm-cache");
const raw = execFileSync("npm", ["pack", "./npm", "--dry-run", "--json"], {
  cwd: packageRoot,
  encoding: "utf8",
  env: { ...process.env, npm_config_cache: npmCache },
});
const [report] = JSON.parse(raw);
const actualFiles = new Set(report.files.map((file) => file.path));
const unexpected = [...actualFiles].filter((file) => !expectedFiles.has(file));
const missing = [...expectedFiles].filter((file) => !actualFiles.has(file));

if (unexpected.length || missing.length) {
  throw new Error(
    `npm package contents mismatch\nunexpected: ${unexpected.join(", ") || "none"}\nmissing: ${missing.join(", ") || "none"}`
  );
}

const metadata = JSON.parse(readFileSync(join(npmRoot, "package.json"), "utf8"));
if (metadata.private || JSON.stringify(metadata).includes("workspace:")) {
  throw new Error("publish package must not be private or contain workspace dependencies");
}
for (const executable of [
  join(npmRoot, "bin/listenup.mjs"),
  join(npmRoot, "vendor/darwin-arm64/listenup"),
]) {
  if ((statSync(executable).mode & 0o111) === 0) {
    throw new Error(`${executable} is not executable`);
  }
}

console.log(
  `[listenup-cli] npm pack dry-run passed (${report.files.length} files, ${report.unpackedSize} bytes unpacked)`
);
