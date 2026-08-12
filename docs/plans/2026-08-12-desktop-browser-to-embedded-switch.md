# Desktop 浏览器来源切换到自播 — 实施计划

- 日期：2026-08-12
- 状态：验收修订中
- 关联设计：`docs/spark/2026-08-12-desktop-browser-to-embedded-switch-design.md`
- Plane：LISTENUP-11

## 方案概述

复用现有 `BrowserActive → EnteringEmbedded → EmbeddedActive/EmbeddedRecovering` 来源迁移和
`start_embedded_playback` command，只给现有 Desktop layout 增加入口与确认层。标题栏原更新位置
在 BrowserSource 活跃时改为“切换”，更新入口移动到 Footer 左下角；按钮和非输入区域的原生
`paste` 事件共用一个 Modal。确认后立即建立 Embedded 锁，浏览器 pause 仅尽力发送且不产生提示。

当前工作树中的 `activate_text_input` 是已经现场验证的独立键盘 Bug 修复，先恢复 production
`Info.plist`、跑检查并单独提交到 LISTENUP-10；新 Feature 在它之上把显式用户点击扩展为 Desktop
键盘激活手势，避免把两个验收与回滚边界混在一起。

## 涉及文件 / 模块

- `apps/listenup-desktop/src/App.tsx` — header/footer 入口、根级 paste 编排、统一 Modal 与轻提示。
- `apps/listenup-desktop/src/components/` — 必要时抽出来源切换 Modal，复用现有 UI primitives。
- `apps/listenup-desktop/src/embeddedPlayback.ts` — 复用 URL 规范化，不新增旁路解析。
- `apps/listenup-desktop/src-tauri/src/lib.rs` — 把显式 Desktop 点击映射到既有 AppKit 激活路径。
- `apps/listenup-desktop/src-tauri/src/embedded_player.rs` / `source_coordinator.rs` — 去掉进入自播前
  对浏览器 pause result 的等待或用户提示，同时保持 Embedded 锁与退出屏障。
- `scripts/check-environment-identifiers.mjs` — 固化无 clipboard read / 无全局 paste shortcut、单窗
  layout 与显式激活边界。
- `docs/modules/listenup-desktop/README.md`、`docs/testing.md` — 同步实现与真实回归步骤。

## 任务拆解

1. [x] 完成 LISTENUP-10 的 production `Info.plist` 恢复、构建 / sensor 回归与独立提交。
2. [x] 在 BrowserSource 活跃列表态用“切换”替换 header 更新按钮，并把 updater 入口移到 Footer 左侧。
3. [x] 实现可复用的来源切换 Modal：按钮入口为空、paste 入口预填、取消前不改变 BrowserSource。
4. [x] 用户明确点击 Desktop 后激活 app；根节点只在非编辑目标消费本次 `paste` 事件。
5. [x] 无效内容只显示短暂提示，且不缓存、记录或请求 Tauri clipboard read。
6. [x] 确认后立即进入 Embedded 锁；browser pause 结果不等待、不提示，自播期间浏览器事件不抢占。
7. [x] 更新 AI 文件头、Desktop 模块文档、测试手册和确定性 sensors。
8. [x] 跑 Node / Rust tests、Desktop build、环境 sensor 与 docs sensor，再启动 DEV 做物理键盘回归。
9. [x] 回写实现 commit 与验证证据到 LISTENUP-11，并提交可独立回退的 Feature 批次。
10. [x] 将浏览器切换、播放新链接、Cookie 设置和多视频选择统一迁移到 HeroUI v3 Modal。
11. [x] 复用 HeroUI `data-entering` / `data-exiting` 状态，实现共用的底部滑入 / 滑出动画。
12. [x] 增加 UI 棘轮、文档与本地渲染回归，再回写验收修订证据。

## 风险 / 注意

- `nonactivatingPanel` 的普通点击原本不激活 app；只能在真实用户 pointer 手势上激活，tray 重显、
  browser session、hover 和窗口置顶都不能抢前台应用焦点。
- 根级 paste listener 必须先识别 `input`、`textarea`、`select`、`contenteditable`，否则会再次破坏
  URL / Cookie 输入框的 `Command+C/V`。
- 不注册全局 `Command+V`，也不增加 `clipboard-manager:allow-read-text`；事件没有文本时直接忽略。
- Modal 确认前不能调用 Rust start command；确认后 coordinator 锁是唯一来源权威，React 不乐观
  清空 viewer。
- HeroUI v3 已移除旧版 `motionProps`；Modal 动画只通过共用 `DesktopModal` 的
  `data-entering` / `data-exiting` CSS 状态覆盖，业务组件不得再手写全屏遮罩或各自动画。
- 进入 Embedded 后仍可保留浏览器影子状态做协议安全校验，但任何 browser pause result、断连、
  换视频或播放事件都不能映射成用户提示。
- `Info.plist` 是环境生成文件。DEV 启动后必须在提交前重新生成 production 版本。

## 验证方式

```bash
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

真实 macOS 回归至少覆盖：BrowserSource 活跃时按钮切换、非输入区域物理 `Command+V`、URL 与
Cookie 输入框普通 `Command+C/V`、无效剪贴板提示、Modal 取消、确认后浏览器继续播放 / 关闭 /
换视频均无提示和抢占、退出后空态屏障，以及 Footer updater 入口。DEV bundle 启动后记录窗口数、
尺寸与同窗布局证据，不以自动化 `setValue` 或定向按键注入代替物理 Command 键验收。

## 实施与验证记录

- 前置键盘修复已独立提交为 `22d8dfe`；用户此前已用物理 `Command+V` 验收 URL 输入框。
- Desktop Node tests：19/19；Rust tests：45/45；frontend production build 通过。
- `cargo fmt --check`、environment sensor、`check-docs`、`git diff --check` 均通过。
- DEV bundle 在原 400×640 窗口验证 Footer 更新入口、BrowserSource “切换”按钮、空链接 Modal、
  `Esc` 取消、无效文本短提示，以及系统剪贴板有效 URL 的物理 `Command+V` 预填。
- 使用本地协议虚构 BrowserSource 后确认：切换立即进入同一窗口 Embedded iframe；后台 pause
  command 发出但两秒无响应不产生提示；随后注入另一浏览器视频也不改变 Embedded viewer。
- 回归中发现并修复 Embedded live session 到达前短暂显示旧 BrowserSource 缓存字幕的问题；查询
  scope 现在立即绑定新的 embedded videoId，并由纯函数测试锁定。
- 验收修订把 4 个手写遮罩统一迁移到 HeroUI v3 Modal，并由 `DesktopModal` 统一底部滑入 / 滑出；
  Desktop Node tests 增至 20/20，production frontend build、DEV `.app` bundle、环境 sensor 与 docs
  sensor 通过。本地真实 DOM 回归确认 4 个弹窗都生成 HeroUI 三层 slot，链接输入自动聚焦，普通
  Modal 可用 Esc 关闭，多视频选择器不可用 Esc 绕过；原生 DEV bundle 因系统未放行重启，尚未
  在新 bundle 内肉眼验收动画。
