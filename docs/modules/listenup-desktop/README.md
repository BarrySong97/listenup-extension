# listenup-desktop（`apps/listenup-desktop/`）

## 职责

macOS 桌面端：把扩展抓到的 YouTube 完整字幕和实时播放游标，同步显示在可浮于其他 app
全屏之上的窗口里；可反向控制当前 YouTube 播放 / 暂停及点击字幕定点跳转，并可在自由 Desktop 与菜单栏 App
两种形态间切换。同时将原字幕保存到 SQLite，并显示用户通过 CLI 导入的 AI 译文。
Tauri v2，Rust 后端 + React 前端。

边界：**管** 窗口渲染、Native Messaging Host、字幕持久化、安全 CLI、双形态生命周期和
当前 session 的播放 / 暂停和显示字幕块起点 seek；**不管** 字幕抓取（那是扩展的事），不内置
翻译模型，也不提供任意进度条、音量、倍速等更宽的播放器遥控。

跨模块的协议与联调流程写在 [Native Messaging 专题](../../topics/native-messaging.md)，本文只讲这个 app 自身。

## 文件清单与关系

```
src/App.tsx        窗口 UI：播放控制、appMode、原语 / 译文 / 双语、列表 / 影院、多视频选择
src/SubtitleList.tsx  memo 化 virtua 列表：只消费 active / played 边界，HeroUI 行点击发送块起点
src/subtitleCursor.ts  live 原语索引直用、译文 / fallback 时间映射的纯 selector
src/components/ui/ HeroUI 3 primitives；DesktopRowButton 是虚拟字幕热路径的无 hover state 例外
src/TranslationMissingState.tsx  列表 / 影院共用的无译文引导与复制反馈
src/localAiTranslationPrompt.ts  固定 Skill / CLI 版本的本地 AI Markdown 指令模板
src/VideoSessionPicker.tsx  多视频冲突与主动改选的全遮罩
src/useDesktopUpdater.ts    标题栏 / tray 共用的检查、下载、安装、重启更新流程
src/useSubtitleView.ts      React Query → Tauri SQLite 只读查询
src/queryClient.ts          窗口 focus refetch；无轮询 / watcher
src/main.tsx       React 挂载与 QueryClientProvider
src/types.ts       与 Rust 侧共享的实时快照 / 持久字幕视图类型
src/styles.css     Tailwind v4 @theme（唯一的设计 token 权威，见 design.md）
src-tauri/src/lib.rs   Tauri 入口、双向 socket、状态机、SQLite composition、NSPanel/tray
src-tauri/src/app_mode.rs  版本化偏好、activation policy、窗口属性与事务切换
src-tauri/src/positioning.rs  tray 下方定位、多显示器 work area clamp 与坐标缩放
src-tauri/src/database/ SQLite repository、WAL 连接、原语 revision 与译文事务
src-tauri/src/domain/   版本化翻译 JSON 与句段映射校验
src-tauri/src/cli/      listenup CLI 参数、受限命令与机器输出
src-tauri/src/bin/listenup.rs  CLI 薄入口
src-tauri/migrations/   SQLite schema 的唯一迁移来源
src-tauri/src/main.rs  薄入口，调 lib::run()
src-tauri/build.rs     把 LISTENUP_ENV 透传给 Rust（socket 路径按 bundle id 区分）
src-tauri/tauri.conf.json / tauri.dev.conf.json / tauri.cli.conf.json   环境与 CLI sidecar 配置
src-tauri/Info.plist   深链接 scheme（由 gen-info-plist.mjs 生成，不要手改）
src-tauri/capabilities/default.json   窗口尺寸、updater 安装与进程重启权限声明
scripts/gen-info-plist.mjs      按 LISTENUP_ENV 生成 Info.plist，构建前自动跑
scripts/prepare-cli.mjs         构建 listenup sidecar 并放入 .app
scripts/clean-bundle-artifacts.mjs  本地 bundle 回归后删除 target 下 `.app`，避免系统登记重复应用
scripts/native-environment.mjs  读取正式/DEV 单一环境矩阵
scripts/install-host.mjs        自动注册之外的 Host manifest 手动修复工具
scripts/uninstall-host.mjs      卸载
```

