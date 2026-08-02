# ListenUp 三版本发布与本地 AI 翻译引导 — 实施计划

- 日期：2026-08-02
- 关联设计：[三版本发布与本地 AI 翻译引导设计](../spark/2026-08-02-listenup-three-release-local-ai-translation-design.md)

## 方案概述

按 CLI、Extension、Desktop 三条版本线依次交付。CLI npm 包只封装由现有 Rust crate 编译的
macOS arm64 二进制；Skill 通过受限 CLI 完成字幕翻译文档的 dry-run、提交和回读；Desktop
只提供缺少译文时的 Markdown 提示词复制入口。正式产物都从对应提交的干净 worktree 构建，
避免当前工作区的其他暂存改动进入发布包。

## 涉及文件 / 模块

- `packages/listenup-cli/` — npm 元数据、Node 启动器和构建/打包/发布脚本。
- `apps/listenup-desktop/src-tauri/` — 独立 CLI 版本注入，以及 Desktop 剪贴板插件注册。
- `skills/listenup-local-translator/` — Agent Skill、CLI 工作流与翻译文档契约。
- `apps/extension/package.json` — Extension `1.5.0` 版本源。
- `apps/listenup-desktop/src/` — 无译文空状态、统一提示词构造和复制反馈。
- `apps/listenup-desktop/package.json`、`Cargo.toml`、`tauri.conf.json` — Desktop `0.3.0` 版本。
- `docs/modules/`、`docs/topics/release-and-distribution.md`、`docs/testing.md` — 模块和发布验证同步。
- `.gitignore`、本地 `.npmrc` — 忽略 npm 产物与本机发布凭据；`.npmrc` 永不提交。

## 任务拆解

1. [x] 增加 `LISTENUP_CLI_VERSION` 编译期注入，并验证 Rust CLI 版本与现有测试。
2. [x] 实现 `@barrysongdev4real/listenup-cli@0.1.0` 的构建、启动、pack 检查和发布脚本。
3. [x] 创建并验证 `listenup-local-translator` Skill，覆盖目标语言确认、完整映射和安全写库。
4. [x] 构建 CLI tarball，隔离安装并在 DEV SQLite 的临时备份完成真实往返。
5. [x] 创建并推送 `cli-v0.1.0`，发布 npm 后运行 registry、`npx` 与全局安装回归。
6. [x] 升级 Extension 到 `1.5.0`，测试并从干净 worktree 生成 production zip 与 SHA-256。
7. [x] 上传现有 Chrome Web Store 条目，关闭自动发布并提交审核。
8. [x] 实现 Desktop 无译文引导、Markdown 模板和只写文本的最小剪贴板权限。
9. [x] 升级 Desktop 到 `0.3.0`，完成前端、Rust、聚焦刷新和真实视频手工回归。
10. [ ] 推送 Desktop commit 与 `v0.3.0`，核对 draft Release 资产和签名后发布。
11. [ ] Desktop 上线后手动发布已通过审核的 Extension `1.5.0`。

## 风险 / 注意

- npm 与 Chrome Web Store 发布不可原地回滚；上传前必须校验版本、包内容和哈希。
- Chrome Web Store 必须使用 deferred publishing，Desktop 上线前不能放量 Extension。
- 当前工作区有不属于本任务的 staged / unstaged 改动；不得 reset、取消暂存或整树提交。
- `.npmrc` 和 token 不得进入终端输出、Git index、npm tarball、zip 或日志。
- Rust target、npm `os` / `cpu` 和 launcher 三层都必须限制 macOS arm64。
- Desktop 不增加 watcher、轮询或 CLI 通知，只沿用 window focus refetch。

## 验证方式

- CLI：`cargo test`、release build、`npm pack --dry-run`、隔离 prefix 安装、临时 SQLite
  dry-run / commit / get、`npm view`、固定版本 `npx`、全局安装。
- Skill：运行 `quick_validate.py`，逐项审查安全边界，并用真实 CLI 工作流前向验证。
- Extension：单测、production build、环境标识检查、manifest/zip 根目录检查和 SHA-256。
- Desktop：TypeScript/Vite build、Rust tests、capability 审查、列表/影院复制与 focus refetch 手工回归。
- 全局：`node scripts/check-docs.mjs`，并确认每个 release artifact 来自对应干净 commit。
