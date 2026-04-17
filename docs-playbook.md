# 项目文档维护手册（通用模板）

> 目的: 定义一套可复用的项目文档组织方式，让人和 AI 都能在同一个路径下找到、写入、维护长期知识。
>
> 适用范围: 任意中大型代码仓库（单体 / monorepo 均可）。把本文档复制到新项目后，按"需要替换的占位符"一节调整即可使用。
>
> 核心原则: 文档是所有协作者（包括未来的 AI）共享的长期记忆；`CLAUDE.md` / AI memory 只是当前会话的短期笔记，不能替代文档。

---

## 1. 为什么把文档集中放在 `docs/`

1. **单一可信来源（Single Source of Truth）**
   - 所有"需要记住的知识"（架构、约定、踩坑、接口说明、工作流）只在 `docs/` 下有一份。
   - 避免同一件事散落在 `README.md`、Wiki、Notion、Slack、AI memory 里，导致各版本冲突。

2. **与代码同仓库、同 PR 评审**
   - 文档修改走 Git，能 review、能 blame、能 rollback。
   - 改代码时顺手改文档，可以在同一个 PR 里被 review，降低"代码改了但文档忘了改"的概率。

3. **对 AI 友好**
   - AI agent（Claude Code、Cursor 等）读 `docs/` 的成本远低于扫全仓库。
   - 顶层 `CLAUDE.md` / `AGENTS.md` 只存极简约定，真正的细节放 `docs/`，按需加载，节省 context。
   - AI 发现的新约定、踩坑、配置差异应写回 `docs/`，而不是写进只属于自己的 memory。

4. **按模块分区，降低阅读负担**
   - 每个 app / package / 子系统有自己的目录，读者只需读相关的那一部分。
   - 顶层 `docs/README.md` 做导航，像书的目录一样。

5. **规范化模板，降低写作成本**
   - 每种文档都有固定结构（Purpose / 源码路径 / 覆盖范围 / 正文 / 相关文档）。
   - 不用每次想"这篇怎么写"，照模板填即可。

---

## 2. 目录结构约定

> ⚠️ **重要：下面的结构只是一个示例**，它对应的是"monorepo + apps/packages 分层"的项目。
>
> **实际项目请根据自己的源码结构镜像映射**，核心原则是：
>
> - **一个模块一个 `docs/` 子目录**。模块是什么由项目决定 —— 可以是"一个 app"、"一个 package"、"一个 service"、"一个 Django app"、"一个 Rails engine"、"一个 bounded context"，甚至是"一个核心领域模块"（比如 `billing/`、`auth/`、`inventory/`）。
> - **`docs/` 下的目录结构尽量对齐源码结构**。源码是 `src/services/` + `src/modules/`，文档就可以是 `docs/services/` + `docs/modules/`；源码是扁平单应用，文档也可以扁平。
> - **跨模块 / 全局的内容单独放顶层专题目录**（`architecture/`、`perf/`、`security/`、`migrations/` 等）。
> - **无论项目结构怎样，以下几类文档都应该存在**：总入口 `README.md`、全局 `workflows.md`、全局 `testing.md`、每个模块至少一个 `README.md` + `overview.md`。

### 示例 A：Monorepo（apps/ + packages/）

```
<repo-root>/
├── CLAUDE.md                      # AI 约定（极简）：命令速查 + 核心规则 + 指向 docs/
├── AGENTS.md                      # 与 CLAUDE.md 内容完全相同（见第 3 节说明）
├── README.md                      # 人类 onboarding（极简）
└── docs/
    ├── README.md                  # 文档总入口 / 导航
    │
    ├── architecture/              # 跨模块 / 系统级总览
    │   ├── README.md
    │   ├── system-overview.md
    │   ├── repo-layout.md
    │   ├── service-dependencies.md
    │   └── runtime-ports-and-environments.md
    │
    ├── apps/                      # 每个可部署应用一个目录
    │   └── <app-name>/
    │       ├── README.md          # 本模块文档索引
    │       ├── overview.md        # 职责、依赖、主要入口
    │       ├── architecture.md    # 启动链路、内部分层
    │       ├── setup.md           # 脚本、端口、本地开发
    │       ├── testing.md
    │       ├── faq.md
    │       ├── features/
    │       │   └── <feature>.md
    │       └── reference/
    │           └── <topic>.md
    │
    ├── packages/                  # 每个共享包一个目录（结构同 apps/）
    │   └── <package-name>/
    │       └── ...
    │
    ├── testing.md
    ├── workflows.md
    └── perf/
        └── <topic>.md
```

