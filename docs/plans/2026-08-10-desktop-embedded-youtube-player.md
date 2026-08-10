# Desktop 内嵌 YouTube 播放与字幕通信 — 实施计划

- 日期：2026-08-10
- 状态：待批准，尚未修改产品代码
- 关联设计：`docs/spark/2026-08-10-desktop-embedded-youtube-player-design.md`
- 前置调研：`docs/plans/2026-08-10-desktop-embedded-youtube-research.md`
- Plane：LISTENUP-7

## 方案概述

按可独立验证和回退的六个批次实施双来源方案：先把 Extension 中可复用的字幕与播放器身份逻辑
抽成 workspace 纯核心，并用 Native Messaging v5 增加浏览器 `playbackEpoch`；再从 Desktop
现有 `HostStore` 上方建立 `SourceCoordinator`；随后创建普通 Player 窗口和零通用 capability
的远程 YouTube child WebView；在来源链路稳定后接入双入口 UI 与复合字幕视图；最后加入手动
Cookie + macOS Keychain，并完成安全棘轮、文档和真实回归。

现有 Chrome Extension → Native Messaging → Desktop 路径始终保持可运行。每个行为批次都把
测试与行为放在同一 commit，不能等最后再补；任一批次无法通过时，可以回退该批次而不破坏
BrowserSource。

## 现有基线与边界

- `apps/listenup-desktop/src-tauri/src/lib.rs` 当前同时包含 Native bridge、`HostStore`、SQLite
  写入、播放命令和窗口 setup；实施时只拆与双来源直接相关的职责，不重构 updater、tray、
  appMode 或数据库领域模型。
- `apps/listenup-desktop/src/App.tsx` 当前同时处理 viewer event、持久字幕、list/cinema、
  appMode 和渲染；只抽取 Browser/Player 两个页面需要共用的 viewer hook 与字幕视图。
- `apps/extension/src/shared/nativeSubtitleProtocol.ts` 是 BrowserSource 协议唯一权威；升级版本必须
  同步 TypeScript 守卫、background、content、Rust serde 和 production/DEV 构建。
- 远程 YouTube 页面不得进入现有 `main` capability。Player 本地页面、远程 `youtube` WebView
  和现有 `main` 必须使用不同 label 与权限集合。
- Cookie 只在 Desktop 本地 UI、Keychain 与 WebKit Cookie store 之间流动；Extension 权限面
  必须保持不变。

## 涉及文件 / 模块

### 新增共享字幕核心

- `packages/youtube-core/` — videoId、轨道选择、字幕 URL、JSON3 解析、cursor/playbackEpoch
  计算等无平台 transport 的纯 TypeScript。
- `docs/modules/youtube-core/README.md` — 新 workspace 模块职责、依赖方向和测试说明。
- `apps/extension/package.json`、`pnpm-lock.yaml` — Extension 使用 workspace core。
- `apps/extension/src/pages/content/lib/captions/`、`lib/subtitles/` — 改为薄适配或 re-export，保持
  现有调用方和测试边界。

### BrowserSource 协议

- `apps/extension/src/shared/nativeSubtitleProtocol.ts` 及测试 — v5 cursor/session 的
  `playbackEpoch` 契约和严格守卫。
- `apps/extension/src/pages/content/hooks/useNativeSubtitleBridge.ts`、
  `nativeCursorScheduler.ts` 及测试 — 只在新播放世代递增，普通 cursor/seek 不递增。
- `apps/extension/src/pages/background/index.ts` — v5 消息透传，仍按 tab 路由。

### Desktop 来源协调

- `apps/listenup-desktop/src-tauri/src/source_coordinator.rs` — 来源状态机、Embedded 锁、浏览器
  隔离集合、playbackEpoch 重接屏障和统一 `SourceRef`。
- `apps/listenup-desktop/src-tauri/src/browser_source.rs` — 从现有 `HostStore` 提取浏览器 session
  仲裁、bridge 归属和多视频选择，不改变既有行为。
- `apps/listenup-desktop/src-tauri/src/embedded_source.rs` — Embedded session/cursor/command
  状态、消息大小与频率限制、迟到消息拒绝。
- `apps/listenup-desktop/src-tauri/src/lib.rs` — 只保留 composition、socket、Tauri commands 和
  app setup；SQLite 写入先经过 `SourceCoordinator` 权威判断。
- `apps/listenup-desktop/src-tauri/src/database/` — 不改 schema，只复用 verified + ready +
  非空 session 的持久化入口。

### Player 窗口与远程 WebView

- `apps/listenup-desktop/src-tauri/src/embedded_player.rs` — 创建/销毁普通 Player NSWindow、
  本地 `player-ui`、远程 `youtube` child WebView、导航白名单、popup/download 拒绝和控件路由。
