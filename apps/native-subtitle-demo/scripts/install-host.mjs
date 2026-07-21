import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST_NAME = "com.listenup.native_subtitle_demo";
const extensionId = process.argv.slice(2).find((argument) => argument !== "--");

if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) {
  console.error(
    "Usage: pnpm install:native-host-demo -- <32-character Chrome extension ID>"
  );
  process.exit(1);
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = resolve(
  appRoot,
  "src-tauri/target/release/bundle/macos/ListenUp Native Subtitle Demo.app/Contents/MacOS/listenup-native-subtitle-demo"
);

try {
  await access(executablePath);
} catch {
  console.error("Native Host executable was not found. Build it first with:");
  console.error("  pnpm build:native-host-demo");
  process.exit(1);
}

const manifestPath = resolve(
  homedir(),
  "Library/Application Support/Google/Chrome/NativeMessagingHosts",
  `${HOST_NAME}.json`
);
const wrapperPath = resolve(dirname(manifestPath), `${HOST_NAME}.sh`);
const logPath = resolve(
  homedir(),
  "Library/Logs",
  "ListenUp Native Subtitle Demo.log"
);

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
  description: "ListenUp real-time native subtitle demo",
  path: wrapperPath,
  type: "stdio",
  allowed_origins: [`chrome-extension://${extensionId}/`],
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Installed Native Messaging Host manifest:\n${manifestPath}`);
console.log(`Allowed extension: ${extensionId}`);
