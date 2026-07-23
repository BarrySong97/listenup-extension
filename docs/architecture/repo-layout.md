# 仓库结构

> 目的: 解释 monorepo 的主要目录和配置文件应该去哪里找
>
> 源码路径: `apps/`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`
>
> 覆盖范围: 仓库级目录职责和常用配置入口

## 顶层结构

- `apps/extension/`: 原 ListenUp 浏览器扩展项目，包含 `src/`、`manifest.json`、Vite 配置和扩展文档
- `apps/website/`: Next.js website app，包含 `app/`、`public/` 和 Next 配置
- `apps/listenup-desktop/`: Tauri v2 macOS Demo；Rust 端充当 Chrome Native Messaging Host，React 前端展示同步字幕
- `docs/`: monorepo 级文档
- `.github/workflows/`: 仓库级 CI
- `package.json`: 根命令入口
- `pnpm-workspace.yaml`: pnpm workspace 包声明与 `catalog` 共享依赖版本
- `turbo.json`: Turborepo 任务配置

## 共享依赖（pnpm catalog）

根目录 `pnpm-workspace.yaml` 的 `catalog` 统一声明跨 app 复用的依赖版本。Website 的 HeroUI v3 从 catalog 引用：

- `@heroui/react`
- `@heroui/styles`

在 app 的 `package.json` 里写 `"catalog:"` 即可，不要在子包里单独钉死另一套 HeroUI v3 版本。Extension 仍使用 HeroUI v2，因此继续在本包内声明，不走该 catalog。

## App 文档入口

- Extension: `apps/extension/docs/README.md`
- Website: `apps/website/README.md`
- Native subtitle demo: `apps/listenup-desktop/README.md`

## 构建产物

- Extension Chrome: `apps/extension/dist_chrome/`
- Extension Firefox: `apps/extension/dist_firefox/`
- Website: `apps/website/.next/`
- Native subtitle demo frontend: `apps/listenup-desktop/dist/`
- Native subtitle demo Rust/Tauri: `apps/listenup-desktop/src-tauri/target/`

这些目录都是生成物，不应手工编辑。
