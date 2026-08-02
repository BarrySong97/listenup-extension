/**
 * @purpose 桌面端前端的 Vite 配置（React + Tailwind v4，固定端口 1421）。
 * @role    tauri dev / build 使用的前端构建配置。
 * @deps    @vitejs/plugin-react、@tailwindcss/vite
 * @gotcha  strictPort 固定 1421 且忽略 src-tauri 目录变更，否则 Rust 改动会触发前端热重载风暴
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
