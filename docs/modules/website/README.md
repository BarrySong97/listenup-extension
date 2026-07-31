# website（`apps/website/`）

## 职责

ListenUp 的落地页与下载入口（macOS Desktop + Chrome Extension）。Next.js 16（App Router）+ HeroUI v3 + Tailwind v4，单页，**静态导出**部署在 Cloudflare Pages（`trylistenup.pages.dev`）。

边界：**管** 产品介绍、下载 CTA、OG 图；**不管** 任何后端能力——见下方红线。

## 文件清单与关系

```
app/
  layout.tsx        字体（Geist Sans/Mono + Instrument Serif）、metadata、OG、ClientProviders
  provider.tsx      HeroUI v3 Provider
  page.tsx          主页面：nav / hero / 下载 CTA / 右侧产品 mock / footer
  store-shot/page.tsx  Chrome Web Store 截图用的辅助路由（不在导航里，只为出图）
  opengraph-image.tsx  动态 OG 图（必须 `export const dynamic = "force-static"`）
  globals.css       Tailwind + @heroui/styles + 明暗基础色
  landing.css       落地页设计 token 与工具类（:root 变量，见 design.md）
  _components/        ⚠️ 整个目录当前未被任何页面引用，见下方注意事项
    ExtensionPanel.tsx     自绘的扩展面板演示（内联 SVG 图标）
    ScriptedPanel.tsx      带假光标的脚本化演示动画 → RealExtensionPanel
    extension/             从扩展搬来的面板组件副本（Shell/Item/States/ExplainView + 三个空桩 hook）
next.config.ts      transpilePackages: @listenup/mock-ui；BUILD_STATIC=1 时切静态导出
```

首屏右侧的桌面端窗口 mock 来自 [`@listenup/mock-ui`](../mock-ui/README.md)（`SubtitlePanelMock` / `LogoMark`）。

## 数据流

没有数据流——纯静态页面，无 API、无数据库、无表单提交。macOS 下载按钮指向 GitHub Releases 的 `/releases/latest`，Chrome Extension 按钮指向正式 Chrome Web Store 条目，GitHub 链接指向仓库。

## 对外接口

- 部署产物：`apps/website/out/`（`pnpm build:web:static`）
- 站点 URL 常量写死在 `layout.tsx` 的 `SITE_URL`；换自定义域名要改这里
- Desktop 展示版本写死在 `page.tsx` 的 `VERSION`，当前随首个 updater 版本同步为 `v0.2.0`；每次 Desktop 发版必须同步

## 注意事项

🚨 **必须保持可静态导出**（[ADR-0004](../../decisions/0004-website-static-export.md)）：不得新增 API route、`headers()`、cookies / 动态渲染。任何一条都会让 `pnpm build:web:static` 失败，Cloudflare Pages 随之挂掉。改完务必跑一次静态构建，不要只跑 `pnpm build:website`。

- **HeroUI v3 的 `Button` 不是链接**。下载 CTA 用 `Link` 组件套按钮样式，别用 `Button` + `onPress` 跳转。
- Chrome Extension CTA 使用 `page.tsx` 内联的 Chrome Web Store 品牌 SVG，与 Post 官网同源（SVG Logos，MIT），不要替换成扩展自身的产品图标。
- HeroUI v3 版本由根 `pnpm-workspace.yaml` 的 `catalog` 统一（`@heroui/react` / `@heroui/styles` 写 `"catalog:"`）。扩展用的是 HeroUI **v2**，不走这个 catalog，别互相"对齐"。
- **`app/_components/` 目前是未接线的遗留代码**：`page.tsx` 只用 `@listenup/mock-ui`，没有引用 `ExtensionPanel` / `ScriptedPanel`，因此 `_components/extension/` 那棵树也整体没被用到。它们是早期版本落地页的演示组件——想复用就接回页面，不打算用就删掉，别让它继续以"看起来在用"的样子留着。
- `app/_components/extension/` 是扩展面板组件的**副本**（三个音频 hook 还是空桩），不是共享代码。扩展那边改了不会自动同步。
- **历史遗留**：`.env.example` 里的 `FEISHU_WAITLIST_WEBHOOK_URL` 对应的 `app/api/waitlist/route.ts` 已随静态导出改造删除，该变量当前无人读取。
- Node ≥ 20.9（Cloudflare Pages 上设 `NODE_VERSION=22`）。

## 部署

Cloudflare Pages 项目 `trylistenup`，Git 集成，production 分支 `main`（push 即部署）。构建配置设在 CF 项目上而非仓库里：

| 项 | 值 |
|---|---|
| Build command | `pnpm run build:web:static` |
| Output directory | `apps/website/out` |
| Root directory | `/`（仓库根，pnpm 需要安装整个 workspace 才能解析 `@listenup/mock-ui`） |
| Env | `NODE_VERSION=22` |

详见 [构建产物与分发](../../topics/release-and-distribution.md)。
