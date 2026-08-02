/**
 * @purpose 为 Tauri bundle 预编译 listenup CLI，并按 sidecar 目标三元组命名。
 * @role    tauri.conf beforeBuildCommand；让 production/DEV .app 都带同一安全 CLI。
 * @deps    node:child_process、node:fs、rustc、cargo、packages/listenup-cli/package.json
 * @gotcha  构建 CLI 时必须移除外层 Tauri 的 TAURI_CONFIG，否则 sidecar 尚未生成就会被校验。
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const desktopRoot = process.cwd();
const tauriRoot = join(desktopRoot, "src-tauri");
const cliPackage = JSON.parse(
  readFileSync(join(desktopRoot, "../../packages/listenup-cli/package.json"), "utf8")
);
const cliVersion = process.env.LISTENUP_CLI_VERSION ?? cliPackage.version;
const configuredTarget =
  process.env.LISTENUP_CLI_TARGET ?? process.env.TAURI_ENV_TARGET_TRIPLE;
const rustc = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
if (rustc.status !== 0) {
  throw new Error(rustc.stderr || "rustc -vV failed");
}
const hostTarget = rustc.stdout
  .split("\n")
  .find((line) => line.startsWith("host: "))
  ?.slice("host: ".length);
const target = configuredTarget ?? hostTarget;
if (!target) throw new Error("could not determine Rust target triple");

const cargoArgs = [
  "build",
  "--manifest-path",
  join(tauriRoot, "Cargo.toml"),
  "--release",
  "--bin",
  "listenup",
];
if (configuredTarget) cargoArgs.push("--target", target);
const cargoEnvironment = {
  ...process.env,
  LISTENUP_CLI_VERSION: cliVersion,
};
delete cargoEnvironment.TAURI_CONFIG;
const cargo = spawnSync("cargo", cargoArgs, {
  env: cargoEnvironment,
  stdio: "inherit",
});
if (cargo.status !== 0) process.exit(cargo.status ?? 1);

const executable = process.platform === "win32" ? "listenup.exe" : "listenup";
const source = configuredTarget
  ? join(tauriRoot, "target", target, "release", executable)
  : join(tauriRoot, "target", "release", executable);
const sidecarDirectory = join(tauriRoot, "target", "sidecars");
const suffix = process.platform === "win32" ? ".exe" : "";
const destination = join(sidecarDirectory, `listenup-${target}${suffix}`);
mkdirSync(sidecarDirectory, { recursive: true });
cpSync(source, destination);
console.log(`[listenup] prepared CLI sidecar: ${destination}`);
