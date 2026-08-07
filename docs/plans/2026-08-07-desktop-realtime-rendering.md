# Desktop 实时字幕低延迟与 React Compiler — 实施计划

- 日期：2026-08-07
- 状态：已实施，待 DEV 真链路性能回归
- 影响模块：Extension、ListenUp Desktop、Native Messaging 专题

## 方案概述

把播放中的播放器采样和 Native cursor 上限从 250ms 收紧到 100ms，同时保留字幕索引变化、
seek、播放 / 暂停等关键事件立即发送。Desktop 将高频 cursor 与低频 viewer/session 结构状态
分离，字幕列表只在当前字幕或已播放边界变化时重渲染，时间标签只按整秒变化；在此基础上仅为
Desktop 接入官方稳定版 React Compiler，自动缓存其余稳定 JSX 和计算。

不采用 Million.js：当前发布与 React 适配停留在 React 18 时代，且额外 reconciler 不适合
HeroUI / React Aria / virtua 组合。React Compiler 保留 React 19 原生运行模型，可渐进退出单个
不兼容组件。

## 涉及文件 / 模块

- `apps/extension/src/pages/content/lib/youtube-sdk/YouTubePlayerFacade.ts` — 播放时 100ms 主动采样，
  暂停 / detach 后停止，保留 media event 兜底。
- `apps/extension/src/pages/content/hooks/useNativeSubtitleBridge.ts`、
  `nativeCursorScheduler.test.ts` — cursor 100ms 上限与关键事件立即发送回归。
- `apps/listenup-desktop/src/App.tsx` — cursor 独立状态、稳定 primitive props、整秒时间显示与低频
  字幕 presentation。
- `apps/listenup-desktop/src/SubtitleList.tsx` — 隔离并 memo 化虚拟字幕列表和行。
- `apps/listenup-desktop/src/subtitleCursor.ts`、测试 — 原语索引直用、译文时间映射和已播放边界。
- `apps/listenup-desktop/vite.config.ts`、`package.json`、`pnpm-lock.yaml` — 精确锁定并启用官方
  React Compiler。
- 模块文档、Native Messaging 专题与测试清单 — 同步 100ms 时序和渲染边界。

## 任务拆解

1. [x] 写纯函数字幕 cursor selector 及测试，覆盖实时原语索引、译文映射、间隙和结束状态。
2. [x] 从 viewer 中拆出高频 cursor 更新；snapshot / 主动选视频时原子切换对应 cursor。
3. [x] 抽出 memo 化 SubtitleList / SubtitleRow；列表只接收 active / played 边界，不接收连续时间。
4. [x] 播放按钮只接收 paused / disabled 等稳定 primitive；时间标签只接收取整秒数。
5. [x] Extension 播放中以 100ms 采样 currentTime，暂停 / detach 清理 timer；seek / 索引变化仍立即发送。
6. [x] Desktop 精确安装 React Compiler，并在 Vite React Babel pipeline 首位启用。
7. [x] 更新文件头、模块文档、专题与测试手册。
8. [ ] 运行 Extension / Desktop tests、两端 build、docs sensor，并用 DEV 真链路回归延迟。

## 风险 / 注意

- 100ms cursor 只能在视频播放时产生；暂停后必须零轮询，避免后台长期唤醒。
- `timeupdate` 仍作为浏览器节流或 timer 被挂起时的兜底，不能完全删除。
- 原语模式只有在 display blocks 确认来自当前 live session 时才能直接采用 `currentIndex`；译文或
  SQLite fallback 必须按时间映射。
- React Compiler 不能替代状态边界设计；禁止用 `startTransition` / `useDeferredValue` 延后实时高亮。
- `virtua` 继续是唯一列表虚拟化层；不引入第二套 VDOM 或列表引擎。
- Compiler 锁定精确版本，升级必须重新跑生产构建和 Desktop 交互回归。

## 验证方式

```bash
pnpm --filter @listenup/extension test
pnpm --filter @listenup/desktop test
pnpm build:extension:native-demo
pnpm --filter @listenup/desktop build
node scripts/check-docs.mjs
```

DEV 真链路验证正常播放、字幕间隙、倍速、暂停 / 恢复和连续 seek；用 cursor `sentAt` 与 React
Profiler 区分传输和 commit 时间。目标是普通字幕切换多数低于 100ms、P95 约 150ms，seek 低于
100ms；若真实 YouTube / WebView 调度限制导致目标不可达，记录实测而不是虚报。

## 执行记录

- `pnpm --filter @listenup/desktop test`：10/10 通过；覆盖 live index、紧邻当前项的 played 边界、
  `-1`、译文映射、重叠、结束状态与既有 UI / appMode 棘轮。
- `pnpm --filter @listenup/extension test`：22/22 通过；新增 100ms playback clock 启停测试，
  既有 cursor force / dispose 测试通过。
- Desktop production build 通过，产物确认包含 `react.memo_cache_sentinel`；单 chunk 534.64 kB
  （gzip 172.33 kB），延续既有大 chunk warning。
- Extension production 与 DEV Native build 均通过；DEV 产物已刷新到 `dist_chrome_dev/`。
- `node scripts/check-docs.mjs` 与 `git diff --check` 通过。
- Desktop DEV 已用新 Vite Compiler 配置启动；真实 YouTube 延迟和 Profiler commit 等用户 Reload
  Development Extension 后完成，因此任务 8 暂不虚假勾选。

## 提交拆分

1. `docs(desktop): plan realtime subtitle rendering`
2. `perf(extension): reduce native cursor latency`
3. `perf(desktop): isolate realtime subtitle rendering`
4. `build(desktop): enable React Compiler`
5. `docs(desktop): document realtime rendering pipeline`
