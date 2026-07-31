# 0007. Desktop 统一仲裁多视频字幕会话，字幕轨必须通过 videoId 三重校验

- 状态：已采纳
- 日期：2026-07-31

## 背景

YouTube 是 SPA。切换视频时，地址栏里的 `v` 会先变化，播放器内部
`playerResponse` 和字幕轨 URL 随后才更新。旧实现只按地址栏 videoId 建缓存键，
可能把上一视频的轨道与字幕写进新视频缓存；多个标签页同时播放时，Desktop
又会被最近一条 cursor 自动抢占，用户无法稳定指定字幕来源。

## 决策

1. Extension 只在以下三个 videoId 非空且完全一致时读取缓存、下载字幕、写缓存
   或发布 verified session：
   - 当前 YouTube session / URL videoId；
   - 产生轨道的 `playerResponse.videoDetails.videoId`；
   - 字幕轨 URL 查询参数 `v`。
2. SPA 切换后在约五秒内可中断重试。验证期间立即清空旧字幕并发布
   `identityStatus: pending`；超时发布 failed 和「视频切换尚未完成」。
3. Native Messaging 协议升至 v2，session 明确携带
   `pending | verified | failed` 身份状态。pending session 可以作为唯一播放项显示
   loading，但不能出现在用户候选列表。
4. 多视频仲裁只在 Desktop Rust `HostStore` 中执行：
   - 0 个播放 session：保留最后可显示 session；
   - 1 个播放 session：自动跟随；
   - 2 个及以上：若用户锁定仍在播放则保持，否则等待至少两个 verified 候选并要求选择；
   - 锁定 session 停止后，剩一个则自动跟随，仍有多个则重新选择。
5. React 只消费 Rust snapshot。冲突时显示不可关闭的全遮罩；footer 的 YouTube ID
   旁和影院 hover 工具条提供主动改选入口。

## 理由

- 地址栏身份不足以证明字幕来自当前视频，必须在数据进入缓存之前验证来源。
- 仲裁放在 Rust 可让 Native 消息、窗口重启补发和用户命令共享同一个状态机，
  避免 React 与桥接进程各自推断而产生竞态。
- 手动锁定比「最近播放抢占」更符合同时开多个学习视频的使用方式。

## 后果

- 协议 v1 与 v2 不兼容，Extension 与 Desktop 必须配套升级；版本不匹配的消息会被忽略。
- 字幕缓存升级到 v3，旧缓存自然失效，不做迁移。
- 切换视频期间可能短暂显示 loading 或「正在确认视频」，但不会展示上一视频字幕。
- 自动化棘轮由 `videoIdentity.test.ts` 和 Rust 多 session 状态机测试承担；修改校验或
  仲裁规则必须同步更新测试。
