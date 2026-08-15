/**
 * @purpose Chrome / Firefox 共用的 Vite 基础配置与合成后的 manifest。
 * @role    被 vite.config.chrome.ts 和 vite.config.firefox.ts mergeConfig 继承。
 * @deps    @crxjs/vite-plugin、@tailwindcss/vite、manifest*.json、package.json、config/listenup-environments.json
 * @gotcha  正式与 DEV 都含 nativeMessaging，但 Host / deep link 必须按环境矩阵注入；见 docs/modules/extension/build-and-manifest.md
 */
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "path";
import { ManifestV3Export } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, BuildOptions } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { stripDevIcons, crxI18n } from "./custom-vite-plugins";
import manifest from "./manifest.json";
import devManifest from "./manifest.dev.json";
import pkg from "./package.json";

const isDev = process.env.__DEV__ === "true";
const environments = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../config/listenup-environments.json"),
    "utf8"
  )
);
const environment = environments[isDev ? "development" : "production"];
const localize = true;

export const baseManifest = {
  ...manifest,
  version: pkg.version,
  ...(isDev ? devManifest : ({} as ManifestV3Export)),
  ...(localize
    ? {
        name: isDev ? "__MSG_extNameDev__" : "__MSG_extName__",
        description: isDev
          ? "__MSG_extDescriptionDev__"
          : "__MSG_extDescription__",
        default_locale: "en",
      }
    : {}),
} as ManifestV3Export;

export const baseBuildOptions: BuildOptions = {
  sourcemap: isDev,
  emptyOutDir: !isDev,
  rollupOptions: {
    input: [resolve(__dirname, "src/pages/newtab/index.html")],
  },
};

export default defineConfig({
  define: {
    __LISTENUP_DEV__: JSON.stringify(isDev),
    __LISTENUP_NATIVE_HOST__: JSON.stringify(environment.nativeHostName),
    __LISTENUP_DEEP_LINK__: JSON.stringify(
      `${environment.deepLinkScheme}://open`
    ),
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    react(),
    stripDevIcons(isDev),
    crxI18n({ localize, src: "./src/locales" }),
  ],
  publicDir: resolve(__dirname, "public"),
});
