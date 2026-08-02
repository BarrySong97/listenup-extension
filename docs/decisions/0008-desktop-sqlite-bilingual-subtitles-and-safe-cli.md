# 0008. Desktop 用 SQLite 管理原语/译文，并以安全 CLI 接入用户 AI

- 状态：已采纳
- 日期：2026-08-01

## 背景

Desktop 原先只消费当前进程里的字幕快照，Extension 又默认偏向英语。它既不能在重启后
查看字幕，也无法可靠表达“日语原文 + 用户 AI 生成的中文译文”。如果仅保存两组等长数组，
AI 合并或拆分句子后就会错位；如果把任意 SQL 交给 AI，则 schema、时间线和用户数据都
缺乏保护。

CLI 写库后的刷新也有多个选择：监听 SQLite 文件、定时轮询、让 CLI 通知 Desktop，或在
用户重新聚焦窗口时重新查询。前几种都会增加跨进程状态与长期后台工作，不符合第一版需求。

## 决策

Extension 默认以 YouTube player response 中 `audioIsDefault=true` 的原始音轨语言选择
字幕，同语言内优先人工字幕；元数据缺失时才回退默认字幕轨与首轨。Desktop
把 verified、ready、非空的原字幕保存到 SQLite，每个译文绑定不可变的 source revision，
并用显式多对多映射支持连续原句的合并和拆分。

第一方 `listenup` CLI 与 GUI 复用同一个 Rust database/domain 层，只接受版本化翻译 JSON；
写操作默认 dry-run，必须显式 `--commit`，不提供任意 SQL，也不内置模型。Desktop 用
TanStack React Query 调 Tauri 只读 command，仅在 mount、query key 变化和窗口重新聚焦时
refetch；不监测 SQLite、不轮询、也不接收 CLI 通知。

production、development 分别使用各自 bundle app-data 目录，CLI 用 `--env prod|dev`
选择；`--db` 只用于显式高级场景与测试。

## 理由

source revision 能阻止旧译文静默套到变化后的 YouTube 字幕上。译文到原句的显式映射让
播放时间仍由原字幕决定，同时允许目标语言采用自然的断句。共享领域层避免 GUI 和 CLI
出现两套 migration 或校验规则；受限命令面也比任意 SQL 更适合交给外部 AI Agent。

窗口 focus refetch 正好覆盖“用户在终端让 AI 翻译，随后切回 Desktop”的流程，且没有
文件 watcher、socket 通知或 polling 的维护成本。

## 后果

- Native 协议升级为 v3，Extension/Desktop 必须配套发布；track 携带 `vssId` 与
  `isDefault`。
- 用户可选择原语、译文或双语；没有目标译文时明确回退原语。
- AI 必须一次提交覆盖全部原句的完整文档；第一版不把半成品写入正式译文表。
- CLI 与 Desktop 可以借助 WAL 并发打开数据库，但 CLI 提交后不会实时推送 UI 更新。
- 磁盘数据库初始化失败时 GUI 降级到进程内 SQLite，实时字幕仍可用，但 CLI 持久化不可用。
- `scripts/check-environment-identifiers.mjs` 锁定协议 v3、原始音轨优先策略、官网不手写版本、
  环境数据路径、CLI sidecar 与无轮询查询规则，防止架构回退。
- 已发布的 SQLx migration 内容不可改写，sensor 固定其 SHA-384；早期开发版曾用同一完整
  schema 写入另一条 checksum，因此 database 层只对这条已知 checksum 且全部 schema
  对象完整的数据库修复 migration 元数据，其他 checksum 不匹配仍然拒绝打开。
