# 0005. 使用 PolyForm Noncommercial 1.0.0 许可证

- 状态：已采纳
- 日期：2026-07-25（回填历史决策）

## 背景

项目开源在 GitHub（用户要从 Releases 下载安装包），但作者不希望别人把它直接拿去卖或集成进商业产品。项目同时包含来自 `vite-web-extension` 模板的 MIT 代码。

## 决策

主许可证用 **PolyForm Noncommercial 1.0.0**。允许 fork、自用、学习、研究、非商用修改与免费分发；禁止销售、商业产品集成、商业运营。商业使用需单独授权。上游模板的 MIT notice 保留在根 `LICENSE` 里。

## 理由

- 需要"源码公开可读、可自行构建安装"，同时保留商业权利，PolyForm Noncommercial 正是为此设计的标准文本
- 自己写许可条款不可取；用标准文本才有法律确定性
- MIT 要求保留 notice，删不得

## 后果

- 项目**不是** OSI 意义上的开源，README 和文档里不要写成 "open source"，写 "source-available / noncommercial"
- 引入第三方代码或素材前要确认许可证兼容，带额外要求的在 `LICENSE` 或单独 notice 里保留声明
- 改许可证要同步三处：根 `LICENSE`、`apps/extension/package.json` 的 `license` 字段、`apps/extension/README.md`
