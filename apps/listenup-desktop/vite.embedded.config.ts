/**
 * @purpose 把 Embedded YouTube document-start TypeScript 适配器打成单文件 IIFE。
 * @role    Rust build.rs 写入 Cargo OUT_DIR 后通过 include_str! 注入 child WebView。
 * @deps    vite、src/embedded/bridge.ts、@listenup/youtube-core
 * @gotcha  输出目录只能来自 LISTENUP_EMBEDDED_BRIDGE_OUT_DIR，禁止写回仓库生成物。
 */
import path from "node:path";
import { defineConfig } from "vite";

const outputDirectory = process.env.LISTENUP_EMBEDDED_BRIDGE_OUT_DIR;
if (!outputDirectory) {
  throw new Error("LISTENUP_EMBEDDED_BRIDGE_OUT_DIR is required");
}

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/embedded/bridge.ts"),
      formats: ["iife"],
      name: "ListenUpEmbeddedBridge",
      fileName: () => "embedded-bridge.js",
    },
    minify: true,
    outDir: outputDirectory,
    target: "safari15",
  },
});