### 示例 B：单体应用（按领域拆分）

```
<repo-root>/
├── CLAUDE.md
├── AGENTS.md
└── docs/
    ├── README.md
    ├── architecture/
    │   ├── system-overview.md
    │   └── data-model.md
    ├── modules/                   # 按业务域组织，对齐 src/modules/
    │   ├── auth/
    │   │   ├── README.md
    │   │   ├── overview.md
    │   │   └── reference/
    │   ├── billing/
    │   └── inventory/
    ├── testing.md
    └── workflows.md
```

### 示例 C：扁平小项目

```
<repo-root>/
├── CLAUDE.md
├── AGENTS.md
└── docs/
    ├── README.md
    ├── overview.md                # 整个项目一篇概览就够
    ├── architecture.md
    ├── setup.md
    ├── testing.md
    ├── workflows.md
    └── faq.md
```

**怎么选？** 用一个简单的判断：*"如果我要新增一块功能，我应该去源码的哪个目录？"* —— 把 `docs/` 的目录结构按同样的粒度镜像过去即可。

### 目录命名约定

- 全小写 + 中划线：`contacts-and-whitelist.md`、`runtime-ports-and-environments.md`。
- 每个有内容的目录都有一个 `README.md` 做索引，避免读者点进去发现是一堆没分类的文件。
- 文件名反映主题，而不是时间或作者：❌ `2025-05-migration.md`，✅ `email-provider-migration.md`。

### 文档分类

| 类型 | 位置 | 职责 |
|------|------|------|
| **导航** | 每个目录的 `README.md` | 只做索引，列出本目录的所有文档 + 一行描述。不写细节。 |
| **概览** | `<module>/overview.md` | 职责、边界、依赖、主要入口。让人 30 秒了解这个模块是做什么的。 |
| **架构** | `<module>/architecture.md` | 内部分层、启动链路、关键抽象。让人能修改而不破坏。 |
| **配置** | `<module>/setup.md` | 脚本、环境变量、端口。让人能跑起来。 |
| **测试** | `<module>/testing.md` | 该模块的测试策略和落点。 |
| **FAQ** | `<module>/faq.md` | 踩坑、常见问题、历史决策。 |
| **功能** | `features/` | 业务功能视角的说明。 |
| **参考** | `reference/` | 查找型：接口列表、路由表、schema 清单。 |
| **专题** | `perf/`、`security/` 等 | 跨模块的深度专题。 |

---

## 3. 如何访问文档

### 人类视角

1. 从仓库根目录的 `CLAUDE.md` / `AGENTS.md` / `README.md` 看到"详细文档在 `docs/`"的指引。
2. 打开 `docs/README.md`，按"推荐阅读顺序"或模块列表跳转。
3. 模块目录里先读 `README.md`（索引）→ `overview.md`（这是什么）→ 按需读 `architecture.md` / `setup.md` / 其他。

### AI agent 视角 —— `CLAUDE.md` + `AGENTS.md` 双文件

不同的 AI 编程工具会读不同文件名的约定：

- **Claude Code** / Anthropic 系工具：读 `CLAUDE.md`
- **Cursor / Codex / OpenAI Codex CLI / 其他通用 AI 工具**：读 `AGENTS.md`（社区正在形成的通用约定）

**规则：两个文件都要建，且内容完全一致。**

推荐做法（二选一）：

1. **两份拷贝**：直接把 `CLAUDE.md` 的内容复制一份叫 `AGENTS.md`。改动时两份一起改。优点是兼容性最强。
2. **一份 + 软链**：保留 `CLAUDE.md` 为主，在仓库根 `ln -s CLAUDE.md AGENTS.md`（或反过来）。只维护一份，但某些平台对软链支持不一致，需自行验证。

