# 全局工作流

> 目的: 约束 monorepo 的通用开发流程，尤其是根命令、app 文档和验证如何一起落地
>
> 源码路径: `apps/`, `docs/`, `package.json`
>
> 覆盖范围: 开发顺序、文档同步要求和提交前检查

## 开发顺序

1. 先定位目标 app，并阅读对应文档。
2. 仓库级结构、命令或 CI 变化先更新 `docs/`。
3. Extension 内部变化同步更新 `apps/extension/docs/`。
4. Website 内部变化同步更新 `apps/website/README.md` 或新增 website 文档。
5. 运行受影响 app 的最低验证命令。

## 常用命令

```bash
pnpm install
pnpm build
pnpm build:extension
pnpm build:firefox
pnpm build:website
pnpm build:extension:native-demo   # dev 扩展（带 nativeMessaging，输出 dist_chrome_dev/）
pnpm build:desktop                 # production 桌面 app
pnpm build:desktop:dev             # development 桌面 app（ListenUp Desktop DEV）
pnpm dev:extension
pnpm dev:website
```

Desktop app 的 dev/production 是两个独立 app（不同 bundle id、深链接协议、Native host 名），通过 `LISTENUP_ENV` 在构建时区分，详见 `apps/listenup-desktop/README.md`。

## 什么时候必须更新文档

- 新增或移动 app
- 根目录 workspace、turbo、CI 或构建命令发生变化
- Extension 内容脚本、权限、构建链路或交互方式发生变化
- Native Messaging 协议、Host 安装位置或 Tauri Demo 构建方式发生变化
- Website 的运行方式、环境变量或部署方式发生变化

## 提交前检查清单

- [ ] 相关文档已同步更新
- [ ] 根命令和 app 命令都从正确目录执行
- [ ] 受影响 app 的最低构建验证已通过
- [ ] 需要手工回归的场景已完成
