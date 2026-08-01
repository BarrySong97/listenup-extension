# Desktop 双语字幕与 AI CLI — 实施计划

- 日期：2026-08-01
- 状态：实现完成；真实 YouTube / AI 手工回归待执行
- 关联 spec：`docs/spark/2026-08-01-desktop-bilingual-subtitle-cli-design.md`

## 方案概述

按已确认 spec 分四层实施：Extension 改为选择视频默认原语轨并升级 Native 协议；Desktop
Rust 增加 `sqlx + SQLite` 持久层与翻译领域校验；独立 `listenup` CLI 复用同一 Rust
library；Desktop React 前端使用 TanStack React Query 查询持久字幕视图并提供原语、译文、
双语三种显示模式。

实施保持两条状态链路分离：实时播放 session/cursor 和多视频仲裁继续由 `HostStore` 与
Tauri event 驱动；SQLite/译文通过只读 Tauri command 和 React Query 驱动。React Query
只设置窗口 focus refetch，不增加 SQLite 监测、定时轮询或 CLI 通知。

## 涉及文件 / 模块

- `apps/extension/src/pages/content/lib/captions/` — 原语选轨、默认轨与语言元数据。
- `apps/extension/src/pages/content/lib/subtitle-domain/` — 多轨发现结果和原语缓存身份。
- `apps/extension/src/shared/nativeSubtitleProtocol.ts`、Native bridge hook — 协议 v3。
- `apps/listenup-desktop/src-tauri/migrations/` — 视频、原语 revision、片段、译文及关联表。
- `apps/listenup-desktop/src-tauri/src/database/` — 连接、migration、repository 和查询。
- `apps/listenup-desktop/src-tauri/src/domain/` — revision hash、翻译文档校验与原子替换。
- `apps/listenup-desktop/src-tauri/src/lib.rs` — Tauri composition、缓存写入、查询 commands。
- `apps/listenup-desktop/src-tauri/src/bin/listenup.rs`、`src/cli/` — 独立 CLI。
- `apps/listenup-desktop/src/` — QueryClient、字幕查询 hook、模式/语言选择和双语渲染。
- Desktop/CLI 构建脚本与 release workflow — 构建、打包并暴露 `listenup` 可执行入口。
- `docs/modules/`、`docs/topics/`、`docs/testing.md`、`docs/decisions/` — 同步边界与决策。

## 分阶段任务

### 1. Extension 原语选轨与协议

1. [x] 扩充轨道选择器测试，先锁定日语/英语默认轨、同语言人工优先和无 default 回退。
2. [x] 将默认 `preferredLanguages: ["en"]` 改为 YouTube default 语言驱动，不放宽三重
   videoId 校验和 `pot` 重试。
3. [x] Native 协议升级到 v3，track 增加 `vssId` 与 `isDefault`，同步 TypeScript、Rust
   serde 类型和文件头。
4. [ ] 构建并验证 Extension 现有字幕面板仍只显示原语，SPA 切换不闪旧字幕。

### 2. SQLite 与共享领域层

1. [x] 引入 `sqlx`，参考 `seperate` 使用 app data dir、WAL、foreign keys、busy timeout
   和编译期 migration；初始化失败降级内存模式。
2. [x] 建立 `videos`、`source_tracks`、`source_revisions`、`source_segments`、
   `translation_sets`、`translation_segments`、`translation_segment_sources`。
3. [x] 将 verified + ready + 非空 session 转换成 canonical source revision 并事务 upsert；
   pending/loading/empty/error/cursor 不写库。
4. [x] 实现 source/translation/bilingual 只读视图和当前视频可用译文语言查询。
5. [x] 实现版本化 translation document、BCP 47、连续引用、顺序、交叉区间、完整覆盖和
   revision 匹配校验；commit 原子替换，dry-run 回滚。
6. [x] 使用内存 SQLite 补 repository/domain 测试，并保持 `HostStore` 单测不依赖数据库。

### 3. CLI

1. [x] 增加独立 Rust `listenup` binary 和参数解析层，复用 database/domain，不调用 GUI。
2. [x] 实现 `info`、`video list`、`subtitle get`、`translation list/get/apply/delete`。
3. [x] 实现 `--db`、`--env prod|dev`、`--json`、默认 dry-run、显式 `--commit` 和稳定退出码。
4. [x] 增加临时数据库 CLI 集成测试，覆盖成功、校验失败、dry-run、原子回滚和 revision 过期。
5. [x] 增加开发构建命令；把 production CLI 纳入 Desktop 打包/发布，DEV 使用同一二进制的
   `--env dev`，不修改 shell profile。

