# ListenUp AI Guide

## 文档优先

- 处理仓库级结构、命令或 CI 前，先阅读根目录 `docs/`。
- 处理 extension 前，先阅读 `apps/extension/docs/` 下对应目录。
- 处理 website 前，先阅读 `apps/website/README.md`，必要时补充 website 文档。
- 发现新约定、踩坑或架构变化时，先更新 `docs/`，不要只写进会话记忆。
- 提交前确认代码改动对应的文档已同步。

## 快速命令

- 安装依赖: `pnpm install`
- 全仓构建: `pnpm build`
- Chrome 构建: `pnpm build:extension`
- Firefox 构建: `pnpm build:firefox`
- Website 构建: `pnpm build:website`
- Chrome 开发: `pnpm dev:extension`
- Firefox 开发: `pnpm dev:firefox`
- Website 开发: `pnpm dev:website`

## 阅读入口

- 文档总入口: `docs/README.md`
- 仓库结构: `docs/architecture/repo-layout.md`
- 工作流: `docs/workflows.md`
- 测试规范: `docs/testing.md`
- Extension 文档总入口: `apps/extension/docs/README.md`
- Extension 系统总览: `apps/extension/docs/architecture/system-overview.md`
- Website 说明: `apps/website/README.md`

## 模块地图

| 模块 | 源码路径 | 文档路径 |
|------|-----------|----------|
| Monorepo 配置 | `package.json`, `pnpm-workspace.yaml`, `turbo.json` | `docs/` |
| Website | `apps/website/` | `apps/website/README.md` |
| 内容脚本 / 字幕面板 | `apps/extension/src/pages/content/` | `apps/extension/docs/pages/content/` |
| 扩展弹窗 | `apps/extension/src/pages/popup/` | `apps/extension/docs/pages/popup/` |
| 预览页入口 | `apps/extension/src/pages/options/` | `apps/extension/docs/pages/options/` |
| UI Preview 页 | `apps/extension/src/pages/newtab/` | `apps/extension/docs/pages/newtab/` |
| DevTools 页 | `apps/extension/src/pages/devtools/` | `apps/extension/docs/pages/devtools/` |
| Extension 系统级配置 | `apps/extension/manifest.json`, `apps/extension/vite.config.*`, `apps/extension/public/` | `apps/extension/docs/architecture/` |

## 稳定约定

- 内容脚本运行在 Shadow DOM 中，优先阅读 `apps/extension/docs/pages/content/faq.md`。
- HeroUI 在 Shadow DOM 下优先使用 `onPressStart`，不要默认用 `onPress`。
- 内容脚本样式通过 `style.css?inline` 注入，并把 `rem` 替换成 `em` 做隔离。
- 需要下拉菜单时优先复用 `apps/extension/src/components/ui/Dropdown.tsx`，不要直接假设 HeroUI Dropdown 可用。
