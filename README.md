# ListenUp

一套 YouTube 语言学习工具：浏览器扩展在 YouTube 页面注入字幕面板（逐句跳转 / 循环 / 录音 / AI 解释），macOS 桌面端把字幕同步到独立浮窗，官网负责下载分发。

pnpm workspace + Turborepo monorepo：

| 目录 | 是什么 |
|---|---|
| [`apps/extension`](apps/extension) | Chrome / Firefox 扩展（MV3） |
| [`apps/listenup-desktop`](apps/listenup-desktop) | macOS 桌面端（Tauri v2 + Rust） |
| [`apps/website`](apps/website) | 落地页（Next.js，Cloudflare Pages） |
| [`packages/mock-ui`](packages/mock-ui) | 官网用的桌面窗口静态复刻组件 |

## 快速开始

```bash
pnpm install
pnpm dev:extension   # 或 dev:website / dev:desktop
```

完整命令见 [`docs/run.md`](docs/run.md)。

## 文档

- **AI agent 从这里开始**：[`AGENTS.md`](AGENTS.md)（唯一入口：架构 / 红线 / 工作流 / 导航）
- 模块文档：[`docs/modules/`](docs/modules/) · 跨模块专题：[`docs/topics/`](docs/topics/)
- 运行手册 [`docs/run.md`](docs/run.md) · 编码规范 [`docs/conventions.md`](docs/conventions.md) · 测试 [`docs/testing.md`](docs/testing.md) · 决策日志 [`docs/decisions/`](docs/decisions/)
- 设计系统 [`design.md`](design.md)

文档结构遵循 [AI-Doc-System](https://github.com/BarrySong97/agent-harness-kit)：一切入口收敛到 `AGENTS.md`，一切细节收敛到 `docs/`，文件级信息只放在源文件的 AI 文件头里，由 `node scripts/check-docs.mjs` 守着不漂移。

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)。可 fork、自用、修改、非商用发布；商业使用需另行授权。
