# ListenUp Extension

ListenUp 是一个面向 YouTube 语言学习的 Chrome / Firefox 扩展。核心功能在 YouTube 页面内注入字幕侧边栏，支持字幕提取、逐句跳转、循环播放、录音练习，以及复制字幕或解释 prompt。

## 快速开始

推荐使用 `pnpm`：

```bash
pnpm install
pnpm build:extension
```

开发模式：

```bash
pnpm dev:extension
pnpm dev:firefox
```

加载扩展：

1. Chrome: 打开 `chrome://extensions`，启用开发者模式，加载 `apps/extension/dist_chrome/`
2. Firefox: 打开 `about:debugging#/runtime/this-firefox`，加载 `apps/extension/dist_firefox/manifest.json`

## 文档

详细文档统一维护在 [docs/README.md](docs/README.md)。

推荐阅读顺序：

1. [docs/README.md](docs/README.md)
2. [docs/architecture/system-overview.md](docs/architecture/system-overview.md)
3. [docs/pages/content/README.md](docs/pages/content/README.md)

## 开发约定

- `CLAUDE.md` 和 `AGENTS.md` 只放稳定、简短的协作约定。
- 具体架构、工作流、踩坑记录统一写进 `docs/`。
- 代码改动如果改变了行为、结构或工作流，需要同步更新对应文档。

## License

ListenUp Extension 使用 [PolyForm Noncommercial License 1.0.0](../../LICENSE)。
你可以 fork、自用、修改，并以免费、非商用方式发布；商业使用需要另行获得授权。