- `apps/listenup-desktop/src/embedded/bridge.ts` — document-start 主 frame 适配器；只产生固定
  EmbeddedSource 消息并接受 play/pause/seek。
- `apps/listenup-desktop/scripts/build-embedded-bridge.mjs` — 用 Vite 单独构建无外部依赖 IIFE。
- `apps/listenup-desktop/src-tauri/resources/` — 构建时生成的 bridge 资源；加入 `.gitignore`，
  不手改、不提交生成物。
- `apps/listenup-desktop/package.json`、`vite.config.ts`、`src-tauri/tauri*.conf.json` — 开发与
  正式构建都先产出 bridge，并把它作为 Tauri resource 打包。
- `apps/listenup-desktop/src-tauri/capabilities/` — 拆成 `main` 与 `player-ui` 精确授权；远程
  `youtube` 不出现在任何通用 capability 中。

### Desktop React UI

- `apps/listenup-desktop/src/main.tsx` — 按当前本地 WebView label 渲染 Browser App 或 Player App。
- `apps/listenup-desktop/src/useViewerSession.ts` — 统一消费 snapshot/cursor 与 SQLite query，保持
  高频 cursor 不进入静态字幕子树。
- `apps/listenup-desktop/src/SubtitleViewer.tsx` — 从现有 `App.tsx` 抽取 list 复用区域；现有
  list/cinema/menubar 外观不变。
- `apps/listenup-desktop/src/SourceEntryState.tsx` — 浏览器主入口、“或者”、watch URL 输入和
  本地校验错误。
- `apps/listenup-desktop/src/PlayerApp.tsx` — 本地 Player shell、视频占位区、字幕区、换链接、
  reload、退出和错误恢复。
- `apps/listenup-desktop/src/CookieSettings.tsx` — 密码型完整 Cookie 串输入、保存状态、替换与清除。
- `apps/listenup-desktop/src/types.ts`、`styles.css`、组件测试 — 双来源快照、交互与布局。

### Cookie 与安全棘轮

- `apps/listenup-desktop/src-tauri/src/cookie_vault.rs` — 64 KiB/180 键解析限制、Keychain trait、
  production/DEV service 隔离、WebKit Cookie 注入与清除。
- `apps/listenup-desktop/src-tauri/Cargo.toml`、`Cargo.lock` — macOS `security-framework` 与必要的
  WebKit/Foundation bindings；非 macOS 编译路径明确返回不支持。
- `scripts/check-environment-identifiers.mjs` — 增加远程 WebView 不得获得权限、Extension 不得
  出现 Cookie 权限、Cookie service 必须按环境隔离的确定性检查。
- `docs/decisions/` — 双来源权威、退出屏障和远程 WebView/Cookie 信任边界 ADR。
- `docs/modules/listenup-desktop/README.md`、`docs/topics/native-messaging.md`、
  `docs/testing.md` — 架构与回归同步。

## 执行批次

### 批次 1：共享 YouTube 核心与 BrowserSource 播放世代

1. [ ] 建立 `@listenup/youtube-core`，迁移 video identity、原始音轨/字幕轨选择、字幕 URL 和
   JSON3 纯解析；保留 Extension 适配层导出，确保行为不变。
2. [ ] 为共享核心补 Node tests，使用现有真实形状 fixture 覆盖 POT request URL、ASR、原始音轨、
   videoId 不一致、空 JSON 和字幕排序。
3. [ ] 把 Native Messaging 升级为 v5，给 BrowserSource session/cursor 增加单调
   `playbackEpoch`；覆盖初次播放、pause→play、SPA/自动连播、seek 和周期 cursor。
4. [ ] 跑 Extension tests、production build、DEV native-demo build 和 docs sensor。
5. [ ] 提交 `refactor(extension): share YouTube subtitle core` 与
   `feat(extension): report browser playback epochs` 两个可独立回退批次。

### 批次 2：SourceCoordinator 与浏览器屏障

6. [x] 从 `lib.rs` 提取 `BrowserSourceStore`，用现有 HostStore tests 证明 0/1/2+ 视频仲裁、
   bridgeId 路由、暂停保留和断连行为无变化。
7. [x] 新增 `SourceCoordinator` 状态机和 `SourceRef`；把 BrowserSource 消息、SQLite 持久化、
   viewer emit 与 control target 都放到同一权威门之后。
8. [x] 实现 `EnteringEmbedded`、`EmbeddedActive`、`EmbeddedRecovering`、显式退出和浏览器
   playbackEpoch 隔离集合；锁定期间 BrowserSource 只更新安全校验后的 shadow state。
