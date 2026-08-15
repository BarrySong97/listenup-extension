# 测试 & 验证策略

## 原则

- **真跑验证**：本仓库几乎没有自动化测试，"读代码觉得没问题"不算验证。改哪条路径就把那条路径跑一遍。
- **别用截图判定**：要判定就读 DOM / 无障碍树 / stdout / JSON，确定性、可进 CI。
- **聚焦子集**：只跑受影响 app 的构建，别每次 `pnpm build` 全量。
- **完成闸门**：`node scripts/check-docs.mjs --hook` 已接到 Claude / Codex 的 Stop hook（`exit 2` 才真拦）。测试命令目前**没有**进闸门——这是当前 harness 的缺口，补自动化测试时一并接上。

## 现状（诚实版）

| 面 | 自动化 | 现有覆盖 |
|---|---|---|
| Extension | ⚠️ 少量 Node test | videoId 三重身份校验、Native cursor 调度、v4 协议守卫 + 构建 + 手工回归 |
| Website | ⚠️ 只有 `eslint` | 构建 + 打开页面看 |
| Desktop 前端 | ⚠️ 少量 Node test | appMode 尺寸策略 + 构建 + 手工回归 |
| Desktop Rust | ✅ `cargo test` | session/bridge/command 状态机、appMode 偏好与定位、SQLite、翻译与 CLI |

`apps/extension/src/pages/content/lib/subtitles/`（纯解析 / 清洗 / 合并）对 DOM 和 `chrome.*` 零依赖，是**最该先补单测**的一层。

## 最低命令

```bash
pnpm build:extension                                                     # 改扩展
pnpm --filter @listenup/extension test                                   # 改字幕身份校验
pnpm build:firefox                                                       # 改了 Firefox 相关
pnpm build:website && pnpm --filter @listenup/website lint               # 改站点
pnpm build:web:static                                                    # 改了可能影响静态导出的东西
pnpm --filter @listenup/desktop build                                    # 改桌面前端
pnpm --filter @listenup/desktop test                                     # 改 appMode 尺寸策略
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml    # 改 Rust
cargo build --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml --bin listenup # 改 CLI
pnpm clean:desktop:bundles                                               # 本地完整 bundle 回归后必跑
node scripts/check-docs.mjs                                              # 永远要跑
```

## 手工回归清单

### 改内容脚本 UI / 交互

- YouTube watch 页面能挂载面板；切视频后面板随新 `videoId` 重建
- 字幕能加载，loading / empty / error / ad 四态合理
- 点字幕能跳转；当前句高亮与自动滚动正常
- 复制 / 解释 / 下载 / 循环 / 录音入口未被破坏
- 麦克风菜单展开时，所选设备的电平会随说话变化
- 连录多个 take 后，播放优先命中最新那段

### 改 Extension i18n

- 浏览器 UI 为中文且没有 `ui_language` 偏好时，manifest 与 React UI 默认中文；其他语言默认英文
- 在内容脚本设置菜单、Popup、Options 或 Preview 切换语言后，所有已打开页面即时同步，重开仍保持
- 中英文下字幕面板、Explain、AI 设置、录音与错误态都无裸露翻译 key，长中文不遮挡按钮或菜单
- Chrome / Firefox 构建产物都含 `_locales/en/messages.json`、`_locales/zh_CN/messages.json`，
  manifest 保留 `default_locale: "en"`；DEV 构建名称仍明确带 DEV / 开发版

### 改字幕加载链路

- SPA 切换时旧字幕立即清空；页面 / playerResponse / track URL videoId 不一致不读写缓存
- 多配音视频以 `audioIsDefault=true` 的原始音轨语言选字幕；不能取当前配音或字幕列表第一项
- 首次加载命中正确字幕轨（含 `pot` 缺失重试）
- 字幕缓存仍可复用（`chrome.storage.local`）
- 页面桥接 fallback 仍可工作
- 无字幕视频不报致命错误

### 改 Shadow DOM / 样式注入

- 样式不污染 YouTube 原生页面
- Dropdown、hover、选区浮层等 overlay 没有错位
- YouTube 深色 / 浅色主题都验证

### 改 Explain / AI 设置

- 缺 API key 时给出「Open AI Settings」入口而非裸报错
- 缓存命中（同视频同选词，TTL 7 天）与 `refresh()` 绕过缓存都正常
- 模型不支持结构化输出时能回退到文本 JSON 提取
- 音标胶囊能朗读；Visual Reference 图片区能出图或优雅留空

### 改 Native 同步链路

