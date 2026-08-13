# Desktop Embedded 视频可拖动悬浮字幕 — 实施计划

- 日期：2026-08-13
- 状态：待批准
- 关联设计：`docs/spark/2026-08-13-desktop-embedded-subtitle-overlay-design.md`
- Plane：LISTENUP-15

## 方案概述

在可信 `main` 的 `EmbeddedVideoPanel` 内把 ListenUp 字幕渲染为 YouTube iframe 的同级 Overlay，
不修改 loopback 包装页、不传输字幕到跨域 iframe。`App.tsx` 继续作为当前显示块与窗口模式事实源，
新增单一职责 Overlay 组件和纯坐标模块；开关从标题栏移到现有播放 / 暂停按钮旁，开启时复用已实现
的视频专注窗口尺寸能力，关闭或退出 Embedded 时恢复完整字幕列表与进入前尺寸。

## 涉及文件 / 模块

- `apps/listenup-desktop/src/App.tsx` — 悬浮模式状态、播放按钮旁入口、当前显示块传递、窗口恢复。
- `apps/listenup-desktop/src/EmbeddedVideoPanel.tsx` — iframe 与可信字幕 Overlay 的定位容器。
- `apps/listenup-desktop/src/EmbeddedSubtitleOverlay.tsx` — 字幕卡、独立手柄、Pointer Capture 与键盘移动。
- `apps/listenup-desktop/src/embeddedSubtitleOverlayPosition.ts` — 位置校验、归一化换算和边界 clamp 纯函数。
- `apps/listenup-desktop/src/embeddedSubtitleOverlayPosition.test.ts` — 尺寸变化、损坏偏好和四边约束测试。
- `apps/listenup-desktop/src/uiPrimitives.test.ts` — 入口位置、UI primitive 与 iframe 安全边界棘轮。
- `docs/decisions/` — 新 ADR，增量覆盖 ADR-0015 中“播放器未经覆盖”的旧表述。
- `docs/modules/listenup-desktop/README.md`、`docs/testing.md` — 实现说明与真实 DEV 回归清单。

## 任务拆解

1. [ ] 提取悬浮字幕位置纯函数，定义 v1 存储格式、默认位置、坐标往返与 clamp，并先补 Node tests。
2. [ ] 新增 `EmbeddedSubtitleOverlay`：原语 / 译文 / 双语卡片、独立手柄、Pointer Capture、键盘移动、
   ResizeObserver 和 pointer end 单次持久化回调。
3. [ ] 改造 `EmbeddedVideoPanel` 为 Overlay 的相对定位边界，保持 iframe、loading/error 与 YouTube
   控件路径不变，Overlay 根层只让字幕卡接收 pointer。
4. [ ] 在 `App.tsx` 将现有隐藏字幕入口移到 `PlaybackButton` 旁并升级为悬浮字幕开关；复用当前
   `displayBlocks` / cursor presentation，开启后隐藏列表与 Footer，关闭 / 退出时恢复尺寸。
5. [ ] 处理字幕间隙、loading/empty/error、缺译文引导、换链接保持开启和来源退出关闭等状态。
6. [ ] 增加 UI / 性能 / 安全棘轮，锁定有效 Iconify 图标、入口位置、无字幕 postMessage、无新增权限
   与 Overlay 不订阅连续 `currentTime`。
7. [ ] 新增 ADR，并同步 Desktop 模块文档、测试手册与相关文件头。
8. [ ] 跑 Desktop tests/build、环境 sensor、docs sensor 与 diff 检查，清零失败。
9. [ ] 构建并启动真实 DEV `.app`，回归拖动四边、文字选择、YouTube 控件、三种字幕模式、窗口缩放、
   换链接 / 重启位置记忆、关闭与退出恢复；保存截图上传 LISTENUP-15。
10. [ ] 提交实现与文档，回写 commit 和验证证据，并按真实验收结果更新 Plane 状态。

## 实施顺序与提交边界

1. `test(desktop): cover embedded subtitle overlay position`
2. `feat(desktop): add draggable embedded subtitle overlay`
3. `docs(desktop): document embedded subtitle overlay`

若代码与测试高度耦合，可以把前两项合为一个可独立回退的 Feature commit；文档与 ADR 仍必须在
最终交付前完成。不得把生成的 `dist/`、`.app` 或 `src-tauri/target/` 加入提交。

## 风险 / 注意

- Pointer 进入跨域 iframe 后普通 drag 会丢事件，必须由手柄在 pointer down 时取得 Pointer Capture，
  并在 up / cancel / unmount 时释放。
- Overlay 根层若接收 pointer 会让整个 YouTube 播放器失效；必须仅给字幕卡 / 手柄启用交互。
- 双语切换会改变卡片尺寸；位置必须基于可移动范围归一化，并在 ResizeObserver 后重新 clamp。
- 现有 React cursor 性能边界不可回退；Overlay 只消费 active block，不订阅每 100ms currentTime。
- 缺译文时不能因 `effectiveSubtitleMode` 回退而悄悄显示原文；继续使用明确的翻译缺失状态。
- DEV 启动 / bundle 会生成开发环境 `Info.plist`；提交前必须恢复 production 版本并清理 `.app`。
- ADR-0015 的播放 / 字幕隔离不变，但“未经覆盖的播放器”已不再准确，必须用新 ADR 明确受限例外。

## 自动验证

```bash
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
git diff --check
```

若只改 React / TypeScript，不要求全量 Rust tests；一旦环境 sensor、Tauri capability、窗口 command
或 Rust 边界发生变化，补跑：

```bash
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
```

## 真实 DEV 验收

使用带人工字幕与译文数据的 YouTube 链接，至少验证：

- 悬浮字幕开关只在 EmbeddedSource 出现且紧邻 ListenUp 播放按钮；
- 开启后只保留标题栏和视频，当前字幕 Overlay 可见，关闭后恢复完整列表及原尺寸；
- 原语、译文、双语、字幕间隙与缺译文反馈正确；
- 手柄可拖到四边且不越界，跨过 iframe 不丢拖动，正文仍可选择；
- 字幕卡之外的播放、进度条、音量、设置与全屏可用；
- 窗口缩放、换链接和重启后位置保持，来源退出后普通布局恢复；
- production frontend bundle 下连续播放无明显卡顿，Profiler 中工具栏与 Overlay 不持续 commit。

## 回写要求

完成后在 LISTENUP-15 评论中记录实现 commit、自动命令结果、真实 DEV 测试链接与截图。只有全部
验收通过才转 `Done`；若真实应用仍有回归缺口，保持 `In Progress` 并写清剩余项。
