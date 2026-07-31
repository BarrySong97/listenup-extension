# listenup-desktop（`apps/listenup-desktop/`）

## 职责

macOS 桌面端：把扩展抓到的 YouTube 完整字幕和实时播放游标，同步显示在一个可以浮在任何窗口（包括别的 app 的全屏）之上的独立窗口里。Tauri v2，Rust 后端 + React 前端。

边界：**管** 窗口渲染、Native Messaging Host、菜单栏入口；**不管** 字幕抓取（那是扩展的事），也**不能**反向控制 YouTube——同步是单向的。

跨模块的协议与联调流程写在 [Native Messaging 专题](../../topics/native-messaging.md)，本文只讲这个 app 自身。

## 文件清单与关系

```
src/App.tsx        窗口 UI：列表 / 影院模式、多视频选择、检查更新、虚拟滚动、状态栏
src/VideoSessionPicker.tsx  多视频冲突与主动改选的全遮罩
src/useDesktopUpdater.ts    标题栏 / tray 共用的检查、下载、安装、重启更新流程
src/main.tsx       React 挂载
src/types.ts       与 Rust 侧共享的快照 / 更新类型
src/styles.css     Tailwind v4 @theme（唯一的设计 token 权威，见 design.md）
src-tauri/src/lib.rs   全部 Rust 逻辑：双模式入口、socket 服务、状态机、NSPanel/tray 配置、单测
src-tauri/src/main.rs  薄入口，调 lib::run()
src-tauri/build.rs     把 LISTENUP_ENV 透传给 Rust（socket 路径按 bundle id 区分）
src-tauri/tauri.conf.json / tauri.dev.conf.json   production / development 两套配置
src-tauri/Info.plist   深链接 scheme（由 gen-info-plist.mjs 生成，不要手改）
src-tauri/capabilities/default.json   窗口尺寸、updater 安装与进程重启权限声明
scripts/gen-info-plist.mjs      按 LISTENUP_ENV 生成 Info.plist，构建前自动跑
scripts/native-environment.mjs  读取正式/DEV 单一环境矩阵
scripts/install-host.mjs        自动注册之外的 Host manifest 手动修复工具
scripts/uninstall-host.mjs      卸载
```

## 一个二进制，两种模式

`lib.rs` 的 `run()` 开头就分叉：

- **桥接模式** —— 启动参数含 `chrome-extension://`（被 Chrome Native Messaging 拉起）。不创建窗口，把 stdin 的长度前缀 JSON 帧按 NDJSON 转发到本地 Unix socket。所以**播放视频不会弹窗**。
- **GUI 模式**（默认）—— 用户通过 `listenup://open` 深链接或直接打开。启动时在同一个 socket 上监听桥接连接。

GUI 没开时，桥接进程缓存最新的 session 快照、丢弃 cursor；GUI 打开后下一帧到来时自动连接并补发缓存的 session。

🚨 桥接模式下 **stdout 被 Native Messaging 协议独占**，任何诊断只能写 stderr。见 [ADR-0003](../../decisions/0003-native-messaging-single-binary.md)。

## 窗口

无边框透明窗口。macOS 上：

- 深色毛玻璃靠 `window-vibrancy`（`NSVisualEffectMaterial::HudWindow`），需要 `tauri.conf.json` 的 `app.macOSPrivateApi: true` **和** tauri 的 `macos-private-api` feature，缺一个就构建报错或背景不透明
- 运行时把 NSWindow **class-swap 成 `NSPanel` + `nonactivatingPanel`**（objc2 直接干）。这是能盖住别的 app 原生全屏 Space 的唯一办法——实测普通 NSWindow 即使配了 `canJoinAllSpaces` + `fullScreenAuxiliary` + 高 level 也进不去（tauri#11488）。副作用正合适：点字幕条不抢视频 app 的焦点。
- activation policy 是 `Regular`（Dock 图标 + Cmd+Tab 常驻），同时也建了菜单栏 tray（"显示字幕窗口" / "检查更新…" / "退出"），两个入口都保留
- 拖动靠 `data-tauri-drag-region`（没有系统标题栏），关闭按钮在 header / 工具条里

两种形态，靠 header 按钮切换，模式与各自尺寸持久化在 `localStorage`：

| | 列表模式 | 影院模式 |
|---|---|---|
| 形态 | YouTube 标志 + 标题 + 状态 + 完整字幕列表 + footer | 整窗缩成一条字幕带（当前句，最多两行） |
| 背景 | vibrancy 磨砂 + `--color-glass` | **运行时关掉 vibrancy**（`set_vibrancy` 命令）+ 纯透明 + `--color-glass-cinema` |
| 工具条 | 常驻 header | 默认隐藏；hover 整条影院字幕窗口时显示，鼠标离开窗口后隐藏 |

切换用 `setMinSize` + `setSize`，权限在 `capabilities/default.json`。

## 多视频仲裁

Rust `HostStore` 是播放候选、当前显示项和用户锁定的唯一权威：