- production 与 DEV manifest 都含 `nativeMessaging`，但连接不同 Host
- production Host 只允许 `nocahdalbgboblhbjkacpneakljldfjh`，DEV Host 只允许 `gbnneflaaakigllkomehhhaianjebljf`
- 两个 Chrome profile 同时播放时，正式/DEV Desktop 不串窗口、socket 或字幕
- Host 未安装时字幕面板照常工作
- 发布 Desktop 前读取 Chrome 商店当前安装版 manifest / bundle 的真实 Native 协议；商店仍为
  1.5.2/v4 时，用缺 `playbackEpoch` 的真实 v4 cursor 和 v4 ready session 验证字幕显示、SQLite、
  epoch 合成与 v4 播放命令，不能只测仓库 HEAD 的 v5 两端

### 改 Desktop 自播

- 空态同时保留浏览器自动接入说明和 YouTube 链接入口；无效链接不建立 Embedded 锁
- BrowserSource 活跃时 header 原更新位置显示“切换”，Footer 左下角显示“检查更新”；点击切换
  打开空链接 Modal，在 Desktop 非输入区域物理 `Cmd+V` 有效链接打开同一 Modal 并预填
- Desktop 只有在用户明确点击后才成为当前键盘 app；仅 hover、置顶、tray 重显或浏览器消息到达
  时，`Cmd+V` 仍属于原 app。无效文本只短暂提示，不弹 Modal、不建立 Embedded 锁
- 点击 YouTube 链接输入框后可连续输入普通字符、移动光标和删除；macOS 标准
  `Cmd+A/C/X/V` 在链接输入框与 Cookie 输入框都正常。不能只用自动化 `setValue` 代替真实按键，
  它会绕过 NSPanel key-window / WKWebView first-responder 链路；也不能用按 app 定向注入的
  快捷键代替物理 Command 键，因为它会绕过“当前活跃 app 的 Edit 菜单”路由
- 输入链接后仍是同一个 `main` 窗口和原 Desktop layout：原标题栏 / 按钮 / `SubtitleViewer` /
  底栏不替换，只在标题栏与字幕之间增加 16:9 官方 iframe 视频行
- 打包后的 macOS App 实测 loopback 包装页使用随机 `127.0.0.1` origin，官方 iframe 不报 153；
  视频可播放、暂停、点字幕 seek，cursor 约 10Hz
- 自播字幕经独立 transport 加载，标题、轨道、字幕与当前 videoId 一致；iframe 不读取 Cookie
- 多视频换链至少覆盖：英文 ASR `oanFGdDkN-o`（539 块）、英文人工字幕 `iG9CE55wbtY`
  （427 块）、日语 ASR `Qd1Je4Ecw0o`（242 块）、无字幕 `aqz-KE-bpKQ`（明确空态）和禁止嵌入
  `dQw4w9WgXcQ`（播放器明确报作者限制但字幕仍可独立读取）。连续切换时标题/轨道/列表不能串片，
  HTTP client/代理连接池应复用，429/5xx 短退避后不得把瞬时旧字幕当作新视频结果
- reload、换链接、Cookie 设置和退出使用现有 Desktop 组件；换链接不新开窗口
- EmbeddedSource 标题栏眼睛按钮只收起 / 展开列表与 Footer 并恢复窗口尺寸；播放按钮旁的字幕
  图标只控制视频 Overlay。四种组合都要验证，任一按钮不得暗中改变另一个状态
- 只收起列表时只保留标题栏和视频且不出现悬浮字幕；只开 Overlay 时底部完整列表和 Footer 保持，
  当前字幕同时覆盖视频；显式退出后 BrowserSource 不继承任一 Embedded 状态
- 悬浮字幕跟随原语 / 译文 / 双语；字幕间隙隐藏，缺译文显示紧凑复制入口。独立手柄可拖到视频
  四边但不越界，正文仍可选择；卡片外的 YouTube 播放、进度条、音量、设置与全屏均可操作
- 拖动结束、窗口缩放、换链接和重启 DEV `.app` 后相对位置保持；损坏或未知版本偏好回退到下部
  居中。React Profiler 中连续 10Hz cursor 只在 active block 变化时提交悬浮字幕
