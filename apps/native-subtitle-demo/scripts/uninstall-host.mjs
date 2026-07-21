import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

const hostDirectory = resolve(
  homedir(),
  "Library/Application Support/Google/Chrome/NativeMessagingHosts"
);
const manifestPath = resolve(hostDirectory, "com.listenup.native_subtitle_demo.json");
const wrapperPath = resolve(hostDirectory, "com.listenup.native_subtitle_demo.sh");

await Promise.all([rm(manifestPath, { force: true }), rm(wrapperPath, { force: true })]);
console.log(`Removed Native Messaging Host manifest:\n${manifestPath}`);
