import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// dev 和 production 是两个独立 app：host 名、.app 路径、日志都按 --dev 区分
const args = process.argv.slice(2).filter((argument) => argument !== "--");
const isDev = args.includes("--dev");
const extensionId = args.find((argument) => /^[a-p]{32}$/.test(argument));

const HOST_NAME = isDev ? "com.listenup.desktop.dev" : "com.listenup.desktop";
const PRODUCT_NAME = isDev ? "ListenUp Desktop DEV" : "ListenUp Desktop";

if (!extensionId) {
  console.error(
    "Usage: pnpm install:desktop-host -- <32-character Chrome extension ID> [--dev]"
  );
  process.exit(1);
}

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