- 浏览器切换、换链接、Cookie 设置和多视频选择的 DOM 都包含 HeroUI
  `data-slot="modal-backdrop"` / `modal-container` / `modal-dialog`；打开时内容从窗口底部滑入并停在
  底部，关闭时 Mask 保持到内容滑出结束且全程不闪，最终窗口尺寸和 Desktop 背景不变。前三者
  卡片背景为实色、焦点被锁在 Modal 内，链接输入聚焦时没有从顶部落下的首帧残影，物理点击卡片外
  的 Mask 或按 `Esc` 可关闭；Mask 覆盖完整窗口（含 Header），Modal 打开期间不支持拖窗；
  多视频选择不可用遮罩点击或 `Esc` 跳过；系统“减少动态效果”开启时不播放位移动画
- 确认切换后浏览器 pause 只后台尽力发送；成功、失败、超时、标签关闭、换视频和 Extension 断连
  都不显示浏览器提示、不延迟 Desktop 切换，也不改变 Embedded viewer / 控制目标
- 显式退出后保持空态，旧浏览器 session / cursor 不接管；下一次浏览器手动播放/换片/连播，或
  刷新产生全新 session 时恢复。刷新后即使视频暂停，也应先显示该页字幕且不残留旧播放候选
- 手动 Cookie 保存到当前环境 Keychain，保存后输入清空；替换/清除后重载字幕，UI、日志、SQLite
  和 Extension 消息均不出现 Cookie 原值、键名或数量
- Native 窗口随播放 / 暂停 / seek 高亮并滚动当前句；拖动到同一句内部、另一句和
  `currentIndex=-1` 的无字幕间隙都立即同步最终时间，不能等下一次字幕索引变化
- 正常播放时 cursor 约每 100ms 更新，暂停后停止周期消息；字幕切换多数低于 100ms、P95 目标
  约 150ms，seek 目标低于 100ms。用 `sentAt` 区分传输延迟和 React commit，不能只凭肉眼估算
- React Profiler 中连续 cursor 不应让 SubtitleList 或静态 HeroUI 工具栏反复 commit；时间标签
  最多每秒更新一次，字幕列表只在 active / played 边界变化时更新
- Desktop 列表与影院的播放 / 暂停按钮都控制当前选中 session，按钮 pending 期间不可重复点；
  状态只随真实 cursor 更新，不能乐观翻转
- Desktop 原语、译文和双语字幕行都有整行 hover / focus-visible；鼠标或 Enter / Space 跳到
  显示块起点，播放中保持播放、暂停中保持暂停，并只随真实 seek cursor 更新高亮
- Desktop / 菜单栏列表的播放按钮固定在原语 / 译文 / 双语行最右侧；原语模式隐藏语言 Select、
  译文 / 双语显示语言 Select 时都不能移位。纯图标操作 hover / 键盘 focus 都显示 Tooltip，
  disabled Tooltip 能解释 pending、断连、无 cursor 或广告原因；Tooltip 必须至少在一次冷启动的
  production `.app` 中回归，Vite DEV / HMR 中显示不能作为发布验收证据
- 两个 Chrome profile 即使 tabId 相同，命令也只能到产生当前 session 的 bridge；切换选择后
  只能控制新目标。关闭目标 tab、断开 Host、超时和身份变化都显示错误且不改投其他 tab
- 广告、无 cursor、多视频尚未选择、Host 断开时播放按钮禁用；失败不影响扩展内字幕体验
- SPA 切视频后 Native 窗口先 loading 再替换为新字幕，全程不闪上一视频字幕
- 两个播放标签页出现选择遮罩，选定后第三个播放标签页不抢占
- 所选视频暂停或关闭后，按剩余播放数量自动跟随或重新显示选择遮罩
- 列表 / 影院模式切换、窗口尺寸恢复、影院模式拖动、毛玻璃在深浅桌面上的可读性
- 列表切到影院后工具条先显示 3 秒再隐藏；反复切换、拖动、进入/退出 Chrome 全屏 Space
  后，移入影院字幕条仍显示工具条，不需要重启 Desktop
- 从菜单栏隐藏再重显影院窗口后 hover 仍有效
- 没有 `desktop-preferences.json`、文件损坏或版本未知时默认自由 Desktop；production / DEV
  偏好互不串用
- 自由 Desktop ↔ 菜单栏 App 可从 header 和 tray 菜单双向切换；Desktop 是 `Regular`，菜单栏
  是 `Accessory`。固定在 Dock 的快捷图标可以保留，但菜单栏形态不显示运行状态圆点
- 菜单栏形态使用列表、不可缩放且不进入影院，但必须保持切换前 Desktop 的当前宽高，不能跳回
  400×640；重启直接进入 Menubar 时恢复最后 Desktop 视图尺寸
