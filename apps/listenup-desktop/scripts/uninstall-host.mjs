import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

// 默认卸载 production；带 --dev 卸载 dev 的 host manifest
const isDev = process.argv.slice(2).includes("--dev");
const HOST_NAME = isDev ? "com.listenup.desktop.dev" : "com.listenup.desktop";

const hostDirectory = resolve(
  homedir(),
  "Library/Application Support/Google/Chrome/NativeMessagingHosts"
);
const manifestPath = resolve(hostDirectory, `${HOST_NAME}.json`);
const wrapperPath = resolve(hostDirectory, `${HOST_NAME}.sh`);

await Promise.all([rm(manifestPath, { force: true }), rm(wrapperPath, { force: true })]);
console.log(`Removed Native Messaging Host manifest:\n${manifestPath}`);
