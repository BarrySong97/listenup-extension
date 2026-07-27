# 运行手册

所有命令都在**仓库根目录**执行（根 `package.json` 用 `pnpm --filter` 转发到各 app）。

## 环境要求

- Node：见 `.nvmrc`（CI 用它锁版本；website 的 Next.js 16 需要 ≥ 20.9，Cloudflare Pages 上设的是 22）
- 包管理：pnpm `10.14.0`（`packageManager` 字段已钉死）
- 桌面端额外需要：Rust stable + `aarch64-apple-darwin` target、Xcode CLT（仅 macOS，仅在动 `apps/listenup-desktop` 时需要）
- 环境变量：只有 website 有，`apps/website/.env.example` → `.env.local`

## 安装

```bash
pnpm install
```

## 本地开发

```bash
pnpm dev:extension     # Chrome 扩展，nodemon 监听并重建 dist_chrome/
pnpm dev:firefox       # Firefox 扩展
pnpm dev:website       # Next.js，http://localhost:3000
pnpm dev:desktop       # Tauri dev（development 环境，DEV app）
pnpm dev               # turbo run dev --parallel（全部一起跑）
```

扩展改完需要在浏览器里重新加载：

- Chrome：`chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist_chrome/`
- Firefox：`about:debugging#/runtime/this-firefox` → Load temporary Add-on → `apps/extension/dist_firefox/manifest.json`

## 构建

```bash
pnpm build                        # turbo，全仓
pnpm build:extension              # = build:chrome，产物 apps/extension/dist_chrome/
pnpm build:firefox                # 产物 apps/extension/dist_firefox/
pnpm build:extension:native-demo  # DEV ID / Host 的扩展，功能与 production 一致
pnpm build:website                # Next 默认（server）构建
pnpm build:web:static             # BUILD_STATIC=1，静态导出到 apps/website/out/（Cloudflare Pages 用）
pnpm build:desktop                # ListenUp Desktop.app（production）
pnpm build:desktop:dev            # ListenUp Desktop DEV.app（development）
```

## 测试

本仓库**没有 JS 侧自动化测试**。当前可跑的自动检查只有：

```bash
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml   # Rust 单测
pnpm --filter @listenup/website lint                                    # 只有 website 配了 eslint
pnpm lint                                                               # turbo 转发，实际只有 website 有 lint task
```

其余靠「构建通过 + 手工回归」，清单见 [testing.md](testing.md)。

## 文档同步检查（收尾必跑）

```bash
node scripts/check-docs.mjs            # 未提交工作区
node scripts/check-docs.mjs --base main # 对比已提交差异（CI / 审分支）
node scripts/check-docs.mjs --strict   # 警告也算失败
```

## Native Messaging Host

正式或 DEV Desktop 启动时会自动注册自己的 Host。以下命令只用于本地修复/联调，不接受 Extension ID 覆盖：

```bash
pnpm install:desktop-host             # production
pnpm install:desktop-host -- --dev    # development
pnpm uninstall:desktop-host
pnpm uninstall:desktop-host -- --dev
```

完整联调步骤见 [topics/native-messaging.md](topics/native-messaging.md)。

## 常用脚本

- `apps/listenup-desktop/scripts/gen-info-plist.mjs` — 按 `LISTENUP_ENV` 生成深链接 scheme 的 Info.plist，构建前自动跑
- `scripts/check-docs.mjs` — 文档防漂移检查器
- `scripts/hooks/` — Claude / Codex 共享的 hook 脚本（guard / guard-files / format-lint / pre-commit）

## 装上强制层（新机器 clone 后做一次）

```bash
git config core.hooksPath scripts/hooks        # 启用 pre-commit
mkdir -p ~/.codex/prompts && ln -sf "$PWD/.codex/prompts/sync-docs.md" ~/.codex/prompts/   # Codex /prompts:sync-docs
```

Claude Code 的 hooks 随 `.claude/settings.json` 生效，无需额外操作；Codex 首次运行需用 `/hooks` 审阅并信任脚本。