## 一个二进制，两种模式

`lib.rs` 的 `run()` 开头就分叉：

- **桥接模式** —— 启动参数含 `chrome-extension://`（被 Chrome Native Messaging 拉起）。
  不创建窗口；Chrome → GUI 把 stdin 长度帧转成 Unix socket NDJSON，GUI → Chrome 把 socket
  command 转成 stdout 长度帧。所以**播放视频不会弹窗**。
- **GUI 模式**（默认）—— 用户通过 `listenup://open` 深链接或直接打开。启动时在同一个 socket 上监听桥接连接。

GUI 没开时，桥接进程缓存最新的 session 快照、丢弃 cursor；GUI 打开后下一帧到来时自动连接
并补发缓存的 session。GUI 为每条 socket 分配 bridgeId，播放命令只能写回产生当前 session 的
bridge；Desktop 等待真实 command result 和后续 cursor，不乐观改状态。

🚨 桥接模式下 **stdout 被 Native Messaging 协议独占**，任何诊断只能写 stderr。见 [ADR-0003](../../decisions/0003-native-messaging-single-binary.md)。

## SQLite 字幕库

GUI 使用 Tauri app-data 目录下的 `listenup.sqlite`：

- production：`~/Library/Application Support/com.listenup.desktop/listenup.sqlite`
- development：`~/Library/Application Support/com.listenup.desktop.dev/listenup.sqlite`

连接开启 WAL、foreign keys 和 5 秒 busy timeout，migration 编译进 Rust。只有协议 v4 中
`identityStatus=verified`、`status=ready` 且字幕非空的 session 才写库；cursor、pending、
loading、empty 和 error 都不写。写库发生在对应 UI snapshot event 之前。

原字幕按 video/track 保存不可变 revision，译文绑定 revision。AI 可以合并连续原句，或让
连续译文块重复引用完全相同的原句来拆分；不能漏句、倒序、部分交叉或引用过期 revision。
磁盘初始化失败时 GUI 会降级到内存 SQLite，保住实时字幕，但不会假装已持久化。

SQLx migration 一经发布不可修改，`check-environment-identifiers.mjs` 固定首个 migration 的
SHA-384。早期开发数据库存在一条已知旧 checksum；连接层仅在该 checksum 命中且所有预期
schema 对象完整时原子修复 migration 元数据，未知不匹配仍拒绝打开。

## 原语 / 译文 / 双语与刷新

列表 header 提供三种模式和当前 revision 已导入的目标语言，播放 / 暂停固定在这一行最右侧；
选择保存在 `localStorage`。原语、译文和双语字幕整行都可用鼠标或键盘跳到显示块起点，保持视频
原播放状态，并等待真实 cursor 更新高亮。
当前视频没有首选译文时不拿其他语言代替：列表模式显示居中的本地 AI 翻译引导，影院模式
显示同一入口的紧凑按钮。点击只把 Markdown 指令写入系统剪贴板；模板包含视频 / 原语元数据、
固定 `cli-v0.1.0` Skill URL 和 CLI `0.1.0`，要求 Agent 先询问目标语言、dry-run 后再 commit，
Desktop 本身不下载 Skill、不安装 CLI、也不内置翻译。已有译文时列表按 AI 重组后的语义时间块
显示；影院模式在双语时显示上下两层，并在 hover 工具条中提供原语、译文、双语切换，与列表
模式共用同一份显示偏好。进入影院时工具条先显示 3 秒，之后才恢复为仅 hover 显示。

持久字幕通过 TanStack React Query 调 `get_subtitle_view`。query key 包含 video、模式和
目标语言；窗口重新聚焦时由 Tauri focus event 触发 refetch。没有 SQLite 文件监测、定时
polling 或 CLI 通知。没有 live session 时冷启动显示最近缓存；新的 live pending/loading
session 会立即盖住旧缓存。

## `listenup` CLI

CLI 不启动 GUI、不内置 AI、不接受任意 SQL。开发构建：

```bash
pnpm --filter @listenup/desktop cli:build
apps/listenup-desktop/src-tauri/target/debug/listenup info --env dev --json
```

命令面：

