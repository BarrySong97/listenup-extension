# ListenUp Website

ListenUp 的落地页与下载入口。Next.js（App Router）+ HeroUI v3，静态导出部署在 Cloudflare Pages。

## 快速开始

```bash
pnpm install       # 在仓库根执行
pnpm dev:website   # http://localhost:3000
```

构建：`pnpm build:website`（普通构建）/ `pnpm build:web:static`（静态导出到 `out/`，部署用的就是这条）。

> 🚨 改完必须跑一次 `pnpm build:web:static`。这个站不能有 API route 或动态渲染，否则 Cloudflare Pages 部署会挂。

## 文档

本 app 的全部文档在仓库根的 [`docs/modules/website/`](../../docs/modules/website/README.md)，部署细节见 [`docs/topics/release-and-distribution.md`](../../docs/topics/release-and-distribution.md)。
