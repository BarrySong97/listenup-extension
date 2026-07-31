# 多视频字幕会话选择与 videoId 强校验 — 实施计划

- 日期：2026-07-31
- 状态：已实现（真实 Chrome 自动控制不可用，保留人工链路复核）
- 关联 spec：`docs/spark/2026-07-31-manual-video-session-selection-design.md`

## 方案概述

Extension 在字幕轨发现、缓存读取、下载和 session 发布前强制校验 URL、
playerResponse 与字幕轨 URL 的 videoId，并把字幕状态绑定到单一 videoId 快照。
Native 协议升级后，由 Desktop Rust `HostStore` 统一计算正在播放 session、
已验证候选和用户锁定；React 提供冲突遮罩与主动改选入口。

## 涉及文件 / 模块

- `apps/extension/src/pages/content/lib/captions/` — 字幕轨携带并校验来源 videoId。
- `apps/extension/src/pages/content/lib/subtitle-domain/` — 五秒身份重试、缓存 v3 与写入前复验。
- `apps/extension/src/pages/content/hooks/` — 原子字幕快照与安全 Native session 发布。
- `apps/extension/src/shared/nativeSubtitleProtocol.ts` — 协议版本与身份状态。
- `apps/listenup-desktop/src-tauri/src/lib.rs` — 候选仲裁、手动锁定、选择命令及单测。
- `apps/listenup-desktop/src/` — 候选快照、选择遮罩和列表/影院改选入口。
- `docs/decisions/`、`docs/modules/`、`docs/topics/`、`docs/testing.md` — 决策与运行文档同步。

## 任务拆解

1. [x] 建立可单测的 videoId 身份验证器，所有字幕轨补充 `sourceVideoId`。
2. [x] 改造字幕加载为五秒内可中断重试，阻止不一致轨道进入缓存或 ready session。
3. [x] 将 React 字幕状态绑定到 videoId，升级缓存版本并补 Node test。
4. [x] 升级 Native 协议，扩展 Rust session / snapshot 类型。
5. [x] 实现 Rust 0 / 1 / 2+ session 仲裁、手动锁定与过期选择校验。
6. [x] 实现 Desktop 冲突遮罩、footer 和影院工具条改选。
7. [x] 补 ADR、模块文档、测试手册和文件头。
8. [x] 运行 Extension test/build、Desktop build、Rust tests、环境 sensor 与 check-docs。
9. [x] 用本地 socket 注入两条 verified session，完成单实例选择遮罩视觉回归并隔离提交；
   真实 Chrome 自动控制连接不可用，YouTube SPA 人工复核项保留在 `docs/testing.md`。

## 风险 / 注意

- 页面 URL 比 playerResponse 更早更新，任何无 `sourceVideoId` 的 fallback 都必须阻断。
- `pending` session 可以作为唯一播放项显示 loading，但不能出现在可选候选中。
- 高频 cursor 继续走增量事件，候选快照只在结构、暂停/广告或选择变化时发送。
- 现有工作区有大量用户 staged 改动；提交时必须使用隔离 index，不得夹带。
- production / DEV 的 Host、Extension ID、bundle、scheme 与 socket 隔离保持不变。

## 验证方式

```bash
pnpm --filter @listenup/extension test
pnpm build:extension:native-demo
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

手工验证同标签页 SPA 连续切换、两个及三个标签页同时播放、冲突选择、主动改选、
暂停/关闭/广告、Desktop 晚启动与 Host 断线恢复；全过程不得出现新 videoId
携带旧字幕或污染缓存。
