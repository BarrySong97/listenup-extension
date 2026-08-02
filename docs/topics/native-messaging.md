# Native Messaging 字幕同步

## 这是什么 / 为什么单独成篇

一条横跨三个进程边界的链路：YouTube 页面里的**内容脚本** → 扩展的 **service worker** → Chrome 拉起的**桥接进程** → **GUI 窗口**。任何一端单独看都解释不了这条链路的时序和降级行为，所以拿出来单独写。

## 涉及的模块 / 文件

| 位置 | 关系 |
|---|---|
| `apps/extension/src/shared/nativeSubtitleProtocol.ts` | **消息契约的唯一权威**，两端都从这里对齐；host 名与深链接按环境切换 |
| `apps/extension/src/pages/content/hooks/useNativeSubtitleBridge.ts` | 内容脚本侧发送 session / cursor |
| `apps/extension/src/pages/background/index.ts` | 补 `tabId`、懒连接 native host |
| `apps/extension/manifest.json` / `manifest.dev.json` | 两套环境都声明 `nativeMessaging`，功能一致 |
| `apps/listenup-desktop/src-tauri/src/lib.rs` | 桥接模式、socket 服务、活跃 session 状态机 |
| `apps/listenup-desktop/src-tauri/src/database/` | verified ready 原字幕的 SQLite revision 写入 |
| `config/listenup-environments.json` | Extension ID / Host / bundle / scheme 的唯一环境矩阵 |
| `apps/listenup-desktop/scripts/install-host.mjs` | 自动注册之外的手动修复工具 |

## 链路

```text
YouTube content script
  → extension service worker
  → chrome.runtime.connectNative()
  → 桥接进程（同一个二进制，无窗口，stdin 读长度前缀 JSON）
  → Unix socket (~/Library/Application Support/com.listenup.desktop[.dev]/bridge.sock)
  → GUI 实例（ready session 先写 listenup.sqlite，再发 Tauri event）
  → React 实时状态 + React Query 持久字幕视图
```

## 消息与身份状态

- **session** —— 一次字幕快照（videoId + 标题 + 身份状态 + 全量字幕）。协议 v3 的
  `identityStatus` 为 `pending | verified | failed`；只有 verified session 可以携带
  ready / empty 结果和字幕。ready track 还带 `languageCode`、`displayName`、`kind`、
  `vssId` 和 `isDefault`，用于建立不会跨语言覆盖的持久轨道身份。
  Extension 在发送前以 player response 中 `audioIsDefault=true` 的原始音轨语言选字幕；
  原始音轨信号缺失时才回退 YouTube 默认字幕与首轨，当前自动配音不会改变入库原语。
- **cursor** —— 播放游标。播放期间**最多 250ms 一次**；当前字幕索引变化则立即发。

background 为每条消息补 `tabId`，并且**只在 session 到达时才懒连接**当前构建对应的 Host——所以没有字幕的页面不会白白拉起进程。

## 正式 / DEV 隔离

| | production | development |
|---|---|---|
| Extension ID | `nocahdalbgboblhbjkacpneakljldfjh` | `gbnneflaaakigllkomehhhaianjebljf` |
| Native Host | `com.listenup.desktop` | `com.listenup.desktop.dev` |
| Desktop bundle | `com.listenup.desktop` | `com.listenup.desktop.dev` |
| Deep link | `listenup://open` | `listenup-dev://open` |
| Socket 根目录 | `com.listenup.desktop` | `com.listenup.desktop.dev` |

Chrome profile 能隔离两套扩展安装，但 Native Host manifest 是同一 macOS 用户级别共享的；真正防止串线的是不同 Host 名和每份 manifest 中唯一的 `allowed_origins`。

## 降级行为（这条链路的设计核心）

- **GUI 没开** → 桥接进程缓存最新 session、丢弃 cursor。GUI 打开后下一帧到来时自动连接并先补发缓存的 session。**播放视频永远不会自动弹出窗口。**
- **Host 没装 / 连接断开** → 扩展字幕面板完全不受影响。这是硬要求。
- **一个 YouTube 视频播放** → 自动跟随；即使身份还在 pending，也只显示 loading，不显示旧字幕。
- **多个 YouTube 视频播放** → Desktop 显示 verified 候选供用户选择。选择保持锁定，
  第三个视频开始播放也不抢占；所选视频停止后，剩一个自动跟随，仍有多个则重新选择。
  暂停和广告中的 session 不算播放候选，不提供常驻列表入口。
- **verified + ready + 非空 session** → GUI 在发 UI snapshot 前事务写入 SQLite；其他状态和
  cursor 不写。CLI 改译文后不走这条 socket，也不发事件；Desktop 重新聚焦时自行查询。

## Host 自动注册

Desktop GUI 每次启动都会按编译环境重写自己的 manifest 与 wrapper。这样 `.app` 被移动到 Applications 后，manifest 中的绝对可执行路径也会自动修复。注册失败只记 stderr，不阻止字幕窗口启动。

## 红线

- production 与 DEV 都必须声明 `nativeMessaging`，不能用删生产权限的方式换审核通过
- 两套 Host 的 `allowed_origins` 只能包含各自固定 Extension ID
- 桥接模式的 **stdout 专供 Native Messaging 协议**，诊断只能写 stderr
- 改 `nativeSubtitleProtocol.ts` 的字段必须两端同步改
- v3 原语轨身份字段不可删除；默认选轨不得恢复固定英语、当前配音或字幕首项优先

见 [ADR-0003](../decisions/0003-native-messaging-single-binary.md) 与
[ADR-0007](../decisions/0007-desktop-owned-video-session-selection.md)。

## 联调步骤（dev 环境）

1. 构建两端：

   ```bash
   pnpm build:extension:native-demo
   pnpm build:desktop:dev
   ```

2. `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist_chrome_dev/`

3. 启动一次 `ListenUp Desktop DEV.app`，它会自动注册 DEV Host；需要手动修复时运行：

   ```bash
   pnpm install:desktop-host -- --dev
   ```

   production 去掉 `--dev`，正式 Extension ID 不允许临时覆盖。

4. Desktop 首次启动还会让 LaunchServices 注册 `listenup-dev://` scheme。之后从扩展 popup 点 "Open ListenUp Desktop" 即可。

5. Reload 扩展，打开带字幕的 YouTube `/watch` 页面。

6. 日语视频确认 Desktop track/SQLite 原语是日语；多配音英语视频即使葡萄牙语字幕排第一，
   也必须选择 `audioIsDefault` 对应的英语。再用 `listenup
   subtitle get <video-id> --env dev --json` 验证 revision 和 segment IDs。

卸载（dev 加 `-- --dev`）：

```bash
pnpm uninstall:desktop-host
pnpm uninstall:desktop-host -- --dev
```

## 排查

- Host manifest 位置：`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.listenup.desktop[.dev].json`
- Desktop 自动注册会生成可执行 wrapper，并把 Host 启动记录写进 `~/Library/Logs/ListenUp Desktop[ DEV].log`——Chrome 拉不起 Host 时先看这个文件
- 深链接打不开 app：确认该 app 已手动启动过至少一次（LaunchServices 注册）
- 窗口连上但没字幕：先确认扩展面板自己有字幕，再看是不是 session 还没发（切一次视频会强制重发）
- 多视频没有出现候选：pending session 不可选择，先确认每个页面都完成 videoId 三重校验

## 相关

- [extension 模块](../modules/extension/README.md) · [listenup-desktop 模块](../modules/listenup-desktop/README.md)