```bash
listenup info --json
listenup video list --json
listenup subtitle get <video-id> --json
listenup translation list <video-id> --json
listenup translation get <video-id> --language zh-CN --json
listenup translation apply translation.json --dry-run --json
listenup translation apply translation.json --commit --json
listenup translation delete <video-id> --language zh-CN --commit --json
```

`subtitle get` 给 AI 提供 source track/revision 和带 ID、时间的原句。AI 生成版本 1 的完整
translation document 后交给 `translation apply`。apply/delete 默认 dry-run，只有
`--commit` 写库；`--db <path>` 优先于默认的 `--env prod|dev`。production/DEV Tauri bundle
都会把 CLI 作为 `listenup` sidecar 放进 `.app`，主程序由 `mainBinaryName` / `default-run`
明确锁定为 `listenup-desktop`，不修改用户 shell profile。`prepare-cli.mjs` 启动内部 Cargo
构建时会移除外层 Tauri 注入的 `TAURI_CONFIG`：否则 `build.rs` 会在 sidecar 尚未复制前按
`externalBin` overlay 校验目标文件，导致干净 runner 无法自举（本地残留 sidecar 会掩盖问题）。

## 窗口

无边框透明窗口，复用一个 Webview/NSPanel 实例动态切换两种 appMode。macOS 上：

- 深色毛玻璃靠 `window-vibrancy`（`NSVisualEffectMaterial::HudWindow`），需要 `tauri.conf.json` 的 `app.macOSPrivateApi: true` **和** tauri 的 `macos-private-api` feature，缺一个就构建报错或背景不透明
- 运行时把 NSWindow **class-swap 成 `NSPanel` + `nonactivatingPanel`**（objc2 直接干）。这是能盖住别的 app 原生全屏 Space 的唯一办法——实测普通 NSWindow 即使配了 `canJoinAllSpaces` + `fullScreenAuxiliary` + 高 level 也进不去（tauri#11488）。副作用正合适：点字幕条不抢视频 app 的焦点。
- `desktop` 使用 `ActivationPolicy::Regular`：作为运行中的 app 出现在 Dock / Cmd+Tab；
  `menubar` 使用 `Accessory`：不以运行中 app 身份出现在 Dock / Cmd+Tab。用户固定在 Dock 的
  快捷图标仍可能保留，只是不显示运行状态圆点
- 首次升级没有偏好文件或偏好损坏时默认 `desktop`，不会让现有用户突然改变使用形态
- 拖动靠 `data-tauri-drag-region`（没有系统标题栏），关闭按钮在 header / 工具条里

appMode 可从 header 或 tray 菜单切换：

| | 自由 Desktop | 菜单栏 App |
|---|---|---|
| activation | `Regular` | `Accessory` |
| 窗口 | 可拖动、可缩放，保留 list / cinema | 列表面板、不可缩放，宽高继承切换前 Desktop 当前尺寸 |
| tray 左键 | 显示并聚焦窗口 | 在 tray 图标下方切换显示 / 隐藏 |
| 失焦 | 保持显示 | 窗口真正获得过焦点后，失焦自动隐藏 |
| 恢复 | 运行时恢复切换前位置 / 尺寸 / list-cinema；重启从本地偏好恢复 | 每次显示按 tray rect、点击位置与当前显示器 work area 定位并 clamp |

实现参考 Separate/Grove 的 panel 行为，但偏好和运行时窗口属性由 Rust `app_mode.rs` 统一
管理。偏好写在各环境 app-data 的 `desktop-preferences.json`，使用临时文件 + rename 原子保存；
activation、resizable/skip-taskbar 和持久化任一步失败都会回滚旧形态。见
[ADR-0010](../../decisions/0010-desktop-and-menubar-app-modes.md) 与
[ADR-0011](../../decisions/0011-menubar-preserves-desktop-window-size.md)。运行中切换不调用
`setSize`；冷启动 Menubar 才从最后 Desktop 视图的本地尺寸恢复。

自由 Desktop 内还有两种视图，靠 header 按钮切换，尺寸持久化在 `localStorage`：