- tray 左键在图标下方切换显示/隐藏，面板越过显示器边缘时被 clamp，副屏和不同缩放比例都验证
- 菜单栏面板真正获得焦点后，点到 Chrome 或桌面会自动隐藏；刚显示、系统弹窗或切换形态时
  不应被错误失焦事件立即吞掉
- 从 tray 菜单切换（不经过 React header）后，切回自由 Desktop 仍恢复原位置、尺寸与
  list/cinema；重启后恢复所选 appMode。制造偏好写入失败时保持旧形态并给出错误
- 旧版本正式 Desktop 启动后静默检查并持续显示“发现新版本 / 立即更新”；点击前不下载、不安装、
  不重启，点击后才显示下载进度并完成更新
- 已是最新版或启动检查网络失败时不弹提示；用户主动检查失败仍显示错误
- Footer 左下角和菜单栏“检查更新”都能触发同一流程；重复点击不会并行下载
- 已是最新版、网络失败、下载进度都有明确反馈；有效签名更新能安装并重启，篡改签名必须拒绝
- DEV app 点击更新只提示不会安装正式版，DEV build 不要求 updater 私钥

### 改 SQLite / 双语 / CLI

- 日语视频默认缓存日语原字幕；多配音英语视频即使葡萄牙语字幕排第一仍缓存英语；同语言人工字幕优先于 ASR
- 只有 verified + ready + 非空 session 入库；loading/empty/error/cursor 不创建空 revision
- 关闭并重开 Desktop，在没有 live session 时能显示最近一条 SQLite 缓存
- `subtitle get` 的 video/track/revision/segment ID 能组成版本 1 translation document
- `translation apply --dry-run` 不改变 `translation list`；`--commit` 后能 get 到完整译文
- 合并相邻原句、拆分同一原句可导入；漏句、倒序、部分交叉、过期 revision 被拒绝且旧译文不变
- 列表和影院工具条都能切换原语、译文、双语，且两种窗口形态共享当前模式；列表切换后当前时间对应字幕立即重新居中，继续播放仍逐块自动跟随；无首选译文时明确回退原语
- 无译文时列表显示居中引导、影院显示紧凑入口；复制内容含固定 Skill / CLI 版本、视频与原语元数据，并要求先询问目标语言
- 剪贴板 capability 只有 `clipboard-manager:allow-write-text`，复制成功 / 失败都有可恢复反馈
- CLI 提交期间 Desktop 不自动变化；切回 Desktop 后 focus refetch 显示新译文
- 列表 footer 不显示 YouTube / SQLite 来源，只显示语义块数量；冷启动 SQLite 字幕仍正常显示
- 没有 `refetchInterval`、SQLite watcher、`PRAGMA data_version` 或 CLI 通知链路
- production/DEV 默认数据库不同，`--env dev` 不会写入 production
- production/DEV `.app` 都包含 `listenup` sidecar，CLI 构建不修改 shell profile
- 在不存在预生成 `target/sidecars/listenup-*` 时，带 Tauri `TAURI_CONFIG` overlay 的
  `prepare-cli.mjs` 仍能从零构建 sidecar（内部 Cargo 不继承该 overlay）
- 从公开 Release 下载 DMG 后，容器和内部 `.app` 都通过 `codesign` / Gatekeeper，且两者的
  stapled 公证票据可验证；不能只依据 CI 中 `.app` 的 `Accepted` 日志
- `latest.json` 的 updater URL 使用 `github.com/.../releases/download/...`，不得使用受匿名 API
  配额限制的 `api.github.com/.../releases/assets/...`
- 从 `releases/latest` 下载 updater tarball / `.sig`，SHA-256 与资产元数据一致，并用
  `tauri.conf.json` 内置公钥独立验签成功
- 本地 `.app` 回归结束后运行 `pnpm clean:desktop:bundles`；`target/**/bundle/macos/` 不残留
  `ListenUp*.app`，`/Applications` 只保留正式版，DEV 只从 `pnpm dev:desktop` 启动

### 改 Website

- `pnpm build:web:static` 能产出 `apps/website/out/`（静态导出没被 API route / 动态渲染破坏）
- 下载按钮指向 GitHub Releases latest，GitHub 链接可用
- 页面不显示手写 Desktop 版本号，发版无需修改官网
- 首屏在窄屏下不横向滚动

## 何时可以用预览页代替真实环境

`newtab` / `options` 预览页能验证：面板尺寸、排版、单组件状态切换、mock 列表滚动。

**不能**验证：YouTube 页面生命周期、播放器时间同步、广告检测、字幕抓取、页面桥接、Shadow DOM 真实行为。涉及这些必须回真实 YouTube 页面。
