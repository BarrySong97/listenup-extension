# 运行时、权限与构建

## 页面入口（`manifest.json`）

| 键 | 指向 |
|---|---|
| `action.default_popup` | `src/pages/popup/index.html` |
| `options_ui.page` | `src/pages/options/index.html` |
| `devtools_page` | `src/pages/devtools/index.html` |
| `content_scripts[0].js` | `src/pages/content/index.tsx` |

内容脚本 `matches` 是 `http://*/*`、`https://*/*`、`<all_urls>`，但 `index.tsx` 自行判域名，只在 `youtube.com` 初始化 UI。**注入范围宽、运行范围窄**是当前现状，收窄前要确认不会影响 SPA 导航时机。

## 权限

生产 `manifest.json`：`activeTab`、`storage`、`unlimitedStorage`、`nativeMessaging`。Native Messaging 是正式 Desktop 字幕同步的必要功能，不得从商店包中剥离。

`manifest.dev.json` 用完整权限数组覆盖，但与 production 保持相同功能；区别只在 Extension ID、名称、图标、Host 和深链接。正式 ID 由 Chrome Web Store 条目分配，production manifest 不写本地 `key`；DEV 用固定 `key` 保持 ID 稳定。

## Web Accessible Resources

`public/scripts/inject-youtube.js` 暴露给 `*://*.youtube.com/*`，用于进入页面上下文读 YouTube 内部播放器数据。它不是普通 React 模块。改它时必须同时看：

- `manifest.json` 的 `web_accessible_resources`
- 内容脚本侧的 `PageBridge`
- 两个 JS 上下文的边界（只能 `postMessage`）

## 构建配置

| 文件 | 作用 |
|---|---|
| `vite.config.base.ts` | 通用插件 + 合并 manifest / 版本号；注入 Native 环境，并把非 manifest 引用的 Preview 加入 Rollup input |
| `vite.config.chrome.ts` | Chrome 的 `crx()` 配置与输出目录 |
| `vite.config.firefox.ts` | Firefox 输出；**把通用 MV3 的 `background.service_worker` 转成 CRX Firefox 分支要的 `background.scripts` 数组** |
| `custom-vite-plugins.ts` | dev icon 清理、把 `src/locales/` 输出为 `_locales/` |
| `scripts/check-build.mjs` | 构建后校验页面入口、locale、环境名称、background 形态与 `nativeMessaging` |
| `tailwind-rem-to-em.js` | Shadow DOM 场景的单位转换 |
| `nodemon.chrome.json` / `nodemon.firefox.json` | dev 模式的重建监听 |

🚨 **不要为了 Firefox 去改 `manifest.json`**——那会连带弄坏 Chrome 构建。Firefox 差异只允许写在 `vite.config.firefox.ts` 的转换里。

## 中英文 locale

`vite.config.base.ts` 会把 manifest 的名称和说明替换为 `__MSG_*__`，并声明
`default_locale: "en"`；`custom-vite-plugins.ts` 把 `src/locales/en/messages.json` 与
`src/locales/zh_CN/messages.json` 原样输出到构建产物 `_locales/`。Chrome manifest locale
目录沿用下划线形式 `zh_CN`，React 运行时语言则使用标准 BCP 47 tag `zh-CN`。

DEV 构建使用独立的 `extNameDev` / `extDescriptionDev` message key，不能因为本地化而把扩展名
退回正式版名称。React UI 文案不从 `chrome.i18n.getMessage()` 读取，统一由
`src/i18n/resources.ts` 的 `react-i18next` 资源提供。

## 命令与产物

| 命令 | 产物 |
|---|---|
| `pnpm build:extension`（= `build:chrome`） | `apps/extension/dist_chrome/` |
| `pnpm build:firefox` | `apps/extension/dist_firefox/` |
| `pnpm build:extension:native-demo` | `apps/extension/dist_chrome_dev/`（DEV ID / Host，功能与 production 一致） |
| `pnpm dev:extension` / `pnpm dev:firefox` | 同上，watch 模式 |

`apps/extension/public/manifest.json` 是构建生成的，已在 `.gitignore` 里，不要手改。

三条 build script 都会继续运行 `scripts/check-build.mjs`。UI Preview 没有直接登记在 manifest，
因此必须保留 `baseBuildOptions.rollupOptions.input` 中的 `src/pages/newtab/index.html`；否则 Popup /
Options 的预览链接会在打包后 404。产物检查会把这类回归直接变成构建失败。

当前商店审核基线为 `1.5.3`，线上已发布版本仍为 `1.5.2`。`1.5.3` 把仓库已实现的 Native
Messaging v5（含 `playbackEpoch`）提交到 Chrome Web Store；Desktop `0.5.2` 同时兼容商店
旧版 v4 与新版 v5，所以扩展审核和手动放量期间不会形成协议切换窗口。审核通过后保持 staged，
待手动发布。

## 本地加载

- Chrome：`chrome://extensions` → Developer mode → Load unpacked → `dist_chrome/`
- Firefox：`about:debugging#/runtime/this-firefox` → Load temporary Add-on → `dist_firefox/manifest.json`

## 许可证

项目使用 **PolyForm Noncommercial 1.0.0**（见根目录 `LICENSE`，[ADR-0005](../../decisions/0005-polyform-noncommercial-license.md)）。允许 fork / 自用 / 学习 / 非商用发布；禁止销售、商业产品集成、商业运营。仓库同时保留上游模板 `vite-web-extension` 的 MIT notice。

改许可证时必须同步 `LICENSE`、`apps/extension/package.json` 的 `license` 字段和 `apps/extension/README.md`。

## 相关

- [入口页面](entry-pages.md) · [构建产物与分发](../../topics/release-and-distribution.md) · [运行手册](../../run.md)
