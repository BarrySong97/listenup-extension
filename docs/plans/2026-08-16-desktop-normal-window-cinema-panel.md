# Desktop 普通窗口与独立影院浮层 — 实现计划

- 日期：2026-08-16
- 状态：已完成
- Plane：LISTENUP-30

## 方案概述

删除 `desktop | menubar` 双 appMode，应用始终以 macOS `Regular` 形态运行。字幕列表与
Desktop Playback 使用正常、可聚焦的主 `NSWindow`，不再 class-swap 为 `NSPanel`，因此文字输入、
复制粘贴和普通窗口焦点全部交给 AppKit / WKWebView 的标准链路。

影院模式改为独立、轻量的标准 `NSWindow` 浮层：只有它使用高 window level、
`canJoinAllSpaces` 与 `fullScreenAuxiliary`。进入影院时隐藏主窗口并显示浮层；退出时关闭浮层并恢复
主窗口。两者复用同一个 Rust 字幕来源权威与播放命令，不复制 Native Messaging、SQLite 或更新状态。

保留菜单栏图标作为“显示主窗口 / 检查更新 / 退出”的辅助入口，但不再存在 Menubar Mode、
Accessory activation、tray 下方定位、失焦自动隐藏或形态切换菜单。

选择两个原生窗口而不是在同一个 Webview 上反复 `object_setClass`，是为了让普通窗口始终保持真实
`NSWindow` 语义，并把全屏浮层的 AppKit 私有行为隔离到影院窗口，避免再次污染输入焦点。

## 涉及文件 / 模块

- `apps/listenup-desktop/src-tauri/src/lib.rs` — 主窗口保持正常 NSWindow；创建、显示和隐藏独立影院 NSWindow；简化 tray。
- `apps/listenup-desktop/src-tauri/src/app_mode.rs` — 删除双形态状态机与 `desktop-preferences.json`。
- `apps/listenup-desktop/src-tauri/src/positioning.rs` — 删除 tray 面板定位；影院位置改走现有窗口尺寸/位置偏好。
- `apps/listenup-desktop/src/App.tsx` — 删除 appMode、根级键盘激活和 Menubar UI；按窗口 label 渲染主界面或影院浮层。
- `apps/listenup-desktop/src/types.ts`、`appModeWindowPolicy*` — 删除 appMode 类型、策略与旧测试。
- `apps/listenup-desktop/src/i18n/resources.ts` — 删除 Menubar Mode 文案。
- `scripts/check-environment-identifiers.mjs` — 固化“双窗口不得 class-swap、不得根级激活、影院才允许 always-on-top”的棘轮。
- `docs/decisions/` — 新增 ADR 取代 ADR-0010/0011，并更新索引。
- `docs/modules/listenup-desktop/README.md`、`docs/testing.md` — 同步窗口架构与回归矩阵。

## 任务拆解

1. [x] 写 ADR：应用固定 Regular；两个 WebviewWindow 保留标准 NSWindow；影院独立置顶；旧 Menubar 决策退役。
2. [x] 删除 Rust appMode 持久化、Accessory 切换、失焦隐藏与 tray 定位代码，忽略已有旧偏好文件。
3. [x] 让主窗口保持 Tauri 创建的原生 NSWindow，恢复标准焦点、输入、复制粘贴和窗口层级。
4. [x] 建立独立影院窗口，只在影院模式启用 always-on-top 和 all Spaces；Production A/B 后按 ADR-0020 保留标准 NSWindow。
5. [x] 在两个窗口间同步字幕显示模式、当前字幕、播放控制、语言和影院几何，不复制来源权威。
6. [x] 删除根级 `activate_text_input` 与原生命令；链接/Cookie 输入框走正常 WKWebView 输入链路。
7. [x] 删除 Menubar Mode 的 Header/tray 菜单、类型、策略、文案和测试；tray 左键只恢复主窗口。
8. [x] 增加确定性 sensors 与窗口策略测试，防止任一 WebviewWindow 再次被 class-swap 或恢复全局点击激活。
9. [x] 更新模块文档、测试手册、文件头和旧 ADR 状态。
10. [x] 跑自动化与真实 DEV `.app` 手工回归，回写 Plane、提交并交付验收。

## 风险 / 注意

- 两个 Webview 不能各自成为字幕来源权威；Rust coordinator、SQLite 和 Native socket 仍只有一份。
- 隐藏主窗口时不能销毁播放/字幕状态；退出影院后必须恢复进入前的主窗口位置、尺寸和列表状态。
- 影院浮层不包含文本输入；仅移动鼠标不激活应用，字幕 seek / 播放按钮按标准窗口规则处理焦点。
- tray 保留仅是辅助入口，不得重新引入 Accessory、自动隐藏或 tray rect 定位。
- 已有 `desktop-preferences.json` 可以保留在磁盘但停止读取，升级后必须无条件进入普通主窗口。
- 更新安装、Native Messaging GUI/bridge 分流和 production/DEV 隔离不得被窗口拆分影响。

