#!/usr/bin/env node
/**
 * @purpose 构建 macOS arm64 Rust CLI，并生成可直接发布的最小 npm 目录。
 * @role    packages/listenup-cli 的唯一 artifact 生成入口。
 * @deps    cargo、node:child_process、node:fs、根 LICENSE、Desktop Rust crate
 * @gotcha  npm/ 是生成物；构建必须显式注入与 npm package 一致的 CLI 版本。
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const tauriRoot = join(repositoryRoot, "apps/listenup-desktop/src-tauri");
const packageJson = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8")
);
const target = "aarch64-apple-darwin";
const npmRoot = join(packageRoot, "npm");

if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error(
    `listenup-cli 0.1.x can only be packaged on macOS arm64; detected ${process.platform}-${process.arch}`
  );
}

const cargo = spawnSync(
  "cargo",
  [
    "build",
    "--manifest-path",
    join(tauriRoot, "Cargo.toml"),
    "--release",
    "--target",
    target,
    "--bin",
    "listenup",
  ],
  {
    env: { ...process.env, LISTENUP_CLI_VERSION: packageJson.version },
    stdio: "inherit",
  }
);
if (cargo.status !== 0) process.exit(cargo.status ?? 1);

rmSync(npmRoot, { force: true, recursive: true });
mkdirSync(join(npmRoot, "bin"), { recursive: true });
mkdirSync(join(npmRoot, "vendor/darwin-arm64"), { recursive: true });

const publishedPackage = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  license: packageJson.license,
  type: "module",
  bin: packageJson.bin,
  engines: packageJson.engines,
  os: packageJson.os,
  cpu: packageJson.cpu,
};
writeFileSync(
  join(npmRoot, "package.json"),
  `${JSON.stringify(publishedPackage, null, 2)}\n`
);
cpSync(join(packageRoot, "README.md"), join(npmRoot, "README.md"));
cpSync(join(repositoryRoot, "LICENSE"), join(npmRoot, "LICENSE"));
cpSync(join(packageRoot, "bin/listenup.mjs"), join(npmRoot, "bin/listenup.mjs"));
cpSync(
  join(tauriRoot, "target", target, "release", "listenup"),
  join(npmRoot, "vendor/darwin-arm64/listenup")
);
chmodSync(join(npmRoot, "bin/listenup.mjs"), 0o755);
chmodSync(join(npmRoot, "vendor/darwin-arm64/listenup"), 0o755);

console.log(
  `[listenup-cli] built ${packageJson.name}@${packageJson.version} for darwin-arm64`
);
