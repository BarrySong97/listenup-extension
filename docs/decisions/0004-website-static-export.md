# 0004. 官网走 Next.js 静态导出，部署在 Cloudflare Pages

- 状态：已采纳
- 日期：2026-07-25（回填历史决策）

## 背景

官网最初带一个飞书 waitlist 的 API route（`app/api/waitlist/route.ts` + `FEISHU_WAITLIST_WEBHOOK_URL`），需要一个能跑 Node 的部署环境。后来产品重心转向"下载 macOS app"，页面退化成纯静态落地页，再为一个不用的接口养一套 server 运行时不划算。

## 决策

1. 官网只做静态页面：删掉 API route，构建走 `BUILD_STATIC=1` → `next.config.ts` 里的 `output: "export"` + `images.unoptimized`
2. 部署到 Cloudflare Pages 项目 `trylistenup`，Git 集成，push `main` 自动发布
3. `next dev` 和默认 `pnpm build:website` 保持非静态，方便本地开发；静态导出只在 `pnpm build:web:static` 这条路径上启用

## 理由

- 静态站在 CF Pages 上零成本、全球 CDN、无冷启动
- 用环境变量 gate 而不是直接把 `output: "export"` 写死，是为了不牺牲 `next dev` 的开发体验
- 下载入口指向 GitHub Releases 的 `/releases/latest`，本来就不需要服务端

## 后果

- 🚨 **官网从此不能有任何服务端能力**：API route、`headers()`、cookies、动态渲染，加任何一个都会让 `pnpm build:web:static` 失败，CF 部署随之挂掉。这条已列入红线
- `opengraph-image.tsx` 必须 `export const dynamic = "force-static"`
- CF 的 Root directory 必须设成仓库根，否则 pnpm 装不到内部包 `@listenup/mock-ui`；Node 版本要手动设成 22（CF 默认 18，Next.js 16 要 ≥20.9）
- 改完官网只跑 `pnpm build:website` **不足以**证明能部署，必须跑 `pnpm build:web:static`
- 遗留：`.env.example` 里的 `FEISHU_WAITLIST_WEBHOOK_URL` 已无人读取
