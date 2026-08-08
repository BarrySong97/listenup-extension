# 编码规范

## 命名

- 目录：kebab-case（`subtitle-domain/`、`youtube-sdk/`）
- React 组件文件：PascalCase（`SubtitleItem.tsx`）；其余模块文件 camelCase（`subtitleParser.ts`、`explainClient.ts`）
- Hook 文件与函数：`useXxx`
- 变量 / 函数 camelCase，类型 / 组件 PascalCase，常量 UPPER_SNAKE
- 文档文件：全小写 + 中划线（`build-and-manifest.md`）

## 目录与文件结构

- 每个源文件顶部必须有 **AI 文件头**（`@purpose` / `@role` / `@deps` / `@gotcha`）。只写职责级信息，**不写函数签名**——签名最容易过期，看代码即可。缺头会被 `check-docs` 判为 ❌。
- 一个文件一件事。字幕面板的组件、hook、领域逻辑分别落在 `components/` / `hooks/` / `lib/`，不要在组件里直接写抓取或解析。
- 新增模块（`apps/*` 或 `packages/*` 下的一级目录）必须同时建 `docs/modules/<module>/README.md` 并登记到 `AGENTS.md` 导航。

## 架构边界

- 扩展内容脚本分四层，依赖方向单向向下，不得反向：
  `components/hooks` → `lib/subtitle-domain`（编排/缓存/传输）→ `lib/captions`（轨道发现）+ `lib/subtitles`（纯解析清洗合并）
- `lib/subtitles/` 保持无副作用：不碰 DOM、不碰 `chrome.*`。它是将来最先能加自动化测试的一层。
- 页面桥接（`public/scripts/inject-youtube.js`）与内容脚本是两个 JS 上下文，只能通过 `postMessage` 通信；改一边必须同时看另一边和 `manifest.json` 的 `web_accessible_resources`。
- Extension 与 Desktop 之间的消息契约集中在 `apps/extension/src/shared/nativeSubtitleProtocol.ts`，改字段必须两端同步。
- 当前这些边界**只有文档约束，没有 linter 强制**。新增边界规则时优先做成可执行检查（见下方 Ratchet）。

## Ratchet（棘轮原则）

- agent 犯了错，别只修这一处：固化成一条 lint 规则 / 检查脚本 / ADR，保证同样的错不再犯。
- 能用确定性工具强制的就别只写进文档——文档会腐烂，检查不会。
- 现有的确定性守卫：`scripts/check-docs.mjs`（文件头 / 失效引用 / 文档漂移）、`scripts/hooks/guard*.mjs`（危险命令与敏感文件）。

## Plane 项目管理

- Plane 像 Jira / Linear 一样，是项目工作的唯一台账。新 Feature、体验或性能改进、Bug、技术债、
  调研/Spike、发布事项、回归缺口、待确认风险和明确的后续 TODO，都必须在提出或发现的当次
  工作中创建或更新 Plane work item；不得只留在对话、源码 `TODO`、提交说明、需求文档或
  Markdown `- [ ]` 中。
- 同一事项从需求澄清、方案分析、实施到验收应持续更新同一个 work item；需要独立排期、状态、
  负责人或验收标准的子目标才拆成新项。Spec、设计和 `docs/plans/` 负责讲清方案，Plane 负责
  归属、优先级、状态与历史，两者必须用编号互相引用，不能各自形成一套待办。
- 创建前先按标题关键词查重；复用既有 work item 时补评论，写清本次发现的新证据。新建项至少
  记录现象/目标、影响范围、下一步和验收标准，并根据实际紧急程度设置优先级。
- `docs/plans/` 中存在未完成行动项时，文档头部或对应条目必须写明覆盖它的 Plane 编号；一个
  Plane work item 可以覆盖同一交付目标下的一组检查项，但不能用无关任务占位。
- 状态必须反映真实进度：开工前转 `In Progress` 并说明方案；实现后回写 commit 与验证证据，
  再转待验收/完成；受阻或暂缓时也要写明核实过程并回到合适状态，不能静默搁置。
- 纯背景说明、没有形成需求或后续动作的临时讨论不需要建单。只要形成需要规划、实施、验证或
  回顾的项目事项，就必须进入 Plane；交付说明中同时给出对应编号，方便以后回顾。

## 错误处理

- 字幕域用具名错误类（`lib/subtitle-domain/errors.ts`）向上抛，UI 层映射成 loading / empty / error / ad 四态之一，不要在中间层吞掉。
- Explain 链路：缺 API key 抛 `MissingApiKeyError`，UI 给「Open AI Settings」入口，而不是只显示一句报错。
- Native 链路是「尽力而为」：Host 缺失或断开**不得**影响扩展字幕面板本身。

## 日志

- 内容脚本日志统一带前缀，字幕域用 `[ListenUp:subtitles]`，方便在 YouTube 页面的噪音里过滤。
- Desktop 桥接模式下 **stdout 被 Native Messaging 协议独占**，任何诊断只能写 stderr（写错会直接破坏协议帧）。
- 不要把 API key、字幕全文等打进生产日志。

## 提交规范

- Conventional Commits：`type(scope): subject`，type 用 feat / fix / docs / refactor / chore / test，scope 用模块名（`extension` / `website` / `desktop` / `docs`）。
- 一次提交一件事；信息说清「为什么」，「是什么」看 diff。
- 不使用 `--no-verify` 绕过 pre-commit（`scripts/hooks/guard.mjs` 会拦）。

---

# 术语表

| 术语 | 英文 / 标识符 | 含义 |
|---|---|---|
| 字幕轨 | `caption track` | YouTube 提供的一条字幕，含语言、是否自动生成、track URL |
| 字幕域 | `subtitle-domain` | 负责聚合轨道来源、下载、解析、缓存的编排层 |
| 页面桥接 | `PageBridge` / `inject-youtube.js` | 注入到 YouTube 页面上下文的脚本，用于读播放器内部数据 |
| 播放游标 | `cursor` | 发给桌面端的当前播放时间 / 字幕索引，播放中最多 100ms 一次，关键事件立即发 |
| 会话 | `session` | 发给桌面端的一次字幕快照（videoId + 标题 + 全量字幕） |
| 桥接进程 | `bridge process` | 被 Chrome 拉起的无窗口 Tauri 二进制，转发 stdin 到 Unix socket |
| 影院模式 | `cinema mode` | Desktop 窗口缩成一条字幕带的形态 |
| 预览页 | `UI Preview` / `newtab` | 脱离 YouTube 迭代面板 UI 的扩展页面 |
| 解释卡片 | `Explain card` | 选中字幕文本后滑出的 AI 讲解卡片 |

---

# 评审自查清单（收尾前对照）

- [ ] 改动小而内聚，没有夹带无关重构
- [ ] 命名、风格与周边代码一致
- [ ] 没有违反 [AGENTS.md](../AGENTS.md) 的红线规则
- [ ] 涉及文件的 AI 文件头已更新
- [ ] 对应 `docs/modules/<module>/`（或跨模块 `docs/topics/`）已同步；决策性改动已补 [ADR](decisions/)
- [ ] 新增 Feature / 改进 / Bug / 技术债 / 调研 / 发布事项 / 回归缺口 / TODO 已创建或更新 Plane，并在需求/计划中写明编号
- [ ] 受影响 app 的构建跑通，[testing.md](testing.md) 里对应的手工回归已做
- [ ] `node scripts/check-docs.mjs` 无 ❌
