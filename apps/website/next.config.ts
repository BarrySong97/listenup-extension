/**
 * @purpose Next 配置：转译内部包、指定 turbopack root，并在 BUILD_STATIC=1 时切静态导出。
 * @role    官网构建的总开关；Cloudflare Pages 走的就是静态导出那条路径。
 * @deps    @listenup/mock-ui（transpilePackages）
 * @gotcha  静态导出下不能有 API route / 动态渲染，且图片优化被关掉。见 docs/decisions/0004-website-static-export.md
 */
import type { NextConfig } from "next";
import path from "node:path";

// Set BUILD_STATIC=1 to produce a fully static export in `out/` for
// Cloudflare Pages. Left unset for `next dev` and the default server build.
const isStatic = process.env.BUILD_STATIC === "1";

const nextConfig: NextConfig = {
  transpilePackages: ["@listenup/mock-ui"],
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  // Static export: emit plain HTML/assets and disable the Image Optimization
  // API (no server to run it). Only applied for the Cloudflare Pages build.
  ...(isStatic ? { output: "export" as const, images: { unoptimized: true } } : {}),
};

export default nextConfig;
