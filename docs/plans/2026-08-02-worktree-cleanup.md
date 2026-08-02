# 历史工作区改动收口计划

- 日期：2026-08-02
- 批准：用户明确要求“该 commit 的 commit，不该 commit 的清掉”

## 目标

清理历史遗留的批量暂存快照，把仍有价值的仓库级改造拆成可审查提交，并删除可再生成的
本地临时产物。不得回退已经发布的 CLI、Extension 或 Desktop 功能。

## 执行批次

1. [x] 清理 `.superpowers/` 与生成的 Chrome Web Store 截图，并补齐 `.gitignore`。
2. [x] 提交可复现 Chrome Web Store 截图的 Website 辅助路由，验证静态导出。
3. [x] 提交 AI 文档系统迁移：集中模块文档、ADR、源码文件头与仓库导航。
4. [x] 提交文档防漂移 sensor、Git hook、Claude / Codex 项目配置。
5. [x] 运行 docs sensor、环境隔离检查和受影响应用构建，确认工作区干净后推送。

## 清理原则

- `.superpowers/` 只包含本地 brainstorm 进程状态与临时 HTML，不进入版本库。
- `apps/extension/store-assets/` 是由 `/store-shot` 页面生成的中间图片，不提交二进制副本。
- 旧 `apps/extension/docs/` 的有效内容已迁移到根 `docs/modules/extension/` 后才删除。
- 纯文件头变更与文档迁移同批提交，不冒充产品行为变更。
