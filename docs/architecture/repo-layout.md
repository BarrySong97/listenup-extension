# 仓库结构

> 目的: 解释 monorepo 的主要目录和配置文件应该去哪里找
>
> 源码路径: `apps/`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`
>
> 覆盖范围: 仓库级目录职责和常用配置入口

## 顶层结构

- `apps/extension/`: 原 ListenUp 浏览器扩展项目，包含 `src/`、`manifest.json`、Vite 配置和扩展文档
- `apps/website/`: Next.js website app，包含 `app/`、`public/` 和 Next 配置
- `docs/`: monorepo 级文档
- `.github/workflows/`: 仓库级 CI
- `package.json`: 根命令入口
- `pnpm-workspace.yaml`: pnpm workspace 包声明
- `turbo.json`: Turborepo 任务配置

## App 文档入口

- Extension: `apps/extension/docs/README.md`
- Website: `apps/website/README.md`

## 构建产物

- Extension Chrome: `apps/extension/dist_chrome/`
- Extension Firefox: `apps/extension/dist_firefox/`
- Website: `apps/website/.next/`

这些目录都是生成物，不应手工编辑。
