# ListenUp Desktop

> 目的：验证 Chrome Extension 能通过 Native Messaging 把 YouTube 完整字幕和实时播放游标同步到独立的 Tauri 窗口。

## 架构

```text
YouTube content script
  -> extension service worker
  -> chrome.runtime.connectNative()
  -> 桥接进程（同一个二进制，无窗口，stdin 读长度前缀 JSON）
  -> Unix socket (~/Library/Application Support/com.listenup.desktop/bridge.sock)
  -> GUI 实例 (Tauri event)
  -> React subtitle list
```

同一个二进制有两种运行模式：

- **GUI 模式**（默认）：用户通过 popup 里的 `listenup://open` 深链接（或直接双击）打开；启动时在本地 Unix socket 上监听桥接连接。`listenup` scheme 通过 `src-tauri/Info.plist` 的 `CFBundleURLTypes` 注册，app 需先启动过一次让 LaunchServices 记录。
- **桥接模式**（启动参数含 `chrome-extension://`，即被 Chrome Native Messaging 拉起）：不创建窗口，把 stdin 的字幕帧按 NDJSON 转发到 socket。GUI 没开时缓存最新的 session 快照、丢弃 cursor；GUI 打开后下一帧到来时自动连接并先补发缓存的 session。因此**播放视频不会弹出窗口**，app 开着就自动连上。

stdout 专用于 Native Messaging 协议，诊断信息只能写 stderr。

## 窗口 UI

窗口是无边框透明窗口，macOS 上通过 `window-vibrancy`（`NSVisualEffectMaterial::HudWindow`）实现深色毛玻璃背景，需要 `tauri.conf.json` 的 `app.macOSPrivateApi: true` 和 tauri 的 `macos-private-api` feature，两处缺一会导致构建报错或背景不透明。

有两种形态，通过 header 按钮切换，模式和各自的窗口尺寸持久化在 `localStorage`：

- **列表模式**：顶部是 YouTube 标志 + 视频标题 + 连接/播放状态，下面是完整字幕列表（当前句红点高亮、自动居中滚动），底部是 videoId 和字幕条数。
- **影院模式**：整个窗口缩成一条电影式字幕条（只显示当前句，最多两行），可拖到浏览器视频画面上；hover 显示返回列表、播放状态和关闭按钮。

窗口无系统标题栏，拖动依赖 `data-tauri-drag-region`；关闭按钮在 header/工具条里。窗口层级设为 `NSStatusWindowLevel` 并带 `canJoinAllSpaces + fullScreenAuxiliary` collection behavior（`lib.rs` setup 里通过 objc2 直接设 NSWindow），因此在其他 app（如 Chrome 视频）全屏时字幕条仍然浮在最前。模式切换时用 `setMinSize` + `setSize` 调整窗口，相关权限声明在 `capabilities/default.json`。同步仍是单向的，影院模式没有播放控制。

UI 实现约定（与 extension 保持一致）：

- 样式用 Tailwind v4（`@tailwindcss/vite` 插件），设计 token 定义在 `src/styles.css` 的 `@theme` 里（`glass`/`hairline`/`fg-*`/`wash-*`/`yt`/`ok`）；只有滚动条 `::-webkit-scrollbar` 伪元素保留原生 CSS。
- 列表模式的背景染色只有一个 token（`--color-glass`），header/列表/footer 颜色统一，不要给局部单独加深。
- 影院模式追求沉浸：通过 `set_vibrancy` 命令在运行时**关闭** vibrancy 磨砂（列表模式恢复），窗口变成纯透明 + `--color-glass-cinema` 淡黑染色，视频画面清晰透过；无 border、无内侧高光。工具条（列表/状态/时间/关闭）在右上角，进入影院模式头 3 秒先显示再淡出，之后 hover 显示。
- 图标统一用 `@iconify/react` 的 `mdi:*`，不要手写 SVG。注意 iconify 图标数据是运行时从 iconify API 拉取的（有缓存）；footer 的"不联网"指字幕数据不出本机。
- 字幕列表用 `virtua` 的 `VList` 虚拟滚动，自动居中用 `scrollToIndex(index, { align: "center", smooth })`，切换视频时首次跳转不做平滑动画。
- 滚动条只在滚动中显示：thumb 平时透明，`onScroll`/`onScrollEnd` 维护 `.scrolling` class。

