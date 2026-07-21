# ListenUp Monorepo 文档入口

> 目的: 说明 monorepo 的应用边界、命令入口和各 app 文档位置
>
> 源码路径: `apps/`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`
>
> 覆盖范围: 仓库级结构和工作流，不替代各 app 内部实现文档

## 推荐阅读顺序

1. [仓库结构](architecture/repo-layout.md)
2. [全局工作流](workflows.md)
3. [全局测试规范](testing.md)
4. [Extension 文档](../apps/extension/docs/README.md)
5. [Website 说明](../apps/website/README.md)

## 应用索引

- `apps/extension/`: 浏览器扩展，保留原 ListenUp Extension 项目源码和文档
- `apps/website/`: Next.js 站点，从 `install-ipa-to-iphone/webs` 复制而来
- `apps/native-subtitle-demo/`: macOS Tauri Native Messaging 字幕同步 Demo，使用说明见 app 内 README

## 关键配置

- `pnpm-workspace.yaml`: 声明 `apps/*` 为 workspace package
- `turbo.json`: 定义 `build`、`dev`、`lint`、`start` 的任务缓存和持久进程规则
- `package.json`: 根目录命令入口，使用 `pnpm --filter` 定位具体 app