## 验证方式

```bash
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
git diff --check
```

真实 macOS 回归至少覆盖：Production 冷启动只出现普通主窗口；列表和 Desktop Playback 可正常点击、
连续输入及使用物理 `Cmd+A/C/X/V`；普通点击不会隐藏或强制 always-on-top；进入影院后主窗口隐藏、
字幕浮层进入 Chrome 原生全屏 Space 且保持置顶；退出影院恢复原窗口几何；影院 hover、拖动、播放、
seek 正常；tray 左键仅恢复主窗口；升级、重启和旧 Menubar 偏好不会恢复旧形态。

## 实施与验证记录

- 新增 [ADR-0019](../decisions/0019-desktop-normal-window-and-dedicated-cinema-panel.md)，后由
  [ADR-0020](../decisions/0020-cinema-keeps-standard-nswindow.md) 根据 Production A/B 取代影院
  class-swap；环境 sensor 固定双标准窗口、仅 cinema 置顶以及禁止全局激活。
- 自动化：Desktop Node test 34/34、Rust test 49/49、Desktop production frontend build、完整
  DEV `.app` bundle、环境 sensor、文档 sensor 与 `git diff --check` 均通过。
- Computer Use 回归完整 DEV `.app`：main 被 macOS 识别为 `standard window` 且 window layer 为 0；
  真实点击输入框可连续键入，`Cmd+A` + 删除生效，普通 Tab 点击不隐藏；进入后变为独立
  `ListenUp Cinema`，退出恢复 standard main 与原输入状态。测试 bundle 已按清理规范删除。
- Production 首轮本机验收发现旧单面板 `x=-1177,y=238` 与 814 高度的几何键被新窗口复用，导致
  mount 后把居中的 main 移到当前两块屏幕范围外。后续修复改用 main/cinema v2 键，并加入原生
  64×64 显示器交集检查与自动居中；确定性测试固定该真实回归坐标。
- Production 后续验收发现隐藏后复用的 cinema Webview 不会再次触发固定 `[mode]` effect，且可能
  保留隐藏前的 CSS `:hover`。修复改为每次 native show 发 presentation 事件，并由前端显式重置
  3 秒提示与 pointer enter / move / leave 状态；不恢复全局 `activate_text_input`。
- 上述 React pointer 方案经用户验收仍失败：pointer 事件本身也依赖未恢复的 NSPanel tracking。
  第二次返修恢复历史 `9b8d715` 的 `group-hover`，presentation 事件只负责重置 3 秒提示，并在 WebView
  可见布局两个 animation frame 后调用 cinema-only `refresh_window_mouse_tracking`；该命令复用历史
  `setAcceptsMouseMovedEvents + updateTrackingAreas`，不改变 vibrancy。
- 再次 Production 验收与断点式日志证实 show、presentation、两帧等待和 tracking refresh 均成功，
  但 class-swap 后的 WKWebView 始终没有 mousemove / pointermove、DOM `:hover=false`。同一包仅跳过
  `object_setClass(NSPanel)` 后用户真实移入 / 移出立即恢复，因此最终删除 runtime class-swap，
  保留独立标准 `NSWindow` 与原有置顶 / 跨 Space 属性，并删除全部临时诊断探针。

## 0.5.5 发布验证

- 修复提交 `a3c004c`，版本提交 `d06e53f`；tag `v0.5.5` 指向版本提交。
- 本地验证：Desktop Node 36/36、Rust 51/51、Production frontend、完整 Production `.app`、
  environment sensor、docs sensor、cargo fmt 与 `git diff --check` 全部通过。`/Applications` 已覆盖为
  0.5.5 并完成 ad-hoc `codesign --verify --deep --strict`；普通启动仅有一个前台 GUI。
- 用户在与最终窗口路径相同的 Production A/B 包上真实确认影院工具条移入显示、移出隐藏；最终包仅删除
  诊断探针并把“跳过 NSPanel class-swap”固化为无条件行为。
- GitHub Actions run `31933088973` 全部成功，用时 12m56s；完成 arm64 构建、Apple 公证、DMG 替换、
  updater URL 重写与公开发布。
- 公开 Release：<https://github.com/BarrySong97/listenup-extension/releases/tag/v0.5.5>。资产包含公证 DMG、
  updater tarball、416-byte signature 与 `latest.json`；后者版本为 0.5.5，下载 URL 使用
  `github.com/.../releases/download/...`，不含 `api.github.com`。
- 本地 bundle 回归结束后已执行 `pnpm clean:desktop:bundles`；仓库 target 下不残留 `ListenUp*.app`。
