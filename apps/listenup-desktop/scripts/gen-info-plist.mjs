/**
 * @purpose 按 LISTENUP_ENV 生成 src-tauri/Info.plist 里的深链接 scheme 与 bundle 名。
 * @role    构建前自动运行（tauri:build / tauri:build:dev 与 CI 都会调）。
 * @deps    node fs/path、scripts/native-environment.mjs
 * @gotcha  scheme / bundle ID 必须来自环境矩阵；发 production 前仍要重新生成。见 docs/topics/release-and-distribution.md
 */
// 按 LISTENUP_ENV 生成 src-tauri/Info.plist：
// dev 和 production 是两个独立 app，深链接 scheme 必须不同，
// 否则 macOS 无法把 listenup:// 和 listenup-dev:// 分派给正确的 app。
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getBuildEnvironment } from "./native-environment.mjs";

const { environmentName, environment } = getBuildEnvironment();
const isDev = environmentName === "development";
const scheme = environment.deepLinkScheme;
const bundleId = environment.desktopBundleId;

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>${bundleId}</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>${scheme}</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
`;

const plistPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src-tauri/Info.plist"
);
await writeFile(plistPath, plist, "utf8");
console.log(
  `Generated Info.plist for ${isDev ? "development" : "production"} (${scheme}://)`
);
