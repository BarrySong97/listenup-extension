# 0006. 采用 AI-Doc-System 文档结构，全仓文档收敛到根 `docs/`

- 状态：已采纳
- 日期：2026-07-25

## 背景

改造前仓库有三套并行的文档体系：根 `docs/`（仓库级）、`apps/extension/docs/`（22 个文件的完整二级体系）、各 app 的 `README.md`，外加一份 `apps/extension/docs-playbook.md` 描述"应该怎么写文档"。同一件事经常有两个入口（例如测试规范在根 `docs/testing.md` 和 `apps/extension/docs/testing.md` 各有一份），agent 读到哪份取决于它先 grep 到哪个，且没有任何机制保证文档跟着代码走。

## 决策

采用 [agent-harness-kit](https://github.com/BarrySong97/agent-harness-kit) 的 AI-Doc-System：

1. `CLAUDE.md` 只一句话跳转，`AGENTS.md` 是唯一入口（是什么 / 架构 / 红线 / DoD / 导航）
2. 所有细节文档收敛到根 `docs/`：`modules/<module>/`（一个 app 或 package 一个文件夹）、`topics/`（跨模块）、`run.md` / `conventions.md` / `testing.md` / `specs/` / `plans/` / `decisions/`
3. 每个源文件顶部加轻量 AI 文件头（`@purpose` / `@role` / `@deps` / `@gotcha`），**不写函数签名**
4. `scripts/check-docs.mjs` 作为收尾闸门，接到 Claude / Codex 的 Stop hook（`exit 2` 才真拦），另配 `scripts/hooks/` 的 guard / format-lint / pre-commit
5. 删除 `apps/extension/docs/`、`apps/extension/docs-playbook.md`、根 `docs/architecture/` 与 `docs/workflows.md`，内容合并进上述结构

## 理由

- **单一入口消除歧义**：agent 把任何能 grep 到的文本都当权威，两份同名文档必然导致按过期的那份行事
- **机制 > prompt**：光写"记得更新文档"没用；`check-docs` 把缺文件头和失效引用变成 `exit 2`，是绕不过去的
- **文件头承载文件级信息**：模块文档不再重复文件细节，避免同一件事在两处过期
- monorepo 的模块边界正好落在 `apps/*` 和 `packages/*` 的一级目录上，与 `check-docs` 的漂移检测粒度天然对齐（配置见 `check-docs.config.json` 的 `sourceRoots`）

备选：保留分层（根 docs 放跨仓库、app 内保留自己的 docs）。否决——那正是改造前的状态，两个入口的问题不解决。

## 后果

- 新增 app / package 必须同时建 `docs/modules/<name>/README.md` 并登记到 `AGENTS.md` 导航，否则 `check-docs` 会报模块缺文档
- 新增源文件必须带文件头，否则 `check-docs` 判 ❌ 并阻止 agent 收尾
- 文档里的相对链接会被 `check-docs` 校验，重命名文档要连带修引用
- `apps/*/README.md` 退化成"给人看的极简说明 + 指向 docs/modules/"，不再承载知识
- 当前 `scripts/hooks/format-lint.mjs` 的 `LINT_CMD` 是空的——仓库只有 website 配了 eslint，没有统一的单文件 lint 命令。补齐 lint 工具链时应一并填上
