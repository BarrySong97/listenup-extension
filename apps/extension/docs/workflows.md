# Extension 工作流

> 目的: 约束 extension app 的通用开发流程，尤其是代码、文档和验证如何一起落地
>
> 源码路径: `apps/extension/src/`, `apps/extension/docs/`, `apps/extension/package.json`
>
> 覆盖范围: 开发顺序、文档同步要求、提交前检查和模块扩展时的动作

## 源码定位

- 主路径: `apps/extension/docs/`
- 相关路径: `apps/extension/src/`
- 相关路径: `apps/extension/package.json`

## 开发顺序

1. 先定位目标模块，并阅读 `apps/extension/docs/` 下对应目录。
2. 如果现有文档不足以支撑改动，先补文档入口或更新概览。
3. 改代码。
4. 运行最低验证命令并完成受影响模块的手工回归。
5. 同步更新文档，再提交代码。

## 什么时候必须更新文档

- 新增页面入口或核心模块
- 内容脚本架构、字幕加载链路或交互方式发生变化
- 构建命令、权限、资源注入方式发生变化
- 新增明显的开发陷阱或历史决策

## 文档放置规则

- 系统级知识写到 `apps/extension/docs/architecture/`
- 页面级知识对齐 `apps/extension/docs/pages/`
- 测试要求更新到 `apps/extension/docs/testing.md` 或对应模块 `testing.md`
- 踩坑优先写到对应模块的 `faq.md`

## 提交前检查清单

- [ ] 相关 `apps/extension/docs/` 文档已同步更新
- [ ] 新增入口、约定或行为变化已有文档入口
- [ ] 文档中的路径、命令和变量已对照源码
- [ ] 最低构建验证已通过
- [ ] 需要手工回归的场景已完成

## 新增模块时的最低动作

如果未来在 `src/pages/` 下新增模块，至少同时创建：

- `apps/extension/docs/pages/<module>/README.md`
- `apps/extension/docs/pages/<module>/overview.md`

如果新增的是系统级能力，不属于单个页面，则在 `apps/extension/docs/architecture/` 下补对应专题，并把它挂到 `apps/extension/docs/README.md`。

## 相关文档

- [文档总入口](README.md)
- [全局测试规范](testing.md)
