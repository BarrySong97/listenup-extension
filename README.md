# ListenUp Monorepo

这个仓库使用 pnpm workspace 和 Turborepo 管理两个应用：

- `apps/extension`: ListenUp Chrome / Firefox 浏览器扩展
- `apps/website`: 从 `install-ipa-to-iphone/webs` 复制过来的 Next.js 站点

## 快速开始

```bash
pnpm install
pnpm build
```

常用命令：

```bash
pnpm build:extension
pnpm build:firefox
pnpm build:website
pnpm dev:extension
pnpm dev:website
```

## 文档

- Monorepo 文档入口: [docs/README.md](docs/README.md)
- Extension 文档入口: [apps/extension/docs/README.md](apps/extension/docs/README.md)
- Website 说明: [apps/website/README.md](apps/website/README.md)

## License

ListenUp Extension 使用 [PolyForm Noncommercial License 1.0.0](LICENSE)。
