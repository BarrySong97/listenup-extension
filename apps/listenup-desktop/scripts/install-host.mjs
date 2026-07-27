/**
 * @purpose 安装 Chrome Native Messaging Host manifest 与可执行 wrapper。
 * @role    pnpm install:desktop-host 调它；联调前的必要步骤。
 * @deps    node fs/os/path、scripts/native-environment.mjs
 * @gotcha  不允许临时覆盖 Extension ID；--dev 与默认 production 必须严格走环境矩阵。见 docs/topics/native-messaging.md
 */
import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNativeEnvironmentArgs } from "./native-environment.mjs";

const { environmentName, environment } = parseNativeEnvironmentArgs(
  process.argv.slice(2)
);
const isDev = environmentName === "development";
const {
  extensionId,
  nativeHostName: HOST_NAME,
  desktopProductName: PRODUCT_NAME,
} = environment;

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = resolve(
  appRoot,
  `src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app/Contents/MacOS/listenup-desktop`
);

try {
  await access(executablePath);
} catch {
  console.error("Native Host executable was not found. Build it first with:");
  console.error(`  pnpm ${isDev ? "build:desktop:dev" : "build:desktop"}`);
  process.exit(1);
}

const manifestPath = resolve(
  homedir(),
  "Library/Application Support/Google/Chrome/NativeMessagingHosts",
  `${HOST_NAME}.json`
);
const wrapperPath = resolve(dirname(manifestPath), `${HOST_NAME}.sh`);
const logPath = resolve(homedir(), "Library/Logs", `${PRODUCT_NAME}.log`);

const shellQuote = (value) => `'${value.replaceAll("'", `'"'"'`)}'`;

await mkdir(dirname(manifestPath), { recursive: true });
await mkdir(dirname(logPath), { recursive: true });
await writeFile(
  wrapperPath,
  [
    "#!/bin/sh",
    `printf '%s %s\\n' \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \"$1\" >> ${shellQuote(logPath)}`,
    `exec ${shellQuote(executablePath)} \"$@\" 2>> ${shellQuote(logPath)}`,
    "",
  ].join("\n"),
  "utf8"
);
await chmod(wrapperPath, 0o755);

const manifest = {
  name: HOST_NAME,
  description: `${PRODUCT_NAME} real-time subtitle viewer`,
  path: wrapperPath,
  type: "stdio",
  allowed_origins: [`chrome-extension://${extensionId}/`],
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(
  `Installed Native Messaging Host manifest (${isDev ? "development" : "production"}):\n${manifestPath}`
);
console.log(`Allowed extension: ${extensionId}`);