## dev / production 环境区分

dev 和 production 是两个完全独立的 app，通过构建时的 `LISTENUP_ENV` 环境变量区分（脚本已封装，一般不用手动设置）：

| | production | development |
|---|---|---|
| 构建命令 | `pnpm build:desktop` | `pnpm build:desktop:dev` |
| 产物 | `ListenUp Desktop.app` | `ListenUp Desktop DEV.app` |
| bundle id | `com.listenup.desktop` | `com.listenup.desktop.dev` |
| 深链接 | `listenup://open` | `listenup-dev://open` |
| Native host 名 | `com.listenup.desktop` | `com.listenup.desktop.dev` |
| 对应扩展构建 | `pnpm build:extension` → `dist_chrome/` | `pnpm build:extension:native-demo` → `dist_chrome_dev/` |
| 扩展名字 | listen up immers | listen up immers DEV |

实现位置：`tauri.dev.conf.json`（productName/identifier/标题 overlay）、`scripts/gen-info-plist.mjs`（按环境生成深链接 scheme，构建前自动运行）、`build.rs` 把 `LISTENUP_ENV` 透传给 Rust（socket 路径按 bundle id 区分）、前端用 `VITE_LISTENUP_ENV` 显示 DEV 角标。扩展侧由 vite `define` 注入 `__LISTENUP_DEV__`，host 名和深链接在 `src/shared/nativeSubtitleProtocol.ts` 按环境切换。

## 构建和安装（以 dev 环境为例）

1. 构建带开发权限的 Chrome 扩展和 Tauri app：

   ```bash
   pnpm build:extension:native-demo
   pnpm build:desktop:dev
   ```

2. 在 `chrome://extensions` 启用 Developer mode，选择 Load unpacked，加载 `apps/extension/dist_chrome_dev/`。

3. 复制 Chrome 显示的 32 位扩展 ID，然后安装 Native Host manifest：

   ```bash
   pnpm install:desktop-host -- <extension-id> --dev
   ```

   （production 环境去掉 `--dev`，加载 `dist_chrome/`，用 `pnpm build:desktop`。）

4. 启动一次 `ListenUp Desktop DEV.app`（让 LaunchServices 注册 `listenup-dev://` scheme）。之后从扩展 popup 点击 "Open ListenUp Desktop"（dev 扩展自动走 `listenup-dev://open`）打开 app。

5. Reload 扩展并打开带字幕的 YouTube `/watch` 页面。app 开着时字幕自动同步；没开时后台只有无窗口的桥接进程，不会弹窗。

卸载 manifest（dev 加 `--dev`）：

```bash
pnpm uninstall:desktop-host
```

manifest 位于：

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.listenup.desktop[.dev].json
```

安装器会同时生成一个可执行 wrapper，并把 Host 启动记录写入
`~/Library/Logs/ListenUp Desktop.log`，便于排查 Chrome 启动失败。

## 行为边界

- 仅开发构建声明 `nativeMessaging` 权限；生产扩展不会连接 Host。
- 每个视频发送一次字幕快照，播放游标最多每 250ms 发送一次，字幕索引变化时立即发送。
- 多个 YouTube 标签页并存时，窗口跟随最近产生“播放中”游标的标签页。
- 当前是单向同步；Native 窗口不能控制 YouTube。
- Host 缺失或断开不会影响扩展字幕面板。播放视频只会拉起无窗口的桥接进程，GUI 永远不会被 Chrome 自动弹出；关掉 GUI 后桥接自动降级为缓存模式，重新打开 GUI 即恢复同步。

## 验证

```bash
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
```

真实链路必须在 Chrome + YouTube 页面手工验证，包括播放、暂停、拖动进度、SPA 切换视频和多标签页切换。UI 改动还要验证：列表/影院模式切换及窗口尺寸恢复、影院模式拖动窗口、毛玻璃背景在深浅色桌面上的可读性。