9. [x] 用 Rust 表驱动测试覆盖进入、暂停成功/失败/超时、锁中旧事件、退出空态、旧 epoch 拒绝、
   新手动播放/换视频/自动连播接入，以及故障不释放锁。
10. [x] 提交 `refactor(desktop): isolate browser source state` 与
    `feat(desktop): coordinate browser and embedded sources`。

### 批次 3：受限 EmbeddedSource 与 Player 原生容器

11. [ ] 建立 Embedded 消息 schema、4 MiB/8 KiB 大小限制、10Hz cursor/20 burst、2Hz session
    限流和 source/session/video/command 身份校验；测试错版本、错身份、迟到与超限。
12. [ ] 构建 document-start 主 frame bridge，复用 youtube-core 发现播放器、字幕轨、JSON3、
    cursor、广告与 control result；远程脚本不含 Tauri 通用 invoke。
13. [ ] 动态创建普通 Player window 的本地 `player-ui` 和远程 `youtube` child WebView；本地 UI
    用 ResizeObserver 上报视频槽 bounds，Rust 同步 child WebView 尺寸。
14. [ ] 导航只接受规范化 watch URL；拒绝非 YouTube 顶层跳转、首页/频道/账户、popup、新窗口
    和下载。WebView crash 进入 Recovering，只有显式退出释放来源锁。
15. [ ] 拆分 capability，并扩展环境 sensor，确定性证明 `youtube` label 无 clipboard、updater、
    process、shell、文件系统、窗口或通用 invoke 权限。
16. [ ] 提交 `feat(desktop): add isolated embedded YouTube source`。

### 批次 4：双入口与复合 Player UI

17. [ ] 抽取 `useViewerSession` 与 `SubtitleViewer`，先用 Desktop tests 和 production frontend
    build 证明现有 BrowserSource list/cinema/menubar、React cursor 边界和样式不变。
18. [ ] 在无权威来源时显示双入口；URL 本地校验通过后才调用 `start_embedded_playback`，无效
    输入不暂停浏览器、不建锁。
19. [ ] Player App 实现“上视频、下字幕”、换链接、reload、退出、暂停失败警告、无字幕和
    受限/崩溃恢复；退出先销毁远程 WebView，再恢复 main 空状态。
20. [ ] 复用原语/译文/双语、SubtitleList、播放/暂停和字幕 seek；Embedded control 按
    `SourceRef` 路由，不能走 bridge fallback。
21. [ ] 给 URL 解析、双入口状态、Player 错误动作和窗口 label 路由补前端 Node tests。
22. [ ] 提交 `feat(desktop): add embedded playback experience`。

### 批次 5：手动 Cookie 与 macOS Keychain

23. [ ] 实现 Cookie parser 与 mockable `SecretStore`，覆盖值内等号、空白、重复键、非法 key、
    控制字符、64 KiB、180 键和原子替换；原始值不出现在错误类型或 Debug 输出。
24. [ ] macOS 实现使用 `LISTENUP_BUNDLE_ID` 派生独立 Keychain service；保存后只返回状态，
    Player 创建/reload 前注入固定 YouTube origin，清除同时移除 Keychain 与当前 WebKit cookies。
25. [ ] 本地 Cookie 设置 UI 支持整串粘贴、保存、替换和清除；成功后清空输入，不回显 key/value。
26. [ ] 增加静态与运行时泄露检查，确认日志、SQLite、viewer snapshot、crash/error 文案和
    Extension 消息中均不存在测试 Cookie 值，Extension manifest 不新增 `cookies`。
27. [ ] 提交 `feat(desktop): store manual YouTube cookies in Keychain`。

### 批次 6：文档、ADR 与完整验收

28. [ ] 更新所有受影响源码 AI 文件头、youtube-core/Desktop/Extension 模块文档、Native
    Messaging 专题与 `docs/testing.md`。
29. [ ] 新增 ADR，冻结双来源权威、Embedded 锁、playbackEpoch 退出屏障、窗口/WebView label
    和 Cookie 信任边界；ADR 明确替代或补充的既有决策。
30. [ ] 跑全部最低自动验证并记录实际测试数量、构建产物和环境 sensor 结果。
31. [ ] 在至少两个受支持 macOS 大版本执行公开/ASR/多轨/无字幕/广告/受限内容、30 分钟播放、
    1080p 菜单、Browser↔Embedded 切换、Keychain 重启恢复和安全负向回归。
32. [ ] 完整 bundle 回归后运行 `pnpm clean:desktop:bundles`；把 commit 与验证证据回写
    LISTENUP-7，再转待验收/完成状态。
33. [ ] 提交 `docs(desktop): document embedded YouTube playback`；若新增独立 sensor，按其
    回滚边界另交 `test(desktop): guard embedded player security`。

