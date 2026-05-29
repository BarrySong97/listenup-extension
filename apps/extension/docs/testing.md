# Extension 测试规范

> 目的: 给 extension app 定义当前真实可执行的测试底线和模块级验证入口
>
> 源码路径: `apps/extension/package.json`, `apps/extension/src/`
>
> 覆盖范围: 全局构建验证、模块级手工测试入口和新增改动的验证要求

## 源码定位

- 主路径: `apps/extension/package.json`
- 相关路径: `apps/extension/src/pages/content/`

## 当前测试现实

仓库当前没有成熟的自动化测试套件。可执行的基础验证主要是构建和手工回归，因此提交前至少要确认：

- 相关构建通过
- 受影响模块按文档完成手工验证

## 最低命令

```bash
pnpm build:extension
```

必要时补充：

```bash
pnpm build:firefox
```

## 模块级测试入口

- 内容脚本: [docs/pages/content/testing.md](pages/content/testing.md)
- 视觉调试: [docs/pages/newtab/overview.md](pages/newtab/overview.md)

## 新增自动化测试时的要求

如果后续新增测试框架，应同步更新：

- 本文档的命令和最低门槛
- 对应模块的 `testing.md`
- `apps/extension/docs/workflows.md` 中的提交流程

## 相关文档

- [全局工作流](workflows.md)
- [内容脚本测试](pages/content/testing.md)
