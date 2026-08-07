# 0009. Native Messaging 升级为按 bridge/session 精确路由的双向播放控制

- 状态：已采纳
- 日期：2026-08-07

## 背景

Desktop 原有链路只接收 Extension 的 session / cursor，无法控制 YouTube。Native Messaging
Host 由不同 Chrome Profile 分别拉起多个桥接进程；tabId 只在单个浏览器实例内有意义，两个
Profile 可能产生相同 tabId。若 GUI 广播播放命令或只按 tabId 路由，可能控制错误的视频。
同时 Native Host stdout 已被 Chrome 长度帧协议独占，反向通信不能另开非协议输出。

## 决策

1. Native Messaging 协议升至 v4，增加 `playbackCommand` / `playbackCommandResult`；只开放
   `play | pause`，每条命令有唯一 commandId 和完整 tab/session/video/action 身份。
2. GUI 接收每条 Unix socket 时分配 bridgeId，并把每个 session 绑定到来源 bridge。反向命令
   只写该 bridge，background 再只发给消息中的 tabId；content 最后校验当前 session、video、
   广告态后才调用 `YouTubePlayerFacade.controlPlayback`。
3. result 必须沿同一 bridge 返回。Rust 对 bridgeId、tabId、sessionId、videoId、action 和
   commandId 做全量匹配；bridge 断开立即失败，正常等待最多两秒，绝不改投其他来源。
4. Desktop 不乐观改播放状态。按钮 pending 与错误属于命令反馈，播放 / 暂停图标只由随后
   Extension 发回的真实 cursor 决定。
5. 桥接进程改为全双工：stdin 仍读 Chrome 长度帧，stdout 只写 GUI 命令的 Chrome 长度帧；
   所有诊断继续只写 stderr。

## 理由

- bridgeId 解决跨 Profile tabId 冲突，session/video 身份解决 SPA 切换和状态过期；分层校验让
  任一边界都不能把旧命令误用到新视频。
- 复用同一 Native port 和 Unix socket，保留现有单二进制、环境隔离与 Host 自动注册架构。
- 非乐观状态让 UI 与真实播放器保持同一个事实来源，超时或标签页关闭不会制造假状态。
- 第一版只开放播放 / 暂停，把权限和失败面控制在用户当前明确需要的范围。

## 后果

- Extension 与 Desktop 必须配套升级到 v4；旧版消息因版本不匹配被拒绝。
- 每条 GUI socket 需要保留可写句柄，Rust 需要 pending command 表与超时/断开清理。
- GUI 未运行时仍不会弹窗，也没有反向命令；Host 故障不能影响扩展内字幕功能。
- 自动化棘轮由 `nativeSubtitleProtocol.test.ts`、Rust bridge 路由/result 身份测试和环境
  identifier sensor 承担；禁止退回广播或只按 tabId 路由。
