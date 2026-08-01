/**
 * @purpose 为 Tauri bundle 预编译 listenup CLI，并按 sidecar 目标三元组命名。
 * @role    tauri.conf beforeBuildCommand；让 production/DEV .app 都带同一安全 CLI。
 * @deps    node:child_process、node:fs、rustc、cargo
 * @gotcha  跨平台构建必须由 TAURI_ENV_TARGET_TRIPLE 或 LISTENUP_CLI_TARGET 明确目标。
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const desktopRoot = process.cwd();
const tauriRoot = join(desktopRoot, "src-tauri");
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
const cargo = spawnSync("cargo", cargoArgs, { stdio: "inherit" });
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
