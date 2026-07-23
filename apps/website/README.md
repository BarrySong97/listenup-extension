# ListenUp Website

This is a Next.js app copied from `install-ipa-to-iphone/webs` into the ListenUp monorepo.

## Feishu waitlist integration

The homepage waitlist form posts to `POST /api/waitlist`. The route triggers
the Feishu Flow webhook configured in `FEISHU_WAITLIST_WEBHOOK_URL`.

The webhook receives:

- `event`: `waitlist.joined`
- `email`: submitted email address
- `source`: form source, currently `homepage`
- `submittedAt`: ISO timestamp

The Feishu Flow should handle downstream actions such as creating the Bitable
record and sending the Feishu notification.

## Getting Started

From the monorepo root, install dependencies and run the development server:

```bash
pnpm install
pnpm dev:website
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Build from the monorepo root:

```bash
pnpm build:website
```

## Environment

Copy `.env.example` to `.env.local` when setting up a new machine and provide `FEISHU_WAITLIST_WEBHOOK_URL`.

## Key Files

- `app/page.tsx`: homepage（CTA 使用 HeroUI `Button`）
- `app/api/waitlist/route.ts`: Feishu waitlist API route
- `app/provider.tsx`: app-level providers
- `public/`: image and static assets

HeroUI v3（`@heroui/react` / `@heroui/styles`）版本由 monorepo 根目录 `pnpm-workspace.yaml` 的 `catalog` 统一管理。

## Deploy

This app can be deployed as a normal Next.js application. The Feishu webhook environment variable must be configured in the deployment target.
