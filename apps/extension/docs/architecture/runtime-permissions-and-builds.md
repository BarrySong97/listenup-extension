# 运行时、权限与构建

> 目的: 记录扩展运行时约束、当前权限模型和构建入口，避免改配置时只盯着单个文件
>
> 源码路径: `manifest.json`, `manifest.dev.json`, `vite.config.base.ts`, `vite.config.chrome.ts`, `vite.config.firefox.ts`, `public/scripts/`
>
> 覆盖范围: MV3 运行方式、权限、web-accessible resources、构建差异和本地加载方式

## 源码定位

- 主路径: `manifest.json`
- 相关路径: `manifest.dev.json`
- 相关路径: `vite.config.base.ts`
- 相关路径: `public/scripts/inject-youtube.js`

## 运行时约束

这是一个 Manifest V3 扩展，当前页面入口包括：

- `action.default_popup`: `src/pages/popup/index.html`
- `options_ui.page`: `src/pages/options/index.html`
- `devtools_page`: `src/pages/devtools/index.html`
- `content_scripts[0].js`: `src/pages/content/index.tsx`

内容脚本的 `matches` 当前是：

- `http://*/*`
- `https://*/*`
- `<all_urls>`

但 `src/pages/content/index.tsx` 会自行检查域名，只在 `youtube.com` 初始化 UI。

## 权限

`manifest.json` 当前声明了：

- `activeTab`
- `storage`
- `unlimitedStorage`

`manifest.dev.json` 会在开发构建中用完整权限数组覆盖上述配置，并额外声明 `nativeMessaging`。该权限只服务于 macOS Tauri 字幕同步 Demo，生产构建不包含它。

`host_permissions` 当前只包含 `*://*.youtube.com/*`。因此虽然内容脚本匹配范围更大，真正需要的数据访问和 web-accessible resource 仍围绕 YouTube。

## Web Accessible Resources

`public/scripts/inject-youtube.js` 会被暴露给 `*://*.youtube.com/*`，用于进入页面上下文访问 YouTube 内部播放器数据。它不是普通 React 模块的一部分，修改时要同时考虑：

- `manifest.json` 的 `web_accessible_resources`
- 页面桥接逻辑
- 内容脚本和页面上下文的边界

## 构建方式

推荐命令：

- Chrome: `pnpm build:extension`
- Firefox: `pnpm build:firefox`
- Chrome dev: `pnpm dev:extension`
- Firefox dev: `pnpm dev:firefox`
- Chrome Native Messaging Demo: `pnpm build:extension:native-demo`

产物目录：

- Chrome: `apps/extension/dist_chrome/`
- Firefox: `apps/extension/dist_firefox/`

`vite.config.base.ts` 负责合并 `manifest.json`、`manifest.dev.json` 和 `package.json` 里的版本号。Chrome/Firefox 差异主要体现在各自的 `crx()` 插件配置和输出目录。

Firefox 构建会在 `vite.config.firefox.ts` 中把通用 MV3 manifest 的
`background.service_worker` 转成 CRX Firefox 分支需要的 `background.scripts`
数组，再交给 `@crxjs/vite-plugin` 处理。不要直接改 `manifest.json` 为
Firefox 专用格式，否则 Chrome 构建会受影响。

## 本地加载

- Chrome: `chrome://extensions` -> Load unpacked -> `apps/extension/dist_chrome/`
- Firefox: `about:debugging#/runtime/this-firefox` -> Load temporary Add-on -> `apps/extension/dist_firefox/manifest.json`

## 相关文档

- [系统总览](system-overview.md)
- [内容脚本 setup](../pages/content/setup.md)
- [全局测试规范](../testing.md)
