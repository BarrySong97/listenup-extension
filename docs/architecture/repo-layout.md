# 仓库结构

> 目的: 解释仓库的主要目录和配置文件应该去哪里找，降低首次定位成本
>
> 源码路径: `src/`, `public/`, `manifest.json`, `vite.config.*`, `.github/workflows/`, `LICENSE`
>
> 覆盖范围: 目录职责、关键配置入口、哪些目录是当前主战场，哪些只是配套

## 源码定位

- 主路径: `src/`
- 相关路径: `public/`
- 相关路径: `manifest.json`
- 相关路径: `.github/workflows/ci.yml`

## 目录结构

- `src/pages/content/`: 核心产品模块，包含内容脚本、字幕面板组件、YouTube SDK 和字幕域逻辑
- `src/pages/popup/`: 扩展弹窗
- `src/pages/options/`: 预览页入口，目前只是转发到 `newtab`
- `src/pages/newtab/`: UI Preview 页面
- `src/pages/devtools/`: DevTools 面板入口
- `src/components/ui/`: 跨页面共享的小型 UI 基础件，目前主要是 `Dropdown` 和 `iconScale`
- `src/store/`: Jotai store，目前体量很小
- `public/scripts/`: 需要作为 web-accessible resource 注入页面上下文的脚本
- `dist_chrome/`, `dist_firefox/`: 构建产物，不应手改

## 当前主战场

如果需求和真实用户行为有关，优先看这些路径：

- `src/pages/content/components/`
- `src/pages/content/hooks/`
- `src/pages/content/lib/captions/`
- `src/pages/content/lib/subtitle-domain/`
- `src/pages/content/lib/subtitles/`
- `src/pages/content/lib/youtube-sdk/`

## 需要注意的非核心目录

- `src/pages/background/`: 目录存在，但当前没有实际脚本文件
- `src/locales/`: i18n 默认关闭，只有在 `vite.config.base.ts` 中打开 `localize` 后才真正参与构建
- `.github/workflows/ci.yml`: 仍以 `yarn` 为安装和构建命令，和仓库当前更推荐的 `pnpm` 存在分离，后续需要统一时应先改文档再改脚本

## 关键配置文件

- `manifest.json`: 扩展权限、页面入口和资源暴露规则
- `manifest.dev.json`: 开发态附加配置
- `vite.config.base.ts`: 通用 Vite 插件和 manifest 合成逻辑
- `vite.config.chrome.ts`: Chrome 输出目录和 CRX 配置
- `vite.config.firefox.ts`: Firefox 输出目录和 CRX 配置
- `custom-vite-plugins.ts`: dev icon 清理和可选 i18n 资源注入
- `tailwind-rem-to-em.js`: 用于 Shadow DOM 场景的单位转换
- `LICENSE`: 项目主许可证和上游模板 notice，当前限制为非商用使用
- `package.json`: `license` 字段应与 `LICENSE` 保持一致

## 相关文档

- [系统总览](system-overview.md)
- [运行时、权限与构建](runtime-permissions-and-builds.md)
- [许可证](license.md)
- [页面文档索引](../pages/README.md)