> **重要：新项目初始化流程必须是"生成 `CLAUDE.md` → 同步生成 `AGENTS.md`"，两者同步更新。** 任何时候看到两份内容不一致，以修改较新的为准并同步另一份。

两份文件都应包含一条强约束：

```markdown
## 文档优先

- 处理某个模块前，先阅读 `docs/` 下对应的文档目录，获取该模块的架构、接口、依赖等上下文信息。
- 发现新约定、踩坑经验、配置差异时，必须优先更新 `docs/`，而不是只写到 AI 自己的 memory 里。
  项目文档对所有人（包括未来的 AI）可见，memory 只有当前实例能用。
```

然后在 `CLAUDE.md` / `AGENTS.md` 的模块表格里为每个模块附上 `docs/` 路径，AI 就能按图索骥。

### 推荐阅读顺序

1. 顶层系统总览（例：`docs/architecture/system-overview.md` 或 `docs/overview.md`）。
2. 按当前任务选择具体模块目录。
3. 涉及接口、schema、迁移、测试时，进入 `reference/` / `domains/` 或顶层规范文档。

---

## 4. 如何记录文档

### 4.1 每篇文档的头部模板

**所有文档的开头必须是这三行，帮助读者 5 秒内判断要不要继续读：**

```markdown
# <文档标题>

> 目的: <一句话说清楚这篇文档要解决什么问题 / 回答什么问题>
>
> 源码路径: `<相对于仓库根的路径>`
>
> 覆盖范围: <列出这篇覆盖的主题，圈定边界，避免读者产生错误预期>

## 源码定位

- 主路径: `<path>`
- 相关路径: `<path>`（可选）

<正文>

## 相关文档

- [<相关文档标题>](<相对路径>)
```

### 4.2 常用正文结构

- **概览类**（`overview.md`）：模块职责 / 关键依赖 / 主要入口 / 相关文档。
- **架构类**（`architecture.md`）：启动链路 / 内部分层 / 关键抽象 / 数据流。
- **配置类**（`setup.md`）：必需的环境变量 / 脚本命令 / 端口 / 常见启动问题。
- **测试类**（`testing.md`）：测试落点 / 怎么跑 / 新增代码的测试要求。
- **FAQ**：按"问题 → 原因 → 解决 / 规避方法"的 Q&A 结构。
- **参考类**（`reference/`）：表格、列表、schema 清单。

### 4.3 写作风格

- **索引只索引，不写细节。** `README.md` 只放"一行标题 + 一行描述 + 链接"，细节下沉到子文档。
- **所有路径、命令、变量名以源码为准。** 不要写"大概位于"这种模糊说法；要么写准确路径，要么不写。
- **用相对链接互相引用。** 方便在 GitHub / VS Code / Obsidian 等工具里跳转。
- **保持简洁。** 一段不超过 5 行，一节不超过一屏。长内容拆成子文档。
- **标明决策的原因（Why）**，不只是事实（What）。代码读得出"是什么"，文档要回答"为什么"。

### 4.4 交叉引用

- 每篇文档底部列一个"相关文档"小节，链接上下游文档。
- 有依赖关系的模块之间互相链接，形成一张知识网，而不是孤岛。

---

## 5. 什么时候记录

### 5.1 必须记录的时机

- 🆕 **新建模块**（app / package / 服务）时，同步建立对应 `docs/` 目录 + `README.md` + `overview.md`。
- 🔄 **架构调整**：启动链路、分层、核心抽象发生变化时，更新 `architecture.md`。
- ➕ **新增接口 / 页面 / 功能**时，更新对应的 `reference/` 或 `features/` 文档。
- 🗄️ **数据库 schema 变更**：迁移之外，更新包文档的 schema 清单 / domain 说明。
- ⚙️ **新约定 / 工作流变化**：新的提交规范、分支策略、代码风格，更新 `workflows.md`。
- 🐛 **踩坑后**：发现非显然的陷阱、历史决策、环境差异，写到对应模块的 `faq.md`。
- 🔐 **环境变量 / 端口 / 基础设施变化**：更新 `setup.md` 和 `architecture/runtime-ports-and-environments.md`。

### 5.2 推荐记录的时机

