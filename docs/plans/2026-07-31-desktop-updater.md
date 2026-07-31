<!--
@purpose Desktop 手动检查更新与 GitHub Release 更新产物的实施计划。
@role    在改动 Desktop、Tauri 配置和发版 workflow 前锁定行为、边界与验证方式。
@deps    docs/modules/listenup-desktop/README.md、docs/topics/release-and-distribution.md、docs/testing.md
@gotcha  Apple 代码签名/公证与 Tauri updater 产物签名是两层机制；前者复用现有配置，后者不可关闭。
-->

# Desktop 检查更新 — 实现计划

- 日期: 2026-07-31
- 关联 spec: 无（用户直接确认的产品需求）

## 方案概述

在 Desktop 列表窗口标题栏加入“检查更新”图标，同时在菜单栏托盘菜单加入“检查更新…”入口。两处入口共用同一套更新流程：检查 GitHub 最新正式 Release；没有更新时给出明确反馈；有更新时直接下载并安装，展示下载状态，完成后重启应用。

保留并复用现有 Apple Developer ID 签名与公证配置。新增 Tauri v2 updater 所需的更新包校验（公钥写入 app，匹配的私钥只放 GitHub Actions Secret）、更新产物和 `latest.json`；这是更新包来源校验，不替代也不重配 Apple 签名。

## 涉及文件 / 模块

- `apps/listenup-desktop/src/App.tsx` — 检查更新入口、状态反馈、下载/安装/重启流程，并响应托盘触发事件
- `apps/listenup-desktop/src-tauri/src/lib.rs` — 初始化 updater/process 插件，托盘加入检查更新入口并唤起窗口
- `apps/listenup-desktop/src-tauri/tauri.conf.json` — GitHub `latest.json` endpoint、公钥、updater 产物配置
- `apps/listenup-desktop/src-tauri/capabilities/default.json` — 仅开放检查、下载、安装和重启所需权限
- `apps/listenup-desktop/package.json`、`src-tauri/Cargo.toml`、锁文件 — Tauri updater/process 依赖
- `.github/workflows/release-desktop.yml` — 复用现有 Apple secrets，注入 updater 私钥，生成并上传 `.app.tar.gz`、`.sig`、`latest.json`；修正手动触发时把 `main` 当 tag 的问题
- `docs/modules/listenup-desktop/README.md`、`docs/topics/release-and-distribution.md`、`docs/testing.md` — 同步运行、发版和手工回归说明

## 任务拆解

1. [x] 接入 Tauri updater/process 插件、最小权限、GitHub endpoint 与更新产物配置。
2. [x] 实现标题栏与托盘“检查更新”，统一处理检查中、已是最新版、下载进度、失败、安装完成重启等状态。
3. [x] 更新 Release workflow：沿用 Apple 签名/公证；强制校验 updater 私钥存在并发布 updater JSON/签名产物。
4. [x] 同步版本与文档，执行 Desktop 前端构建、Rust 检查、docs sensor 和真实应用手工回归。

## 风险 / 注意

- Tauri updater 的公私钥必须永久匹配；私钥不能提交仓库，丢失后已安装客户端无法接受后续更新。
- `releases/latest` 只会指向已发布 Release，draft 不会成为更新源；审核 draft 后必须发布才能被客户端发现。
- 当前已安装的 `0.1.0` 没有 updater，只能手工安装一次首个 updater 版本；从该版本开始才能在应用内更新。
- 本次只构建 Apple Silicon 包，Intel Mac 仍不在当前分发范围内。

## 验证方式

- `pnpm --filter @listenup/desktop build`
- `cargo check --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml`
- `cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml`
- `node scripts/check-docs.mjs`
- 启动真实 Desktop：分别验证标题栏与托盘入口、无更新反馈、并发点击去重、网络错误反馈。
- 发布首个 updater-capable draft 后核对 Release 含 `.app.tar.gz`、`.sig`、`latest.json`；发布后用低一版本真实安装包验证下载、替换与重启。
