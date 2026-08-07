# Desktop seek 游标同步 — 设计

- 日期：2026-08-07
- 状态：已批准
- Plane：LISTENUP-3
- 后续依赖：LISTENUP-1 的播放控制以本设计提供的可靠 cursor 回传为前提

## 目标

修复用户拖动或点击 YouTube 进度条后 Desktop 仍显示旧时间、旧字幕高亮或旧滚动位置的问题。
播放中和暂停时 seek 都必须在一次普通 cursor 节流窗口内同步；seek 到无字幕空隙时必须清除旧高亮。

正常播放仍按最多约 250ms 一次发送 cursor，不能为了修复 seek 改成无节制发送。

## 当前链路与问题边界

当前播放状态经过以下路径：

```text
HTMLVideoElement events
→ YouTubePlayerFacade
→ Subtitles / useSubtitleSync
→ useNativeSubtitleBridge
→ Extension service worker
→ Native Host bridge
→ Desktop HostStore
→ Desktop React UI
```

`YouTubePlayerFacade` 已监听 `seeking`、`seeked` 和 `timeupdate`，但上层回调只收到归一化后的
播放器状态，事件原因在进入 React 前丢失。`useNativeSubtitleBridge` 因而只能根据时间和字幕索引
变化决定是否发送，无法明确区分普通播放 tick 与用户 seek。

实现时先用真实 YouTube 页面确认断点位于哪一层，再按本设计修复；不能仅凭静态阅读假定
`seeking` 或 `seeked` 一定缺失。

## 设计

### 保留播放器事件原因

`YouTubePlayerFacade` 的状态订阅对外提供归一化状态和事件原因。原因至少覆盖：

- `initial`
- `timeupdate`
- `play`
- `pause`
- `seeking`
- `seeked`
- `loadedmetadata`
- `durationchange`
- `volumechange`

Facade 维护一次 seek 手势的内部状态：第一次 `seeking` 标记手势开始，`seeked` 标记手势结束。
同一手势最多产生一次开始强制同步和一次最终强制同步；拖动过程中的普通 `timeupdate` 继续由
正常节流处理。

### 独立 cursor 调度器

把 `useNativeSubtitleBridge` 中的节流逻辑提取成可确定性测试的 cursor 调度单元。它接收完整的
最新 cursor 和 `force` 标记：

- 普通更新：250ms 窗口内只保留最新 cursor。
- 字幕索引变化：保持现有立即发送行为。
- seek 开始或结束：取消待发送定时器并立即发送最新 cursor。
- seek 到无字幕区：发送 `currentIndex = -1`，Desktop 据此清除旧高亮。
- 组件卸载或 session 切换：取消旧 session 的定时器和缓存，不能向新视频发送旧 cursor。

调度器不负责读取 DOM、React 状态或调用 Chrome API，只负责决定何时发送哪一条 cursor，便于
使用 fake timers 覆盖时序。

### Desktop 消费规则

Desktop 继续只接受属于 active session 的 cursor。收到 seek cursor 后：

- 时间显示立即采用新的 `currentTime`。
- 根据 Desktop 当前显示的原语/译文语义块重新计算索引。
- 有匹配项时居中滚动；没有匹配项时清除旧高亮，不强行滚到相邻字幕。
- session 选择和多标签页仲裁规则保持不变。

本修复不改变 Native Messaging v3 消息字段，也不增加 Desktop 反向控制能力。

## 错误与降级

- Host 未安装或断开时，Extension 字幕抓取和页面行为不受影响。
- seek 事件异常缺少结束事件时，开始事件的强制 cursor 仍能更新 Desktop；后续 `timeupdate` 继续收敛到真实时间。
- 无可用 video 元素时不制造伪 cursor。
- SPA 切视频后，旧 session 的延迟 cursor 必须被 session/video 校验丢弃。

## 验证

自动验证：

- cursor 调度器：普通 250ms 节流只发最新值。
- cursor 调度器：seek 开始/结束强制发送，单次手势不会随拖动产生消息风暴。
- cursor 调度器：seek 到空隙发送 `currentIndex = -1`。
- cursor 调度器：session 切换和卸载取消旧定时器。
- 现有 Rust HostStore 测试继续覆盖非 active session cursor 不更新 UI。

真实 YouTube 回归：

- 播放中和暂停时分别向前、向后 seek。
- seek 到同一字幕块、跨多个字幕块和无字幕空隙。
- 连续多次拖动进度条后 Desktop 始终落到最终时间。
- 多标签页锁定和 SPA 切视频时不更新错误 session。

最低命令：

```bash
pnpm --filter @listenup/extension test
pnpm build:extension
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

## 文档与交付

- 更新涉及源码的 AI 文件头。
- 更新 `docs/topics/native-messaging.md` 和 `docs/testing.md` 的 seek 时序说明。
- 作为独立 `fix(extension)` 提交交付，不与双向播放协议或菜单栏形态混合。