### 4. Desktop React Query 与 UI

1. [x] 引入 `@tanstack/react-query`、QueryClientProvider 和字幕 query hooks；queryFn 直接
   `invoke()` Tauri command。
2. [x] query key 包含 video、source revision、display mode、target language，并设置
   `refetchOnWindowFocus: true`；不设置 interval、文件 watcher 或 CLI socket。
3. [x] 增加原语/译文/双语模式和语言选择，持久化用户偏好；无匹配译文时回退原语并提示。
4. [x] 列表模式按语义时间块显示，支持多原文合并和同源拆分；当前时间按块范围高亮滚动。
5. [x] 影院模式显示单层或原语+译文双层，同时保持 NSPanel、透明背景和不抢焦点行为。
6. [x] 冷启动读最近缓存；任何新 live pending/loading session 都立即接管旧缓存。

### 5. 文档、棘轮与收尾

1. [x] 为持久字幕库、CLI 安全接口和原语/译文职责补 ADR。
2. [x] 同步 Extension/Desktop 模块文档、Native Messaging 专题、运行手册和测试清单。
3. [x] 更新所有待改/新增源码文件头。
4. [x] 增加可执行检查，锁定协议版本/字段、prod/dev 数据路径与 CLI 构建入口，防止回退成
   英语写死或环境串库。
5. [ ] 完成自动验证与可执行的本地手工回归；无法由当前环境控制的真实 YouTube/AI 步骤
   明确记录为人工复核，不用占位结果冒充通过。

## 数据迁移与兼容

- Desktop 当前没有字幕数据库，因此只需创建首版 migration，不迁移旧 Desktop 数据。
- Extension 现有 `chrome.storage.local` 字幕缓存继续存在，负责避免重复下载；其缓存键已含
  轨道 `vssId`，选轨变化不会让不同语言互相覆盖。
- Native 协议 v2 与 v3 不兼容，Extension/Desktop 必须配套升级；Rust 明确拒绝旧版本。
- 旧 source revision 的译文保留但不显示到新 revision，不自动删除用户生成译文。

## 风险 / 注意

- 工作区已有大量用户 staged/unstaged 改动；实现仅触碰计划列出的文件，提交继续使用隔离
  index，绝不 reset、unstage 或夹带现有改动。
- 当前 Desktop `lib.rs` 较大；数据库、领域和 CLI 必须拆成单一职责文件，避免继续膨胀。
- `NSPanel(nonactivatingPanel)` 不抢焦点是既有硬要求；React Query focus refetch 只使用
  WebView/Tauri 实际 focus 生命周期，不能为了刷新破坏窗口行为。
- CLI 和 GUI 并发写 SQLite 必须依赖 WAL、busy timeout 和事务，不添加第二套 schema 逻辑。
- 翻译文本是用户数据，任何清理都必须显式，不能复用普通缓存的容量淘汰。
- Native bridge stdout 仍只承载 Chrome 协议；独立 CLI 才能输出人类文本/JSON。

## 自动验证

```bash
pnpm --filter @listenup/extension test
pnpm build:extension:native-demo
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
cargo build --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml --bin listenup
pnpm --filter @listenup/desktop build
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

CLI 还需在临时 SQLite 上实际执行 `info`、`subtitle get`、translation dry-run/commit/get/delete；
Desktop 需实际验证窗口重新 focus 后 refetch、模式/语言切换、冷启动缓存和 live session 接管。

## 完成标准

- 日语视频默认原语为日语，英语视频默认原语为英语，不存在固定英语优先。
- 原语和 AI 译文在 SQLite 中带明确 BCP 47 语言、track 与 source revision。
- CLI 能让外部 AI 安全读取原文、校验并原子写入重组译文，不内置模型。
- Desktop 可显示原语、译文和双语，重新获得焦点后读取 CLI 最新提交。
- 无 SQLite 监测、无定时轮询、无 CLI 刷新通知。
- 所有自动验证通过；production/DEV、Native Host、socket、bundle 和数据库不串环境。