> 以上未完成项全部由 Plane `LISTENUP-7` 覆盖；实施中只有出现可独立排期、独立验收或需要另行
> 决策的新增目标时才拆新的 work item。

## 提交顺序

预计按以下逻辑边界提交；实际文件归属以每批 staged diff 为准，不把测试与对应行为拆开：

1. `refactor(extension): share YouTube subtitle core`
2. `feat(extension): report browser playback epochs`
3. `refactor(desktop): isolate browser source state`
4. `feat(desktop): coordinate browser and embedded sources`
5. `feat(desktop): add isolated embedded YouTube source`
6. `feat(desktop): add embedded playback experience`
7. `feat(desktop): store manual YouTube cookies in Keychain`
8. `test(desktop): guard embedded player security`（仅在独立 sensor 可单独回退时）
9. `docs(desktop): document embedded YouTube playback`

每次 commit 前使用 Conventional Commit Batcher 检查工作树、敏感信息、忽略规则、分支、冲突
标记和大文件；绝不使用 `--no-verify`。

## 风险 / 注意

- **WebKit 私有页面 API**：播放器与字幕轨形状可能变化。采集失败只影响 EmbeddedSource，不能
  侵入 BrowserSource；所有页面读取通过适配器和 fixture tests 固化。
- **多 WebView 权限合并**：capability 必须按具体 WebView label 授权。若当前 Tauri 版本无法
  证明远程 child WebView 零权限，停止该批次，不用 window 级宽权限绕过。
- **远程资源构建**：bridge 生成物只在 build/dev 前产生并作为 resource 打包，不提交、不手改；
  直接 `cargo test` 不依赖该文件存在。
- **窗口生命周期**：`main` NSPanel 的 appMode/list/cinema 偏好不可被 Player 改写；Player 是普通
  可聚焦窗口，退出必须停止音频并销毁 child WebView。
- **来源竞态**：加锁发生在有效 URL 校验之后、浏览器 pause 之前；SQLite、viewer emit 和命令
  路由必须共享同一 coordinator 判定，不能各自判断。
- **Cookie 安全**：不记录原始字符串，不从浏览器导入，不扩散到任意 Google 域名；一次认证失败
  不自动删除。测试 fixture 使用明显虚构值，不能把真实 Cookie 写入仓库或命令输出。
- **协议升级**：production 与 DEV 同时升级到 v5，保持不同 Extension ID、Host、bundle、socket、
  database 和 Keychain service；不允许某一环境停留 v4。
- **性能**：远程 cursor 仍以 100ms 为稳态，React 字幕列表只消费 active/played 边界；Player
  resize 与 WebView bounds 更新要节流，不能在每个 cursor 上触发布局。
- **YouTube 合规与可用性**：保留原生播放器、广告、标准控件和 Quality 菜单；不承诺 Google
  登录或受限内容，不增加完整站内浏览。

## 自动验证

```bash
pnpm --filter @listenup/youtube-core test
pnpm --filter @listenup/youtube-core build
pnpm --filter @listenup/extension test
pnpm build:extension
pnpm build:extension:native-demo
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

涉及 Tauri bundle、资源路径、Keychain 或真实 WebKit 时再跑：

```bash
pnpm build:desktop:dev
pnpm clean:desktop:bundles
```

## 手工验收证据

- 双入口空状态、BrowserSource 活跃和 EmbeddedSource 复合窗口截图。
- Browser 正在播放→Desktop 自播暂停成功与失败两条录屏或日志证据。
- 锁定期间旧浏览器 cursor/新标签播放不抢占，退出后旧 epoch 不接入、新播放 epoch 接入。
- 公开人工字幕、ASR、多语言轨、无字幕、广告、受限内容和换链接结果。
- 已知 1080p 以上样本的 Quality 菜单和 Stats for Nerds；不要求 4K。
- 30 分钟连续播放、退出后无后台声音、Player crash/reload 不释放锁。
- Keychain 保存、重启恢复、替换、清除；仓库、日志、SQLite 与 Extension 消息中的虚构 Cookie
  值全局搜索结果为空。
- production/DEV Extension + Desktop 交叉运行不串来源、权限、socket、database 或 Keychain。
- 至少两个受支持 macOS 大版本的结果与已知差异。

## 完成条件

- 六个批次的自动验证与可执行手工回归全部有证据。
- `LISTENUP-7` 回写实现 commit、失败/限制和验证结果。
- 对应模块/专题文档、测试手册、ADR 与源码文件头同步。
- 工作树无生成物和本地 Cookie，Desktop bundle 已清理。
- 用户验收后再把 Plane 状态转为完成；不能仅因代码合并就提前完成。
