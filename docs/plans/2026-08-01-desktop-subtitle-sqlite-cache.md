# Desktop 字幕 SQLite 缓存 — 实施计划

- 日期：2026-08-01
- 状态：已被双语字幕设计取代，禁止按本计划直接实施
- 关联 spec：无

> 本计划只覆盖单轨 JSON 缓存，已不符合多语言、AI 重组片段和 CLI 的需求。
> 后续以 `docs/spark/2026-08-01-desktop-bilingual-subtitle-cli-design.md` 为准，
> 该设计通过书面确认后再另写实施计划。

## 方案概述

参考 `/Users/songtianjian/Documents/seperate` 的 Tauri SQLite 基础设施：使用
`sqlx`、`app.path().app_data_dir()`、WAL、外键和编译期 migration。Desktop 收到
`identityStatus=verified`、`status=ready` 且非空的完整字幕 session 后，将可显示快照
异步 upsert 到 SQLite；loading、empty、error、pending 与 cursor 不写库，也不能覆盖
已有成功缓存。

字幕列表按 JSON 整体保存。当前 Native 协议和 Desktop UI 都以完整 session 为读写单位，
逐句拆表会引入大量行写入与重组，却没有逐句查询收益。缓存身份使用
`video_id + language_code + track_kind`，允许同一视频的人工字幕和自动字幕、不同语言共存。

GUI 冷启动且尚无 live session 时，读取最近更新的一份缓存并显示；一旦收到扩展的 live
session（包括 loading / pending），live 状态立即优先，避免旧视频字幕遮住当前视频。
缓存快照明确标记为 `cached`，UI 展示“本地缓存”，且不参与播放候选、游标或多视频仲裁。

数据库文件名为 `listenup.sqlite`，落在当前 Tauri identifier 对应的 app data 目录；因此
production 与 DEV 天然隔离。每次成功写入后按最近更新时间保留最多 200 份字幕轨缓存，
防止长期使用后无限增长。

这份 Desktop 缓存解决的是重启后/暂未连接扩展时的本地回看。YouTube 字幕下载是否命中
网络缓存仍由 Extension 的 `chrome.storage.local` 负责，Desktop SQLite 不反向参与扩展抓取。

## 涉及文件 / 模块

- `apps/listenup-desktop/src-tauri/Cargo.toml`、`Cargo.lock` — 引入带 SQLite、migration
  和 Tokio runtime 支持的 `sqlx`。
- `apps/listenup-desktop/src-tauri/migrations/` — 建立版本化字幕缓存表与更新时间索引。
- `apps/listenup-desktop/src-tauri/src/database.rs` — 数据库连接、migration、快照
  upsert、最近缓存读取与容量裁剪。
- `apps/listenup-desktop/src-tauri/src/lib.rs` — 初始化连接池、识别可缓存 session、在
  Native 消息处理后持久化，并让 `get_snapshot` 在无 live session 时回退 SQLite。
- `apps/listenup-desktop/src/types.ts`、`src/App.tsx` — 对齐缓存来源字段并明确展示本地缓存。
- `docs/modules/listenup-desktop/README.md`、`docs/topics/native-messaging.md`、
  `docs/testing.md` — 记录数据位置、生命周期、live 优先级与回归步骤。
- `docs/decisions/` — 记录 Desktop 持久缓存不替代 Extension 抓取缓存、整份 JSON 快照和
  prod/DEV 数据隔离的决策。

## 任务拆解

1. [ ] 引入 `sqlx` 并建立 `listenup.sqlite` 连接初始化与 migration。
2. [ ] 定义字幕缓存表、序列化模型、upsert、最新读取和 200 条容量裁剪。
3. [ ] 在 socket session 处理链路中只持久化 verified + ready + 非空字幕，失败只写
   stderr，不影响 Native 同步主链路。
4. [ ] 改造初始快照读取：无 live session 时读最近缓存，查询结束前二次确认 live 状态，
   防止异步查询覆盖刚到达的实时 session。
5. [ ] 在前端标记“本地缓存”，确保缓存不产生播放高亮、候选选择或虚假连接状态。
6. [ ] 增加 SQLite 内存库测试，覆盖 migration、写后读、同 key 更新、不同轨共存、
   无效状态不缓存、容量裁剪与 live 优先竞态。
7. [ ] 同步文件头、Desktop 模块文档、Native 专题、测试清单与 ADR。
8. [ ] 跑 Rust test、Desktop build、环境标识 sensor 和文档 sensor，并手工验证冷启动
   恢复与 live session 接管。

## 风险 / 注意

- 当前工作区已有大量用户改动；实现仅触碰上述 Desktop/文档文件，不整理或覆盖无关改动。
- SQLite 初始化失败不能让 Desktop 无法启动；应降级为纯内存同步，并只向 stderr 记诊断。
- `get_snapshot` 的 SQLite 查询与新 session 事件可能并发，必须在返回缓存前二次读取
  `HostStore`，实时状态始终优先。
- 持久化不能放进桥接进程 stdout；所有数据库错误仍只写 stderr。
- 缓存只接受已通过三重 videoId 校验的 verified session，不能放宽 ADR-0007 的安全门。
- 大字幕 JSON 写入不能阻塞 React 发事件；写库在 Tauri async runtime 中执行，同时通过
  upsert 时间戳避免较旧任务覆盖较新快照。

## 验证方式

```bash
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
pnpm --filter @listenup/desktop build
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

手工回归：首次收到字幕后确认数据库生成；完全退出 GUI 后断开扩展再启动，显示最近缓存且
标记“本地缓存”；随后播放另一个视频，pending/loading 立即替换缓存，ready 后正常高亮；
重启后新视频成为最近缓存；production 与 DEV 分别生成独立数据库，互不读取。
