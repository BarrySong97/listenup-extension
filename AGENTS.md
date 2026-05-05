# ListenUp AI Guide

## 文档优先

- 处理某个模块前，先阅读 `docs/` 下对应目录。
- 发现新约定、踩坑或架构变化时，先更新 `docs/`，不要只写进会话记忆。
- 提交前确认代码改动对应的文档已同步。

## 快速命令

- 安装依赖: `pnpm install`
- Chrome 构建: `pnpm build`
- Firefox 构建: `pnpm build:firefox`
- Chrome 开发: `pnpm dev`
- Firefox 开发: `pnpm dev:firefox`

## 阅读入口

- 文档总入口: `docs/README.md`
- 系统总览: `docs/architecture/system-overview.md`
- 仓库结构: `docs/architecture/repo-layout.md`
- 工作流: `docs/workflows.md`
- 测试规范: `docs/testing.md`

## 模块地图

| 模块 | 源码路径 | 文档路径 |
|------|-----------|----------|
| 内容脚本 / 字幕面板 | `src/pages/content/` | `docs/pages/content/` |
| 扩展弹窗 | `src/pages/popup/` | `docs/pages/popup/` |
| 预览页入口 | `src/pages/options/` | `docs/pages/options/` |
| UI Preview 页 | `src/pages/newtab/` | `docs/pages/newtab/` |
| DevTools 页 | `src/pages/devtools/` | `docs/pages/devtools/` |
| 系统级配置 | `manifest.json`, `vite.config.*`, `public/` | `docs/architecture/` |

## 稳定约定

- 内容脚本运行在 Shadow DOM 中，优先阅读 `docs/pages/content/faq.md`。
- HeroUI 在 Shadow DOM 下优先使用 `onPressStart`，不要默认用 `onPress`。
- 内容脚本样式通过 `style.css?inline` 注入，并把 `rem` 替换成 `em` 做隔离。
- 需要下拉菜单时优先复用 `src/components/ui/Dropdown.tsx`，不要直接假设 HeroUI Dropdown 可用。
