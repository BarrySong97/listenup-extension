# ListenUp Extension

面向 YouTube 语言学习的 Chrome / Firefox 扩展：在 YouTube 页面注入字幕侧边栏，支持字幕提取、逐句跳转、循环播放、录音练习，以及选中文本后的 AI 解释卡片。

## 快速开始

```bash
pnpm install          # 在仓库根执行
pnpm build:extension  # 或 pnpm dev:extension
```

加载：Chrome `chrome://extensions` → Load unpacked → `dist_chrome/`；Firefox `about:debugging#/runtime/this-firefox` → `dist_firefox/manifest.json`。

## 文档

本 app 的全部文档在仓库根的 [`docs/modules/extension/`](../../docs/modules/extension/README.md)。命令速查见 [`docs/run.md`](../../docs/run.md)，协作规范入口是根目录的 [`AGENTS.md`](../../AGENTS.md)。

## License

[PolyForm Noncommercial License 1.0.0](../../LICENSE)。可以 fork、自用、修改，并以免费、非商用方式发布；商业使用需另行授权。
