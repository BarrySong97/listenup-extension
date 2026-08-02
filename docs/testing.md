# 测试 & 验证策略

## 原则

- **真跑验证**：本仓库几乎没有自动化测试，"读代码觉得没问题"不算验证。改哪条路径就把那条路径跑一遍。
- **别用截图判定**：要判定就读 DOM / 无障碍树 / stdout / JSON，确定性、可进 CI。
- **聚焦子集**：只跑受影响 app 的构建，别每次 `pnpm build` 全量。
- **完成闸门**：`node scripts/check-docs.mjs --hook` 已接到 Claude / Codex 的 Stop hook（`exit 2` 才真拦）。测试命令目前**没有**进闸门——这是当前 harness 的缺口，补自动化测试时一并接上。

## 现状（诚实版）

| 面 | 自动化 | 现有覆盖 |
|---|---|---|
| Extension | ⚠️ 少量 Node test | videoId 三重身份校验 + 构建 + 手工回归 |
| Website | ⚠️ 只有 `eslint` | 构建 + 打开页面看 |
| Desktop 前端 | ❌ 无 | 构建 + 手工回归 |
| Desktop Rust | ✅ `cargo test` | session 状态机、SQLite repository、翻译校验、CLI dry-run/commit 往返 |

`apps/extension/src/pages/content/lib/subtitles/`（纯解析 / 清洗 / 合并）对 DOM 和 `chrome.*` 零依赖，是**最该先补单测**的一层。

## 最低命令

```bash
pnpm build:extension                                                     # 改扩展
pnpm --filter @listenup/extension test                                   # 改字幕身份校验
pnpm build:firefox                                                       # 改了 Firefox 相关
pnpm build:website && pnpm --filter @listenup/website lint               # 改站点
pnpm build:web:static                                                    # 改了可能影响静态导出的东西
pnpm --filter @listenup/desktop build                                    # 改桌面前端
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml    # 改 Rust
cargo build --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml --bin listenup # 改 CLI
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

### 改字幕加载链路

- SPA 切换时旧字幕立即清空；页面 / playerResponse / track URL videoId 不一致不读写缓存
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
- Native 窗口随播放 / 暂停 / seek 高亮并滚动当前句
- SPA 切视频后 Native 窗口先 loading 再替换为新字幕，全程不闪上一视频字幕
- 两个播放标签页出现选择遮罩，选定后第三个播放标签页不抢占
- 所选视频暂停或关闭后，按剩余播放数量自动跟随或重新显示选择遮罩
- 列表 / 影院模式切换、窗口尺寸恢复、影院模式拖动、毛玻璃在深浅桌面上的可读性
- 标题栏和菜单栏“检查更新”都能触发同一流程；重复点击不会并行下载
- 已是最新版、网络失败、下载进度都有明确反馈；有效签名更新能安装并重启，篡改签名必须拒绝
- DEV app 点击更新只提示不会安装正式版，DEV build 不要求 updater 私钥

### 改 SQLite / 双语 / CLI

- 日语视频默认缓存日语原字幕，英语视频默认缓存英语；同语言人工字幕优先于 ASR
- 只有 verified + ready + 非空 session 入库；loading/empty/error/cursor 不创建空 revision
- 关闭并重开 Desktop，在没有 live session 时能显示最近一条 SQLite 缓存
- `subtitle get` 的 video/track/revision/segment ID 能组成版本 1 translation document
- `translation apply --dry-run` 不改变 `translation list`；`--commit` 后能 get 到完整译文
- 合并相邻原句、拆分同一原句可导入；漏句、倒序、部分交叉、过期 revision 被拒绝且旧译文不变
- 列表和影院工具条都能切换原语、译文、双语，且两种窗口形态共享当前模式；无首选译文时明确回退原语
- 无译文时列表显示居中引导、影院显示紧凑入口；复制内容含固定 Skill / CLI 版本、视频与原语元数据，并要求先询问目标语言
- 剪贴板 capability 只有 `clipboard-manager:allow-write-text`，复制成功 / 失败都有可恢复反馈
- CLI 提交期间 Desktop 不自动变化；切回 Desktop 后 focus refetch 显示新译文
- 没有 `refetchInterval`、SQLite watcher、`PRAGMA data_version` 或 CLI 通知链路
- production/DEV 默认数据库不同，`--env dev` 不会写入 production
- production/DEV `.app` 都包含 `listenup` sidecar，CLI 构建不修改 shell profile
- 在不存在预生成 `target/sidecars/listenup-*` 时，带 Tauri `TAURI_CONFIG` overlay 的
  `prepare-cli.mjs` 仍能从零构建 sidecar（内部 Cargo 不继承该 overlay）

### 改 Website

- `pnpm build:web:static` 能产出 `apps/website/out/`（静态导出没被 API route / 动态渲染破坏）
- 下载按钮指向 GitHub Releases latest，GitHub 链接可用
- 首屏在窄屏下不横向滚动

## 何时可以用预览页代替真实环境

`newtab` / `options` 预览页能验证：面板尺寸、排版、单组件状态切换、mock 列表滚动。

**不能**验证：YouTube 页面生命周期、播放器时间同步、广告检测、字幕抓取、页面桥接、Shadow DOM 真实行为。涉及这些必须回真实 YouTube 页面。
