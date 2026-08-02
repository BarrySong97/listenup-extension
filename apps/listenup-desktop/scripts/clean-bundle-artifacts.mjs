#!/usr/bin/env node
/**
 * @purpose 删除本仓库 Tauri target 目录里的本地 ListenUp `.app` bundle，避免 macOS 将其登记成重复应用。
 * @role    本地完整构建或手工 bundle 回归后的收尾命令；只清生成物，不碰 `/Applications` 和用户数据。
 * @deps    node:fs/promises、node:path、node:url
 * @gotcha  只能遍历 target 下明确列出的 bundle/macos 目录；不得扩大到工作区、用户目录或 `/Applications`。
 */
import { readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDirectory, "..");
const targetRoot = resolve(desktopRoot, "src-tauri", "target");
const bundleDirectories = [
  resolve(targetRoot, "debug", "bundle", "macos"),
  resolve(targetRoot, "release", "bundle", "macos"),
  resolve(targetRoot, "aarch64-apple-darwin", "debug", "bundle", "macos"),
  resolve(targetRoot, "aarch64-apple-darwin", "release", "bundle", "macos"),
];
const listenUpAppPattern = /^ListenUp(?: .+)?\.app$/;

let removedCount = 0;
for (const bundleDirectory of bundleDirectories) {
  let entries;
  try {
    entries = await readdir(bundleDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }

  for (const entry of entries) {
    if (!listenUpAppPattern.test(entry.name)) continue;
    const appPath = resolve(bundleDirectory, entry.name);
    if (dirname(appPath) !== bundleDirectory) {
      throw new Error(`refusing to remove path outside bundle directory: ${appPath}`);
    }
    await rm(appPath, { recursive: true, force: false });
    removedCount += 1;
    console.log(`[listenup] removed local app bundle: ${appPath}`);
  }
}

if (removedCount === 0) {
  console.log("[listenup] no local app bundles to clean");
}
