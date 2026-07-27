# 0003. 同一个二进制承担 GUI 与桥接两种模式，中间用 Unix socket 解耦

- 状态：已采纳
- 日期：2026-07-25（回填历史决策）

## 背景

Chrome Native Messaging 的模型是：Chrome 需要时**自己 fork 一个进程**，用 stdin/stdout 跟它说话。这与"用户自己打开一个 GUI 窗口"天然冲突：

- 如果 host 就是 GUI，用户一播视频 Chrome 就会弹出一个窗口，无法接受
- 如果 host 是独立的第二个二进制，要多打一份包、多签一次名、还要自己解决它和 GUI 的通信

同时还有硬约束：Native Messaging 用 stdout 传长度前缀 JSON 帧，任何多余的 stdout 输出都会破坏协议。

## 决策

1. 一个二进制，`run()` 开头按启动参数分叉：参数含 `chrome-extension://` → **桥接模式**（无窗口，stdin → NDJSON → Unix socket）；否则 → **GUI 模式**（监听同一个 socket）
2. socket 路径按 bundle id 派生：`~/Library/Application Support/<bundle-id>/bridge.sock`
3. GUI 未运行时，桥接进程缓存最新 session、丢弃 cursor；GUI 上线后下一帧到来时自动连上并补发缓存
4. 桥接模式下 **stdout 只属于协议**，诊断一律写 stderr
5. 正式与 DEV 扩展都把 `nativeMessaging` 作为必需权限，功能一致；环境隔离由不同 Extension ID / Host 名完成
6. GUI 每次启动都幂等注册本环境 Host manifest；manifest 只允许本环境 Extension ID

## 理由

- 单二进制 = 单份签名、单份公证、单份分发，Tauri 打包流程不用改
- socket 把"Chrome 的进程生命周期"和"用户的窗口生命周期"彻底解耦：两者谁先谁后、谁挂了都不影响另一方
- 缓存 session 而丢弃 cursor 是刻意的：session 是"补上就能用"的状态快照，cursor 是"过期即无意义"的瞬时值
- Native Messaging 是 ListenUp 正式 Desktop 同步功能的必要能力，不能为通过审核而从生产包删除

## 后果

- 好处：播放视频永远不会自动弹窗；Host 缺失或断开完全不影响扩展面板
- 好处：正式 Desktop 拖入 Applications 后启动一次即可注册 Host，无需用户运行仓库脚本
- 好处：多标签页的活跃 session 选择逻辑集中在 Rust 一处，可单测（已覆盖分片帧、超大帧、非法 JSON 不丢帧边界、暂停的后台 session 不抢焦点）
- 代价：调试变复杂——问题可能在四个进程边界的任何一处，排查顺序见 [Native Messaging 专题](../topics/native-messaging.md)
- 代价：**在桥接代码路径里写一句 `println!` 就会静默弄坏整条链路**。这是本仓库最隐蔽的坑，已列为红线
- 代价：仅限 Unix（macOS）。要上 Windows 得换命名管道
