# ListenUp Native Subtitle Demo

> 目的：验证 Chrome Extension 能通过 Native Messaging 把 YouTube 完整字幕和实时播放游标同步到独立的 Tauri 窗口。

## 架构

```text
YouTube content script
  -> extension service worker
  -> chrome.runtime.connectNative()
  -> Tauri Rust stdin reader
  -> Tauri event
  -> React subtitle list
```

Tauri 可执行文件本身就是 Native Messaging Host。它读取 Chrome 的长度前缀 JSON 消息，不启动 HTTP、WebSocket 或额外 helper 进程。stdout 专用于 Native Messaging 协议，诊断信息只能写 stderr。

## 构建和安装

1. 构建带开发权限的 Chrome 扩展和 Tauri app：

   ```bash
   pnpm build:extension:native-demo
   pnpm build:native-host-demo
   ```

2. 在 `chrome://extensions` 启用 Developer mode，选择 Load unpacked，加载 `apps/extension/dist_chrome/`。

3. 复制 Chrome 显示的 32 位扩展 ID，然后安装 Native Host manifest：

   ```bash
   pnpm install:native-host-demo -- <extension-id>
   ```

4. Reload 扩展并打开带字幕的 YouTube `/watch` 页面。字幕加载后，Chrome 会自动启动 `ListenUp Native Subtitle Demo.app`。

卸载 manifest：

```bash
pnpm uninstall:native-host-demo
```

manifest 位于：

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.listenup.native_subtitle_demo.json
```

安装器会同时生成一个可执行 wrapper，并把 Host 启动记录写入
`~/Library/Logs/ListenUp Native Subtitle Demo.log`，便于排查 Chrome 启动失败。

## 行为边界

- 仅开发构建声明 `nativeMessaging` 权限；生产扩展不会连接 Host。
- 每个视频发送一次字幕快照，播放游标最多每 250ms 发送一次，字幕索引变化时立即发送。
- 多个 YouTube 标签页并存时，窗口跟随最近产生“播放中”游标的标签页。
- 当前是单向同步；Native 窗口不能控制 YouTube。
- Host 缺失或断开不会影响扩展字幕面板。窗口关闭后不会被普通游标立即拉起；切换视频或重载页面可重新连接。

## 验证

```bash
pnpm --filter @listenup/native-subtitle-demo build
cargo test --manifest-path apps/native-subtitle-demo/src-tauri/Cargo.toml
```

真实链路必须在 Chrome + YouTube 页面手工验证，包括播放、暂停、拖动进度、SPA 切换视频和多标签页切换。
