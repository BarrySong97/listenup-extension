#!/usr/bin/env node
/**
 * @purpose 启动 npm 包内固定的 macOS arm64 listenup Rust 二进制。
 * @role    npm `listenup` bin 的薄平台校验与进程转发层。
 * @deps    node:child_process、node:url、vendor/darwin-arm64/listenup
 * @gotcha  不读取数据库或改写 JSON；参数、stdio、signal 和退出状态必须原样转发。
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin" || process.arch !== "arm64") {
  console.error(
    `listenup 0.1.x supports macOS Apple Silicon only; detected ${process.platform}-${process.arch}.`
  );
  process.exit(1);
}

const binary = fileURLToPath(
  new URL("../vendor/darwin-arm64/listenup", import.meta.url)
);
const child = spawn(binary, process.argv.slice(2), { stdio: "inherit" });
const forwardedSignals = ["SIGINT", "SIGTERM", "SIGHUP"];

for (const signal of forwardedSignals) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.once("error", (error) => {
  console.error(`listenup failed to start: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    for (const forwardedSignal of forwardedSignals) {
      process.removeAllListeners(forwardedSignal);
    }
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