| | 列表模式 | 影院模式 |
|---|---|---|
| 形态 | YouTube 标志 + 标题 + 状态 + 完整字幕列表 + footer | 整窗缩成一条字幕带（当前句，最多两行） |
| 背景 | vibrancy 磨砂 + `--color-glass` | **运行时关掉 vibrancy**（`set_vibrancy` 命令）+ 纯透明 + `--color-glass-cinema` |
| 工具条 | 常驻 header | 默认隐藏；hover 整条影院字幕窗口时显示，可切换原语 / 译文 / 双语，鼠标离开窗口后隐藏 |

切换用 `setMinSize` + `setSize`；appMode 位置恢复另用 `setPosition`，权限在
`capabilities/default.json`。
列表/影院缩放、vibrancy/阴影切换、全屏 Space 重排和 tray 重显都会重新启用
`acceptsMouseMovedEvents` 并刷新 WebView tracking areas，避免非激活 NSPanel 偶发停止命中
CSS `:hover`。

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
- Desktop 通过 workspace catalog 使用 HeroUI 3；业务 TSX 不直接写原生 `button` / `select`，
  统一经过 `src/components/ui/`。HeroUI 管交互语义，现有 Tailwind class 管最终视觉，见
  [ADR-0012](../../decisions/0012-desktop-heroui-ui-primitives.md)
- 纯图标操作统一使用 `DesktopIconButton`，Tooltip 和 aria label 必填；带可见文字的按钮及
  YouTube 标志、状态点、loading / success 等纯展示图标不重复加 Tooltip
- 列表模式**只用 `--color-glass` 一个背景色**，header / 列表 / footer 保持一致，不要给局部单独加深
- 图标统一 `@iconify/react` 的 `mdi:*`，不手写 SVG。注意 iconify 数据是运行时从 API 拉的（有缓存）；footer 那句"不联网"指的是**字幕数据**不出本机
- 本地 AI 引导只授予 `clipboard-manager:allow-write-text`；不得增加剪贴板读取权限
- 字幕列表用 `virtua` 的 `VList`，居中用 `scrollToIndex(i, { align: "center", smooth })`；切视频或切换原语 / 译文 / 双语数据集后，等新列表提交一帧再无动画居中，后续时间游标变化恢复平滑跟随
- 字幕行用专用 `DesktopRowButton` 保留原生键盘语义；它不能换成 HeroUI / React Aria Button，
  因为 React Aria `useHover` 会在鼠标逐行移动时触发 state render。行只接收稳定 `onSeek` 与
  disabled primitive；毛玻璃上的 hover 使用常驻独立层，仅由 CSS `group-hover` 切 opacity，
  并用 paint containment 限制重绘。不能直接 transition 半透明 background，也不能改成 mouse
  state 或以重新订阅连续 cursor 为代价；focus-visible 保留键盘描边。见
  [ADR-0014](../../decisions/0014-desktop-subtitle-row-seek-control.md)
- Desktop 使用精确锁定的 React Compiler 1.0；高频 cursor 必须与 viewer/session 分离。列表只接收
  active / played index，时间文字只接收整秒，HeroUI 工具栏不订阅连续 `currentTime`。见
  [ADR-0013](../../decisions/0013-desktop-react-compiler-and-cursor-render-boundaries.md)
- hover / cursor 的最终流畅度以 production frontend bundle 为准；Vite + React Development 在
  100ms cursor 下有额外检查与 HMR 开销，可用于功能调试，但不能据此判断发布版帧率。
- 实时原语列表以扩展传来的 `currentIndex` 为当前项权威值；所有更早的条目至少标记为已播放，
  避免字幕切换容差或相邻时间重叠让“当前项之前一条”短暂显示成未播放。译文与缓存列表仍按时间映射。
- 影院工具条保持“入场短显 + `group-hover`”；原生层负责在窗口状态变化后恢复鼠标 tracking，不能改成永久显示掩盖问题
- 滚动条只在滚动中显示：thumb 平时透明，`onScroll` / `onScrollEnd` 维护 `.scrolling` class
- 列表 footer 只显示语义块数量，不暴露 YouTube videoId 或 SQLite 来源文案；这不改变 SQLite
  冷启动缓存和持久字幕查询

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