- 只有一个视频播放时自动跟随；
- 两个及以上视频播放且没有有效锁定时，verified 候选达到两个后显示选择遮罩；
- 用户选择保持锁定，后来开始播放的视频不会抢占；
- 所选视频停止后，剩一个自动跟随，仍有多个则重新选择；
- pending 视频可以作为唯一项显示 loading，但不会出现在选择列表。

选择器只在播放来源冲突时自动出现，不提供 footer 或影院工具条的常驻列表入口。
冲突遮罩不可关闭。见 [ADR-0007](../../decisions/0007-desktop-owned-video-session-selection.md)。

## UI 实现约定

- Tailwind v4（`@tailwindcss/vite`），token 全在 `src/styles.css` 的 `@theme`；只有 `::-webkit-scrollbar` 伪元素保留原生 CSS
- 列表模式**只用 `--color-glass` 一个背景色**，header / 列表 / footer 保持一致，不要给局部单独加深
- 图标统一 `@iconify/react` 的 `mdi:*`，不手写 SVG。注意 iconify 数据是运行时从 API 拉的（有缓存）；footer 那句"不联网"指的是**字幕数据**不出本机
- 字幕列表用 `virtua` 的 `VList`，居中用 `scrollToIndex(i, { align: "center", smooth })`，切视频后首跳不做平滑动画
- 滚动条只在滚动中显示：thumb 平时透明，`onScroll` / `onScrollEnd` 维护 `.scrolling` class

## dev / production 是两个独立 app

靠构建时的 `LISTENUP_ENV` 区分（脚本已封装，一般不用手设）：

| | production | development |
|---|---|---|
| 构建 | `pnpm build:desktop` | `pnpm build:desktop:dev` |
| 产物 | `ListenUp Desktop.app` | `ListenUp Desktop DEV.app` |
| bundle id | `com.listenup.desktop` | `com.listenup.desktop.dev` |
| 深链接 | `listenup://open` | `listenup-dev://open` |
| Native host 名 | `com.listenup.desktop` | `com.listenup.desktop.dev` |
| Extension ID | `nocahdalbgboblhbjkacpneakljldfjh` | `gbnneflaaakigllkomehhhaianjebljf` |
| 对应扩展 | `pnpm build:extension` → `dist_chrome/` | `pnpm build:extension:native-demo` → `dist_chrome_dev/` |
| 扩展名字 | ListenUp | ListenUp DEV |

标识唯一权威是根目录 `config/listenup-environments.json`。`build.rs` 把选中环境注入 Rust，Vite 把 Host / deep link 注入扩展；`scripts/check-environment-identifiers.mjs` 校验 Tauri overlay、DEV key 和权限没有漂移。见 [ADR-0002](../../decisions/0002-dev-prod-separate-desktop-apps.md)。

## Native Host 自动注册

GUI 启动时会在 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` 幂等写入本环境的 manifest 与 wrapper：

- manifest 名与 Host 名按环境分开
- `allowed_origins` 只包含本环境 Extension ID
- wrapper 指向当前 `.app/Contents/MacOS/listenup-desktop` 的绝对路径，并把 stderr 写到本环境日志
- app 被移动后再启动会自动刷新路径；注册失败不阻止窗口启动

## 应用内更新

正式版在列表标题栏和菜单栏 tray 都提供“检查更新”。两处入口最终都调用 `useDesktopUpdater`：

1. 从 GitHub 最新已发布 Release 的 `latest.json` 检查 SemVer；
2. 有新版本时直接下载并展示进度；
3. Tauri updater 用内置公钥验证 `.app.tar.gz.sig`，验签失败立即拒绝安装；
4. 安装完成后通过 process plugin 重启应用。

签名分两层：现有 Apple Developer ID / 公证负责 macOS 对 `.app` 的系统信任；Tauri updater 的 minisign 密钥负责更新包来源校验。updater 公钥提交在 `tauri.conf.json`，私钥只允许存在于本机安全备份和 GitHub Actions 的 `TAURI_SIGNING_PRIVATE_KEY` Secret，不能提交仓库。

DEV app 不会安装正式版更新，点击只显示说明；`tauri.dev.conf.json` 也关闭 updater artifact 生成。首个带 updater 的正式版本仍需用户手工安装一次，从下一版开始才能应用内更新。

当前发布基线为 `v0.2.1`；`v0.2.0 → v0.2.1` 用作首条真实应用内更新回归链路。

## 验证

```bash
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
```

Rust 单测覆盖帧解析和 0/1/2+ 播放 session、锁定、暂停、pending 与失效选择。
真实链路必须手工验证，清单见 [testing.md](../../testing.md)。

## 注意事项

- `src-tauri/target/`、`src-tauri/gen/`、`dist/` 都是生成物
- `Info.plist` 由脚本生成；production CI 与本地 DEV 构建都会按目标环境重新生成，不能依赖工作树里上一次生成的 scheme（见 `.github/workflows/release-desktop.yml`）
- 窗口 UI 改了记得看一眼 [`@listenup/mock-ui`](../mock-ui/README.md)——官网首屏那张产品图是它的静态复刻，不会自动跟着变
