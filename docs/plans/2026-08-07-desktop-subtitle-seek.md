# Desktop 点击字幕跳转视频 — 实施计划

- 状态：已实施，待 DEV 真链路手工回归
- 日期：2026-08-07
- 影响模块：listenup-desktop、extension、Native Messaging

## 目标

在 Desktop 列表形态中，点击任意原语、译文或双语字幕块，都让当前绑定的 YouTube 视频跳转到
该块的 `startTime`。键盘 Enter / Space 具备相同行为；跳转不改变原有播放 / 暂停状态。

Desktop 不乐观修改时间、红点或已播放状态。命令成功只代表 YouTube 播放器接受 seek，最终 UI
仍以 Extension 随 `seeking` / `seeked` 立即返回的真实 cursor 为准。

## 现状与边界

- Extension 的 `YouTubePlayerFacade` 已有 `seekTo(time)`，但 Native Messaging v4 的
  `playbackCommand` 只接受 `play | pause`。
- Rust 已有按 `bridgeId + tabId + sessionId + videoId + commandId` 精确路由、结果校验和两秒
  超时状态机，应复用，不新增广播或第二条控制通道。
- Desktop 字幕列表是 memo + virtua 性能边界，不能把完整 cursor 或连续 currentTime 传进每一行。
- 译文 / 双语可能按 AI 语义重新分块，点击时使用当前显示块自身的 `startTime`；SQLite 冷启动但
  没有 live session / cursor 时不允许 seek。

## 方案

1. 保留协议版本 v4，给 `playbackCommand.action` 增加 `seek`，并只在 seek 时携带有限且非负的
   `seekTime`。这是向后兼容的加法：旧 Desktop 不发送 seek，新 Extension 仍支持 play/pause。
2. Extension 的协议守卫强制校验 action 与 `seekTime` 的组合；content 继续校验 session、video、
   tab 路由和广告态，然后调用真实播放器 `seekTo()`。无播放器或非法时间返回失败结果。
3. Rust 的 `PlaybackAction` 增加 Seek，命令携带可选 `seek_time`；Tauri command 在写入 bridge 前
   再校验有限、非负以及 action/参数配对，防止 GUI 或序列化边界绕过 TypeScript。
4. Desktop 继续复用统一 pending/error 反馈。SubtitleList 只新增稳定的 `onSeek(startTime)` 和
   disabled primitive；每个 SubtitleRow 用 HeroUI `DesktopButton` 承载语义与键盘操作，视觉仍
   保留现有三列布局、红点和高亮，仅增加可点击 cursor、hover 与 focus-visible 反馈。
5. seek 不自动 play、不自动 pause、不本地设置 activeIndex；真实 `seeking/seeked` cursor 到达后
   才更新时间、红点和自动滚动位置。

## 自动化验证

- Extension 协议测试：接受合法 seek；拒绝缺少、负数、NaN / Infinity 的 `seekTime`，并继续接受
  play / pause。
- Desktop Rust 测试：合法 seek 正确序列化；非法 action/参数组合在发送前失败；现有 bridge、
  session、result 身份测试继续通过。
- Desktop 前端测试 / build：HeroUI 基础控件守卫继续通过，React Compiler 与 SubtitleList memo
  边界不回退。
- 运行 Extension tests/build、Desktop tests/build、`cargo test`、`node scripts/check-docs.mjs`
  与 `git diff --check`。

## 手工回归

1. 播放中点击当前句之前 / 之后的原语字幕，视频跳到块起点并保持播放。
2. 暂停时点击字幕，视频跳到块起点但仍保持暂停。
3. 译文与双语模式点击重组语义块，跳到该显示块的起点。
4. Enter / Space 可触发；hover / focus-visible 清晰，列表滚动与行 memo 无明显回退。
5. 广告、Host 断开、无 cursor、多视频未选择、命令 pending 时字幕行不可触发；错误可恢复。
6. 两个 Chrome Profile 同 tabId 时只控制当前 Desktop 所选 session；SPA 切视频后旧行不能 seek。

## 文档与决策同步

- 新增 ADR，记录 v4 反向控制从 play/pause 扩展到显式字幕 seek，同时保留精确路由与真实 cursor
  事实源。
- 更新 Desktop、Extension 与 Native Messaging 文档，移除“Desktop 不提供 seek”的旧边界。
- 更新 `docs/testing.md` 的 Native 手工回归清单。

## 提交拆分

1. `docs(desktop): plan subtitle seek control`
2. `feat(extension): accept native subtitle seek commands`
3. `feat(desktop): seek video from subtitle rows`
4. `docs(desktop): document subtitle seek control`

## 执行记录

- Extension 协议与 content handler 已支持带有限非负 `seekTime` 的 seek；23/23 Node tests 通过。
- Desktop Rust 已增加双边参数校验与原 bridge 精确路由；25/25 Cargo tests 通过。
- Desktop 字幕行已改为 HeroUI Button，具备整行 hover、focus-visible、Enter / Space 与 disabled
  语义；10/10 Desktop tests 通过。
- Desktop production、Extension production 与 Development Extension 构建通过；Desktop 延续
  既有 500 kB 单 chunk warning。
- Desktop DEV 已由 Rust watcher 重启并加载新二进制；`dist_chrome_dev/` 已刷新，等待用户 Reload
  Development Extension 后验证播放中 / 暂停中字幕点击与真实 cursor 收敛。
- `node scripts/check-docs.mjs` 与 `git diff --check` 通过。
