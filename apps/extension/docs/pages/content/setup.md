# 内容脚本本地开发

> 目的: 说明如何在本地构建、加载和调试内容脚本，而不是每次靠口口相传
>
> 源码路径: `src/pages/content/`, `manifest.json`, `vite.config.chrome.ts`, `vite.config.firefox.ts`
>
> 覆盖范围: 本地安装依赖、构建、浏览器加载和 UI Preview 使用方式

## 源码定位

- 主路径: `src/pages/content/`
- 相关路径: `src/pages/newtab/Newtab.tsx`
- 相关路径: `src/pages/popup/Popup.tsx`

## 安装与构建

```bash
pnpm install
pnpm build:extension
```

开发模式：

```bash
pnpm dev:extension
pnpm dev:firefox
```

## 加载扩展

Chrome：

1. 打开 `chrome://extensions`
2. 启用 Developer mode
3. 选择 Load unpacked
4. 指向 `apps/extension/dist_chrome/`

Firefox：

1. 打开 `about:debugging#/runtime/this-firefox`
2. 选择 Load temporary Add-on
3. 指向 `apps/extension/dist_firefox/manifest.json`

## 调试内容脚本

优先在 YouTube watch 页面上调试，因为只有那里会触发真实的播放器、广告和字幕轨逻辑。

建议检查：

- Console 中的 `[ListenUp:subtitles]` 日志
- Shadow Root 下的 `#__listenup-extension-host`
- `chrome.storage.local` 中的字幕缓存 key

## 何时用 UI Preview

如果只是在调以下内容，优先走 `newtab` / `options` 预览页：

- 面板尺寸、排版、间距和视觉层级
- 单组件状态切换
- mock 字幕列表的滚动体验

如果改动依赖以下能力，必须回到真实 YouTube 页面验证：

- 播放器时间同步
- 广告状态处理
- 字幕轨抓取
- 页面桥接或 Shadow DOM 行为

## 相关文档

- [内容脚本测试](testing.md)
- [运行时、权限与构建](../../architecture/runtime-permissions-and-builds.md)
- [UI Preview 概览](../newtab/overview.md)
