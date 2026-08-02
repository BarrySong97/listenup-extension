# ListenUp — Agent 指南

**是什么**：一套 YouTube 语言学习工具。浏览器扩展在 YouTube 页面注入字幕面板（逐句跳转 / 循环 / 录音 / AI 解释），macOS 桌面端把字幕同步到独立浮窗，官网负责下载分发。

**架构**：pnpm workspace + Turborepo monorepo · TypeScript / React 19 / Tailwind v4 · MV3 扩展（Vite + @crxjs）+ Next.js 站点 + Tauri v2（Rust）桌面端 · 运行见 [docs/run.md](docs/run.md)

## 🚨 红线（不可逾越；每条都标出处）

- **内容脚本在 Shadow DOM 里**：HeroUI 交互一律用 `onPressStart`，下拉必须复用 `apps/extension/src/components/ui/Dropdown.tsx` —— 见 [ADR-0001](docs/decisions/0001-content-script-shadow-dom.md)
- **内容脚本样式只走 `style.css?inline` 且 `rem` → `em`**，不要改成普通样式表注入 —— 见 [ADR-0001](docs/decisions/0001-content-script-shadow-dom.md)
- **不要把 `manifest.json` 改成 Firefox 专用格式**，Firefox 差异只在 `vite.config.firefox.ts` 里转换 —— 见 [extension/build-and-manifest.md](docs/modules/extension/build-and-manifest.md)
- **生产与 DEV 扩展都必须声明 `nativeMessaging`，功能保持一致**；两套环境必须使用不同 Extension ID / Host / bundle / socket，桥接进程的 stdout 专供协议，诊断只能写 stderr —— 见 [ADR-0002](docs/decisions/0002-dev-prod-separate-desktop-apps.md) 与 [ADR-0003](docs/decisions/0003-native-messaging-single-binary.md)
- **Website 必须能静态导出**：不得新增 API route、`headers()` 或动态渲染，否则 Cloudflare Pages 构建会挂 —— 见 [ADR-0004](docs/decisions/0004-website-static-export.md)
- **不手改生成物**：`dist_chrome*/`、`dist_firefox/`、`apps/website/out/`、`apps/extension/public/manifest.json`、`src-tauri/target/`
- **不得为通过检查而放宽检查**：不删 `scripts/check-docs.mjs`、不改 `check-docs.config.json` 放宽规则、不塞占位文件头

## ✅ 工作流（Definition of Done，缺一不算完成）

1. 读相关模块文档 [docs/modules/](docs/modules/)（跨模块专题看 [docs/topics/](docs/topics/)）+ 待改文件的文件头
2. 大改先写 [docs/plans/](docs/plans/) 计划（Plan → Approve → Execute）
3. 改代码，遵循 [docs/conventions.md](docs/conventions.md)
4. 同步：文件头 + 对应 `docs/modules/<module>/`（跨模块的写 `docs/topics/`）；决策性改动补一条 [ADR](docs/decisions/)
5. 按 [docs/testing.md](docs/testing.md) **真跑验证**（本仓库没有自动化测试，构建 + 手工回归是底线）
6. 跑 sensors：`node scripts/check-docs.mjs` + 受影响 app 的构建 / lint，清掉报错
7. 按 [docs/conventions.md](docs/conventions.md) 提交

> **Ratchet 棘轮**：agent 犯了错，别只修这一处——固化成一条 lint 规则 / 检查 / ADR，保证同样的错不再犯。

## 📚 导航

- **模块**：[extension](docs/modules/extension/) · [website](docs/modules/website/) · [listenup-desktop](docs/modules/listenup-desktop/) · [listenup-cli](docs/modules/listenup-cli/) · [mock-ui](docs/modules/mock-ui/)
- **专题（跨模块）**：[Native Messaging 字幕同步](docs/topics/native-messaging.md) · [构建产物与分发](docs/topics/release-and-distribution.md)
- 设计系统 [design.md](design.md) · 运行手册 [docs/run.md](docs/run.md) · 规范&术语 [docs/conventions.md](docs/conventions.md)
- 测试&验证 [docs/testing.md](docs/testing.md) · 需求 [docs/specs/](docs/specs/) · 计划 [docs/plans/](docs/plans/) · 决策 [docs/decisions/](docs/decisions/)
