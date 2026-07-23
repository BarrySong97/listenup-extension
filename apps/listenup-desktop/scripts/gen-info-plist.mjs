// 按 LISTENUP_ENV 生成 src-tauri/Info.plist：
// dev 和 production 是两个独立 app，深链接 scheme 必须不同，
// 否则 macOS 无法把 listenup:// 和 listenup-dev:// 分派给正确的 app。
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const isDev = process.env.LISTENUP_ENV === "development";
const scheme = isDev ? "listenup-dev" : "listenup";
const bundleId = isDev ? "com.listenup.desktop.dev" : "com.listenup.desktop";

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