- 一次耗时超过 30 分钟的调试：把根因和修复方向写到 FAQ。
- 一次跨模块的讨论结论：把决策写到对应专题或 FAQ。
- 引入新的外部依赖 / 第三方服务：写到相关模块的 overview 和 setup。

### 5.3 不要记录

- **代码本身能表达的**（文件路径、目录结构、导入关系）—— 除非是入口索引级别。
- **短期的任务状态 / TODO** —— 用 issue / PR / 任务系统。
- **个人 memory / AI session 笔记** —— 那是给自己看的，不属于项目文档。
- **很快会变的临时状态**（本周谁在做什么、下周要改什么）—— 放任务管理工具。

### 5.4 提交前检查清单

在 `workflows.md` 里明文规定：

- [ ] 相关 `docs/` 文档已同步更新
- [ ] 新增接口 / 页面 / 约定有对应的文档入口
- [ ] 文档中的路径、命令、变量已对照源码验证
- [ ] 类型检查通过、测试通过

---

## 6. 维护原则

1. **改代码时顺手改文档。** 让文档修改成为 PR 的一部分，而不是遗留的技术债。
2. **发现过时立刻修。** 读文档时发现跟代码不一致，当场更新或开 issue，不要"下次再说"。
3. **索引保持精简。** `README.md` 超过一屏就考虑拆分。
4. **新加一篇就进索引。** 孤儿文档等于没写。
5. **约定写进 `CLAUDE.md` / `AGENTS.md`，细节留给 `docs/`。** 顶层约定应简短稳定，docs 承载大量细节。
6. **定期盘点（可选）。** 每季度 / 每个大版本扫一次 `docs/`，删过时内容，合并重复内容。

---

## 7. 移植到新项目的步骤

1. **确定模块划分**：对齐源码结构，决定 `docs/` 该按 `apps/packages/` / `modules/` / 扁平 / 其他方式组织（参考第 2 节三个示例）。
2. **创建 `docs/` 骨架**：建 `docs/README.md` 作为总入口，列出计划中的模块目录（即使还是空的）。
3. **同时生成 `CLAUDE.md` 和 `AGENTS.md`**：
   - 先写 `CLAUDE.md`（命令速查 / 核心规则 / 模块表 / 文档优先约束）。
   - **立刻把相同内容复制到 `AGENTS.md`**（或建软链）。**这一步不能跳过**，否则非 Claude 系 AI 工具会读不到约定。
4. **在 `CLAUDE.md` / `AGENTS.md` 里加入三条核心约束**：
   - 处理模块前先读 `docs/` 对应目录。
   - 发现新约定 / 踩坑必须写到 `docs/`，不是 memory。
   - 提交前确认文档已同步。
5. **为每个已有模块补一个最小 `README.md` + `overview.md`**（先占位，再逐步补齐）。
6. **建 `docs/workflows.md`**，定义新增接口 / 页面 / 迁移 / 提交的标准流程。
7. **建 `docs/testing.md`**，定义测试要求和落点。
8. **按实际情况新增专题目录**（`perf/`、`security/`、`migrations/` 等）。

---

## 8. 需要替换的占位符

把本文档带到新项目时，至少要确认 / 修改以下内容：

- **项目特定的模块划分**：当前示例是 `apps/` + `packages/`（monorepo），单体 / 按领域 / 扁平项目需要换成对应结构。
- **项目特定的命令**（`pnpm dev` / `npm run dev` / `cargo run` / `python manage.py runserver` 等）。
- **项目特定的提交规范**（Conventional Commits / 其他）。
- **技术栈差异导致的专题目录**（前后端 / 纯后端 / 纯前端 / 数据平台等各自需要的专题不同）。
- **数据库 / 基础设施相关段落**（如果项目不使用数据库，删除迁移相关要求）。
- **AI 约定文件**：确认同时建立 `CLAUDE.md` 和 `AGENTS.md`，内容保持一致。

---

## 相关文档

- 顶层 AI 约定：`CLAUDE.md` 和 `AGENTS.md`（两份，内容一致）
- 文档总入口：`docs/README.md`
- 工作流规范：`docs/workflows.md`
- 测试规范：`docs/testing.md`
