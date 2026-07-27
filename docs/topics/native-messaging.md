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
| `config/listenup-environments.json` | Extension ID / Host / bundle / scheme 的唯一环境矩阵 |
| `apps/listenup-desktop/scripts/install-host.mjs` | 自动注册之外的手动修复工具 |

## 链路

```text
YouTube content script
  → extension service worker
  → chrome.runtime.connectNative()
  → 桥接进程（同一个二进制，无窗口，stdin 读长度前缀 JSON）
  → Unix socket (~/Library/Application Support/com.listenup.desktop[.dev]/bridge.sock)
  → GUI 实例（Tauri event）
  → React 字幕列表
```

## 两种消息

- **session** —— 一次字幕快照（videoId + 标题 + 全量字幕）。每个视频的加载状态或字幕结果变化时发一次。
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
- **多个 YouTube 标签页** → 窗口跟随最近产生"播放中"游标的标签页；暂停中的后台 session 不抢焦点（Rust 侧有单测覆盖）。

## Host 自动注册

Desktop GUI 每次启动都会按编译环境重写自己的 manifest 与 wrapper。这样 `.app` 被移动到 Applications 后，manifest 中的绝对可执行路径也会自动修复。注册失败只记 stderr，不阻止字幕窗口启动。

## 红线

- production 与 DEV 都必须声明 `nativeMessaging`，不能用删生产权限的方式换审核通过
- 两套 Host 的 `allowed_origins` 只能包含各自固定 Extension ID
- 桥接模式的 **stdout 专供 Native Messaging 协议**，诊断只能写 stderr
- 改 `nativeSubtitleProtocol.ts` 的字段必须两端同步改

见 [ADR-0003](../decisions/0003-native-messaging-single-binary.md)。

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

## 相关

- [extension 模块](../modules/extension/README.md) · [listenup-desktop 模块](../modules/listenup-desktop/README.md)
