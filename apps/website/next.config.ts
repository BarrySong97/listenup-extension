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
