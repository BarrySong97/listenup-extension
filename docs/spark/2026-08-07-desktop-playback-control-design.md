# Desktop 控制 YouTube 播放与暂停 — 设计

- 日期：2026-08-07
- 状态：已批准
- Plane：LISTENUP-1
- 前置：LISTENUP-3 的 seek/cursor 同步已完成并验证

## 目标

在 Desktop 列表、影院和菜单栏列表面板中控制当前 active YouTube session 的播放与暂停。
功能必须支持多标签页、多 Chrome Profile、production/DEV 环境隔离，并在断连、广告或 session
过期时安全失败。

本期不包含 seek、音量、倍速、上一句、下一句或媒体键集成。

## 方案概述

把现有单向 Native Messaging v3 升级为 v4 双向协议，复用现有 Native Host 进程和 Unix socket：

```text
Desktop UI
→ GUI socket server
→ active session 所属 Native Host bridge
→ Native Messaging stdout
→ Extension service worker
→ 指定 YouTube tab
→ 内容脚本校验 session/video
→ YouTubePlayerFacade.play()/pause()
→ command result + cursor 回传 Desktop
```

不增加本地 HTTP 服务、第二个 helper 进程或轮询通道。

## 协议

Desktop 发出的命令使用明确动作，不使用会受竞态影响的 `toggle`：

```ts
interface PlaybackCommand {
  kind: "playbackCommand";
  version: 4;
  commandId: string;
  sessionId: string;
  videoId: string;
  action: "play" | "pause";
}
```

Extension 返回执行结果：

```ts
interface PlaybackCommandResult {
  kind: "playbackCommandResult";
  version: 4;
  commandId: string;
  sessionId: string;
  videoId: string;
  ok: boolean;
  error?: string;
}
```

现有 `session`、`cursor`、`end` 消息同步升级为 v4，但业务字段保持不变。协议类型继续以
`apps/extension/src/shared/nativeSubtitleProtocol.ts` 为唯一权威，Rust serde 类型必须同步。

## bridge 与路由归属

GUI socket server 为每个 Native Host socket 连接生成进程内 `bridgeId`，并保存可写连接句柄。
HostStore 接收 session/cursor/end 时同时记录来源 `bridgeId`；`bridgeId` 是 GUI 内部路由信息，
不写入跨进程公共 payload。

控制 active session 时必须同时命中：

- active `sessionId`
- 对应 `videoId`
- session 所属 `bridgeId`
- 该 bridge 当前仍连接

不能只按 `tabId` 路由，因为不同 Chrome Profile 可能产生相同 tabId。bridge 断开后立即从可写
注册表移除；旧 session 可以继续显示最后字幕，但不再允许控制。

桥接模式新增一条从 Unix socket 读取命令的循环，把 NDJSON 命令转换为 Chrome Native
Messaging 长度帧写入 stdout。stdout 仍完全专供协议，所有诊断继续写 stderr。

## Extension 执行链路

Service Worker 监听 Native Port 的 host message，验证为 v4 playback command 后，只通过
`chrome.tabs.sendMessage` 发给命令绑定的 tab。

内容脚本在当前 `useNativeSubtitleBridge` session 生命周期内处理命令，并再次校验：

- `sessionId` 与当前 hook session 相同。
- `videoId` 与当前页面和播放器 session 相同。
- 当前不是广告。
- video 元素仍可用。
- action 仅为 `play` 或 `pause`。

校验通过后调用既有 `YouTubePlayerFacade.play()` 或 `pause()`。执行结果沿原链路返回 Native
Host stdin，再经对应 Unix socket 回到 GUI。`commandId` 用于关联响应并丢弃迟到结果。

## Desktop UI 与状态

- 列表 header、影院 hover 工具条和菜单栏列表面板使用同一个 PlaybackControl 组件。
- 图标和 `aria-label` 取自最新 cursor：暂停时显示“播放”，播放时显示“暂停”。
- command pending 时按钮禁用并显示处理中状态，防止重复命令。
- 不乐观修改 `isPaused`；command result 表示调用是否成功，最终播放状态仍以 cursor 为权威。
- 无 active session、bridge 断开、广告播放或已有命令 pending 时禁用按钮，并提供可理解的 title。

Desktop 的 Tauri command 在发送前验证 active session，写入对应 bridge 后等待 result，超时为
两秒。成功响应后 UI 等待 cursor 自然确认；失败或超时显示可恢复的短暂错误提示。

## 错误与安全边界

- session/video 不匹配：拒绝，不尝试寻找或控制其他视频。
- bridge 断开：立即失败，不向其他 bridge 重试。
- tab 已关闭或内容脚本不可达：返回明确错误。
- `video.play()` 被浏览器策略拒绝：返回失败，保留真实 paused 状态。
- 广告期间：拒绝控制，不能操作广告 video 元素。
- Host 不存在：Extension 页面字幕功能保持可用。
- production 与 DEV 继续使用不同 Extension ID、Host、bundle、socket 和配置目录。

## 验证

自动验证：

- TypeScript 协议守卫接受合法 v4 command/result，拒绝未知 action 和错版本。
- 内容脚本校验覆盖 session/video 不匹配、广告和播放器缺失。
- Rust 覆盖 Native Messaging 长度帧双向读写。
- Rust 覆盖 session 到 bridge 的归属、断连、迟到响应和两秒超时。
- Rust 覆盖两个 bridge 使用相同 tabId 时仍只写入正确连接。

真实回归：

- Desktop 列表、影院和菜单栏列表面板分别播放/暂停。
- 命令成功后按钮状态由 cursor 确认。
- 多标签页选择锁定后只控制选中视频。
- 两个 Chrome Profile 同时运行且 tabId 可能重合时不串控。
- 广告、关闭 tab、断开 Host 和过期 session 均安全失败。
- production/DEV Desktop 与 Extension 交叉运行时不串线。

最低命令：

```bash
pnpm --filter @listenup/extension test
pnpm build:extension
pnpm build:extension:native-demo
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

## 文档与决策

- 新增 ADR，记录从单向字幕同步升级为双向、带 bridge 归属的播放命令协议。
- 更新 `docs/topics/native-messaging.md`、Extension/Desktop 模块文档和 `docs/testing.md`。
- 更新涉及源码的 AI 文件头。
- 作为独立 feature 提交交付，不与窗口形态改造混合。
