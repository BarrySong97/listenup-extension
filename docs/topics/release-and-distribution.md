# 构建产物与分发

## 这是什么 / 为什么单独成篇

三个 app 走三条完全不同的分发路径（手工打包 / GitHub Release / Cloudflare Pages），CI 也分散在两个 workflow 里。放在任一模块文档下都不完整。

## 产物一览

| 产物 | 命令 | 输出 | 分发 |
|---|---|---|---|
| Chrome 扩展 | `pnpm build:extension` | `apps/extension/dist_chrome/` | 手工 zip / 商店（尚未自动化） |
| Firefox 扩展 | `pnpm build:firefox` | `apps/extension/dist_firefox/` | 手工 |
| Dev 扩展（DEV ID / Host） | `pnpm build:extension:native-demo` | `apps/extension/dist_chrome_dev/` | 只本地 Load unpacked |
| 桌面 app | `pnpm build:desktop` | `.app` / `.dmg` | GitHub Release |
| 官网 | `pnpm build:web:static` | `apps/website/out/` | Cloudflare Pages |

以上全是生成物，都不要手工编辑或提交（`.gitignore` 已覆盖 `dist*/`、`apps/website/out/`、`*.zip`）。

## CI

### `.github/workflows/ci.yml` — Build and Zip Chrome Extension

**只有 `workflow_dispatch`**，不在 push / PR 上跑。装依赖（`--frozen-lockfile`）→ `pnpm build:chrome` → 上传 `apps/extension/dist_chrome` 作为 artifact。Node 版本取自 `.nvmrc`，pnpm 钉 `10.14.0`。

⚠️ 也就是说**目前没有任何自动 CI 守住主干**——`check-docs`、扩展构建都靠本地 hook 和自觉。要加门禁的话这个 workflow 是最合适的落点（把 `node scripts/check-docs.mjs --base main` 加进去）。

### `.github/workflows/release-desktop.yml` — Release ListenUp Desktop (macOS)

推 `v*` tag 或手动触发。macOS runner + Rust `aarch64-apple-darwin`：

1. 装依赖
2. **重新生成 production Info.plist**（`node apps/listenup-desktop/scripts/gen-info-plist.mjs`）——不依赖开发者最后一次本地构建留下的 scheme，避免发出带 `listenup-dev://` 的包
3. 可选 Apple 签名 / 公证：只有 `APPLE_CERTIFICATE` secret 存在时才启用；**Tauri 会把"设置了但为空"的 `APPLE_CERTIFICATE` 当成"导入这个证书"然后失败**，所以脚本只在 secret 真的非空时才写进 `$GITHUB_ENV`
4. 强制检查 `TAURI_SIGNING_PRIVATE_KEY`，缺失就终止，避免发布一个后续无法被客户端信任的更新包
5. `tauri-action` 构建 `--bundles app,dmg`，同时上传 `.app.tar.gz`、`.sig` 和 `latest.json`，发布为 **draft** release

正式 Desktop 内含 Host 自动注册逻辑。用户安装后首次启动，app 会写入只允许正式扩展 `nocahdalbgboblhbjkacpneakljldfjh` 的 `com.listenup.desktop` manifest；DEV build 写入另一份 `.dev` manifest，不会覆盖正式环境。

可选 Apple secrets：`APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY`（签名），`APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_P8`（公证）。都不配就是未签名包，用户首次打开需要右键 → 打开。

updater 的 `TAURI_SIGNING_PRIVATE_KEY` 是必需项，和 Apple 证书不是同一套密钥。公钥内置在 Desktop；私钥只存在于 GitHub Secret 和发布者的安全备份。`releases/latest` 不会解析到 draft，所以发布前可先核对资产，只有把 draft 正式发布后应用内检查更新才会发现它。

手动触发和 tag 触发都使用 Tauri 配置版本生成 `v__VERSION__` tag，避免 `workflow_dispatch` 从 `main` 运行时错误创建名为 `main` 的 Release。

## 官网部署（Cloudflare Pages）

项目 `trylistenup` → https://trylistenup.pages.dev，Git 集成 `BarrySong97/listenup-extension`，production 分支 `main`（push 即部署）。

构建配置设在 **CF 项目上，不在仓库里**：

| 项 | 值 |
|---|---|
| Build command | `pnpm run build:web:static` |
| Build output directory | `apps/website/out` |
| Root directory | `/`（仓库根——pnpm 要装整个 workspace 才能解析 `@listenup/mock-ui`） |
| Env | `NODE_VERSION=22`（CF 默认 18，Next.js 16 要 ≥20.9） |

踩过的坑：

- build command 少写结尾的 `build` 会让 pnpm 报 `Unknown option: 'recursive'`
- 静态导出要求 `BUILD_STATIC=1`（→ `next.config.ts` 里的 `output: "export"`），且不能有 API route、`headers()`、layout 里的动态渲染
- `opengraph-image.tsx` 必须 `export const dynamic = "force-static"`

见 [ADR-0004](../decisions/0004-website-static-export.md)。

## 官网下载按钮指向哪里

`apps/website/app/page.tsx` 的 `MAC_DOWNLOAD_URL` 写死为 `https://github.com/BarrySong97/listenup-extension/releases/latest`，永远解析到最新已发布 Release 的 macOS 包；`CHROME_EXTENSION_URL` 指向正式 Chrome Web Store 条目。发 Desktop release 或在同一商店条目更新 Extension 时**不需要**改官网链接。页面上的 `VERSION` 常量是手写的，发版后记得同步。

## 相关

- [extension 构建与 manifest](../modules/extension/build-and-manifest.md) · [website 模块](../modules/website/README.md) · [运行手册](../run.md)
