# 0018. Desktop 对商店中的上一版 Native Messaging 协议保持向后兼容

- 状态：已采纳
- 日期：2026-08-14
- 部分取代：[ADR-0009](0009-native-messaging-bidirectional-playback-control.md)“Extension 与 Desktop 必须配套升级”的后果

## 背景

Desktop 通过 GitHub Release 和应用内 updater 发布，Chrome Extension 通过商店审核发布，两者不可能
保证原子升级。Desktop 0.5.1 使用 Native 协议 v5，而线上商店 Extension 1.5.2 仍为 v4：Native
Host socket 可以正常建立，因此 UI 显示“已连接”，但 Desktop 拒绝 v4 session，并在反序列化缺少
`playbackEpoch` 的 v4 cursor 时持续丢帧，最终没有字幕。

## 决策

1. Desktop 接受当前协议 v5 和线上商店仍可能发送的上一版 v4；未知或更旧版本继续拒绝。
2. v4 cursor 缺少 `playbackEpoch` 时，Desktop 按同一 bridge/session/video 的真实暂停→播放边界
   合成单调 epoch：首次播放和暂停后重播递增，周期 cursor、seek 和广告不递增。
3. session 保留其来源协议版本；Desktop 反向播放 / 暂停 / seek 命令必须使用该版本，保证 v4
   Extension 能校验并返回同版本 result，bridge/session/video 的精确路由不变。
4. v4 verified ready session 与 v5 一样可以显示和持久化；Embedded 退出屏障继续消费适配后的
   epoch，不能为了兼容而绕过旧播放流隔离。
5. 自动回归必须包含商店 Extension 1.5.2 的真实 v4 cursor 形状（缺少 `playbackEpoch`）、v4 ready
   session、epoch 合成和按来源版本回发命令。以后升级 Native 协议时，发布 Desktop 前必须核对
   Chrome 商店当前线上版本并保留必要的兼容适配。

## 理由

- 两条独立发布渠道天然存在版本窗口，要求配套升级会把正常的发布时差变成生产中断。
- 在 Desktop 适配旧消息可以通过 updater 快速覆盖已安装用户，也不需要削弱 v5 的身份和退出屏障。
- 使用来源协议回发命令，保留双向控制能力，避免出现“字幕恢复但按钮全部超时”的半兼容状态。

## 后果

- Rust 的 `NativeMessage` 对 v4 cursor 的 epoch 字段使用受限默认值，但只有明确版本 4 才会合成；
  v5 缺字段虽然能反序列化，后续协议测试仍必须拒绝或识别为无效，不能静默降级成 v4。
- `SessionState.protocolVersion` 只用于 Rust 内部路由，不暴露给 React viewer。
- ADR-0009 的 bridgeId + tabId + sessionId + videoId 全链校验、两秒超时与不广播红线保持不变。
