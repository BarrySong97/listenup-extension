# ListenUp 文档入口

> 目的: 作为仓库内长期文档的总入口，告诉协作者从哪里开始读、每类知识放在哪里
>
> 源码路径: `docs/`
>
> 覆盖范围: 文档导航、推荐阅读顺序、模块索引，不包含具体实现细节

## 源码定位

- 主路径: `docs/`
- 相关路径: `README.md`
- 相关路径: `CLAUDE.md`
- 相关路径: `AGENTS.md`

## 推荐阅读顺序

1. [系统总览](architecture/system-overview.md)
2. [仓库结构](architecture/repo-layout.md)
3. [运行时、权限与构建](architecture/runtime-permissions-and-builds.md)
4. [内容脚本文档索引](pages/content/README.md)
5. [全局工作流](workflows.md)
6. [全局测试规范](testing.md)

## 目录索引

- [architecture/](architecture/README.md): 跨模块系统级说明，包括仓库结构、运行时和构建
- [pages/](pages/README.md): 对齐 `src/pages/` 的入口页面文档
- [workflows.md](workflows.md): 开发、提交流程和文档同步要求
- [testing.md](testing.md): 当前测试方式、最低验证要求和手工回归清单

## 当前重点模块

- [pages/content/](pages/content/README.md): 真正面向用户的核心功能，优先维护
- [pages/newtab/](pages/newtab/README.md): 用于快速迭代字幕面板 UI 的预览页
- [pages/popup/](pages/popup/README.md): 用于打开预览页的轻量入口

## 相关文档

- [系统总览](architecture/system-overview.md)
- [内容脚本概览](pages/content/overview.md)
- [全局工作流](workflows.md)
