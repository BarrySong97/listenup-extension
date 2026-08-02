# ListenUp Desktop

macOS 桌面端（Tauri v2）：把扩展抓到的 YouTube 字幕和实时播放游标，同步到一个可以浮在任何窗口（含别的 app 的全屏）之上的独立窗口。同一个二进制既是 GUI，也是 Chrome Native Messaging 的桥接进程。

## 快速开始

```bash
pnpm install         # 在仓库根执行
pnpm dev:desktop     # Tauri dev（development 环境）
```

构建：`pnpm build:desktop`（production）/ `pnpm build:desktop:dev`（DEV app，与正式版可共存）。

验证：

```bash
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
```

## 文档

本 app 的全部文档在仓库根的 [`docs/modules/listenup-desktop/`](../../docs/modules/listenup-desktop/README.md)；与扩展联调的完整流程见 [`docs/topics/native-messaging.md`](../../docs/topics/native-messaging.md)。
