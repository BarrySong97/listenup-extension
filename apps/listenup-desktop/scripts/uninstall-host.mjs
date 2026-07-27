/**
 * @purpose 删除 Native Messaging Host 的 manifest 与 wrapper。
 * @role    pnpm uninstall:desktop-host 调它。
 * @deps    node fs/os/path、scripts/native-environment.mjs
 * @gotcha  默认卸 production，带 --dev 才卸 DEV；Host 名必须来自环境矩阵
 */
import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseNativeEnvironmentArgs } from "./native-environment.mjs";

const { environmentName, environment } = parseNativeEnvironmentArgs(
  process.argv.slice(2)
);
const HOST_NAME = environment.nativeHostName;

const hostDirectory = resolve(
  homedir(),
  "Library/Application Support/Google/Chrome/NativeMessagingHosts"
);
const manifestPath = resolve(hostDirectory, `${HOST_NAME}.json`);
const wrapperPath = resolve(hostDirectory, `${HOST_NAME}.sh`);

await Promise.all([rm(manifestPath, { force: true }), rm(wrapperPath, { force: true })]);
console.log(
  `Removed Native Messaging Host manifest (${environmentName}):\n${manifestPath}`
);
