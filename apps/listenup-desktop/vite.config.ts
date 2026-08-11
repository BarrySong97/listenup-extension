/**
 * @purpose 桌面端前端的 Vite 配置（React Compiler + Tailwind v4，固定端口 1421）。
 * @role    tauri dev / build 使用的前端构建配置。
 * @deps    @vitejs/plugin-react、babel-plugin-react-compiler、@tailwindcss/vite
 * @gotcha  Compiler 必须是首个 Babel plugin；strictPort 固定 1421 且忽略 src-tauri 变更。
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
  ],
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
