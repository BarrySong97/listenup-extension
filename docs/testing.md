# 全局测试规范

> 目的: 给 monorepo 定义当前真实可执行的测试底线和 app 级验证入口
>
> 源码路径: `package.json`, `apps/`
>
> 覆盖范围: 全局构建验证、app 级验证命令和后续测试要求

## 当前测试现实

仓库当前没有成熟的自动化测试套件。可执行的基础验证主要是构建和 app 级手工回归。

## 最低命令

全仓构建：

```bash
pnpm build
```

按 app 验证：

```bash
pnpm build:extension
pnpm build:firefox
pnpm build:website
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
```

Website 也提供 lint：

```bash
pnpm --filter @listenup/website lint
```

## App 级测试入口

- Extension: [apps/extension/docs/testing.md](../apps/extension/docs/testing.md)
- Extension 内容脚本: [apps/extension/docs/pages/content/testing.md](../apps/extension/docs/pages/content/testing.md)
- Website: [apps/website/README.md](../apps/website/README.md)
- Native subtitle demo: [apps/listenup-desktop/README.md](../apps/listenup-desktop/README.md)