本地 `pnpm build:desktop` / `pnpm build:desktop:dev` 会在 `src-tauri/target/**/bundle/macos/`
生成 `.app`。即使没有复制到 `/Applications`，macOS 也可能把这些 bundle 登记成重复应用。
每次完整构建或手工 bundle 回归结束后必须运行 `pnpm clean:desktop:bundles`；DEV 日常只通过
`pnpm dev:desktop` 启动，`/Applications` 只保留一份正式版。详见
[构建产物与分发](../../topics/release-and-distribution.md#本地-app-清理)。

## Native Host 自动注册

GUI 启动时会在 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` 幂等写入本环境的 manifest 与 wrapper：

- manifest 名与 Host 名按环境分开
- `allowed_origins` 只包含本环境 Extension ID
- wrapper 指向当前 `.app/Contents/MacOS/listenup-desktop` 的绝对路径，并把 stderr 写到本环境日志
- app 被移动后再启动会自动刷新路径；注册失败不阻止窗口启动

## 应用内更新

正式版启动后由 `useDesktopUpdater` 静默检查一次；没有新版或检查失败时不打扰用户，发现新版
则持续显示“发现新版本 vX / 立即更新”。启动检查只提示，绝不自动下载、安装或重启。列表
标题栏和菜单栏 tray 仍提供用户主动触发的“检查更新”：

1. 从 GitHub 最新已发布 Release 的 `latest.json` 检查 SemVer；
2. 启动检查发现新版时等待用户点击“立即更新”；主动检查发现新版时直接进入下载；
3. Tauri updater 用内置公钥验证 `.app.tar.gz.sig`，验签失败立即拒绝安装；
4. 安装完成后通过 process plugin 重启应用。

签名分两层：现有 Apple Developer ID / 公证负责 macOS 对 `.app` 的系统信任；Tauri updater 的 minisign 密钥负责更新包来源校验。updater 公钥提交在 `tauri.conf.json`，私钥只允许存在于本机安全备份和 GitHub Actions 的 `TAURI_SIGNING_PRIVATE_KEY` Secret，不能提交仓库。

发布 CI 还会在 Tauri 创建 DMG 后再次提交 Apple 公证并 staple DMG，再替换 Draft Release
里同名的预公证资产；同时把 `latest.json` 中受 GitHub API 匿名配额限制的 assets API URL
改成公开 Release 下载 URL。全部必需步骤成功后自动发布 Release，任一步失败则保持草稿且
不进入 `releases/latest`。只看到 `.app` 公证 `Accepted` 不算完成：公开 DMG 和内部 `.app`
都必须通过 Gatekeeper，updater `.app.tar.gz` 还必须通过内置 minisign 公钥验签。

DEV app 不会安装正式版更新，点击只显示说明；`tauri.dev.conf.json` 也关闭 updater artifact 生成。首个带 updater 的正式版本仍需用户手工安装一次，从下一版开始才能应用内更新。

当前发布基线为 `v0.3.2`；`v0.2.0 → v0.2.1` 用作首条真实应用内更新回归链路。

## 验证

```bash
pnpm --filter @listenup/desktop build
pnpm --filter @listenup/desktop test
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
```

`vite build` 产物应包含 React Compiler 的 memo cache；改 Compiler 配置后还要用 React Profiler
确认连续 cursor 不会触发 SubtitleList 和静态 HeroUI 工具栏 commit。

Rust 单测覆盖帧解析、0/1/2+ 播放 session、锁定、暂停、pending、失效选择、bridge 精确路由、
错误 bridge result、appMode 偏好默认/往返与 panel 坐标 clamp。
真实链路必须手工验证，清单见 [testing.md](../../testing.md)。

## 注意事项

- `src-tauri/target/`、`src-tauri/gen/`、`dist/` 都是生成物
- `Info.plist` 由脚本生成；production CI 与本地 DEV 构建都会按目标环境重新生成，不能依赖工作树里上一次生成的 scheme（见 `.github/workflows/release-desktop.yml`）
- 窗口 UI 改了记得看一眼 [`@listenup/mock-ui`](../mock-ui/README.md)——官网首屏那张产品图是它的静态复刻，不会自动跟着变
