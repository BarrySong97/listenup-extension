# Desktop 影院跨应用全屏置顶 — 实现计划

- 日期：2026-08-31
- 状态：执行中（用户已批准）
- Plane：LISTENUP-31

## 方案概述

执行先经历两轮双窗口实验：`main` 是普通列表 / Desktop Playback 的标准 `NSWindow`；按需创建的
`cinema` 先以独立标准 `NSWindow` 显示。第一阶段曾只对 cinema 动态应用 screen-saver level、
`canJoinAllSpaces`、`stationary`、`fullScreenAuxiliary` 与 macOS 26 `canJoinAllApplications`；DEV
日志确认属性全部生效，但用户按“先影院、再 Chrome 全屏”实测仍完全不显示，证明标准 `NSWindow`
仍被 WindowServer 排除在其他 App 的原生全屏 Space 之外。

第二阶段尝试让独立 cinema 先以标准窗口显示、可见两帧后再升级为 Panel；完整重启后的日志确认
`NSPanel + nonactivatingPanel` 与全部 overlay 属性均生效，用户实测 Chrome 全屏仍不显示。回溯提交与
LISTENUP-30 的 17 条验收记录后确认：独立 cinema 从未留下 Chrome 全屏通过证据；真正通过“同屏严格
测试”的是 `57eebdc` 的单一 main 窗口。

最终方案回到该已验证拓扑，同时保留普通列表输入修复：只使用已经初始化完成的 `main` WebView。
list 模式把它保持 / 恢复为 Tauri 原始标准 `NSWindow`；切影院后，同一 WebView 完成影院布局两帧，再
动态升级为旧版精确 `NSPanel + nonactivatingPanel`，使用 level 25 与
`canJoinAllSpaces | fullScreenAuxiliary`。退回 list、关闭窗口或 tray 唤回时，成对恢复原始 class、
style、level 与 collection behavior。不再创建第二个隐藏 WebviewWindow。

## 涉及文件 / 模块

- `apps/listenup-desktop/src-tauri/src/lib.rs` — 让同一个 main 在 list / cinema 间成对恢复 / 升级，keeper 只在 Panel 激活时工作。
- `apps/listenup-desktop/src/App.tsx` / `windowPresentation.ts` — 恢复单 WebView 动态视图状态与几何切换，影院布局两帧后调用原生升级。
- Desktop capability / permission — 删除独立 cinema 窗口授权，main 仅新增成对退出命令。
- `scripts/check-environment-identifiers.mjs` — 固化单窗口拓扑、旧版精确 Panel 参数、延后升级与完整恢复。
- `docs/decisions/0021-cinema-cross-app-fullscreen-overlay.md` / `0022-cinema-promotes-after-visible-webview.md` — 记录两轮失败；新增最终替代决策。
- `docs/decisions/README.md`、`docs/modules/listenup-desktop/README.md`、`docs/testing.md` — 同步窗口职责与真实回归矩阵。

## 任务拆解

1. [x] 把 cinema level / collection behavior 提取为单一原生策略，首次进入与 2 秒 keeper 不再复制魔法数字。
2. [x] cinema 在所有 macOS 使用 screen-saver level + legacy 全屏辅助行为；macOS 26+ 增加 `canJoinAllApplications`，旧系统保持可运行 fallback。
3. [x] 记录标准 `NSWindow` 属性全部生效但真实 Chrome 全屏仍失败的证据。
4. [x] 记录独立 cinema 可见后升级 Panel、属性全部生效但 Chrome 全屏仍失败的证据。
5. [x] 删除独立 cinema WebView，恢复 main 内的动态 list / cinema 视图与各自几何。
6. [x] main 切影院时延后升级为 `57eebdc` 的精确 Panel 参数；所有返回 list 路径恢复原始 class / style / level / behavior。
7. [x] 更新确定性单测 / sensor、最终 ADR、模块文档、测试清单和相关文件头。
8. [ ] 跑 Desktop Node / Rust 测试、Production frontend / app 构建、environment/docs sensors、格式与 diff 检查。
9. [ ] 安装 Production 验收包，真实验证“先开影院再进 Chrome 全屏”和“Chrome 已全屏再开影院”两条顺序；同时回归 hover、拖动、播放、seek、退出影院与 main 输入。
10. [ ] 同步 Desktop 0.5.6 的 package / Cargo / Tauri 版本，提交修复与版本准备，推送发布分支和 annotated tag `v0.5.6`。
11. [ ] 等待 tag workflow 完成签名、公证、DMG 替换、updater URL 重写与公开发布；核对四项资产、latest 链路和哈希并回写 Plane。

## 风险 / 注意

- 影院恢复历史已验证的 status level 25 与两个 legacy behavior，不再叠加两轮失败实验中的
  screen-saver level、stationary 或 `canJoinAllApplications`，避免改变成功组合。
- 自动化只能证明升级 / 恢复路径成对存在，无法证明 WindowServer 的真实层级或 WebKit hover；Chrome 原生全屏必须真机验收。
- 单窗方案会让 updater、焦点订阅和 UI 状态重新集中到 main；切换时必须先恢复原生类再进入任何文本输入路径。

## 验证方式

```bash
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
pnpm --filter @listenup/desktop tauri build
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
cargo fmt --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml -- --check
git diff --check
```

真机验收以 macOS 26 Production `.app` 为准：cinema 必须覆盖 Chrome YouTube 原生全屏，且两个进入
顺序都成立；鼠标移入 / 移出仍控制工具条，字幕拖动、播放、seek 可用；退出影院后 main 仍是普通
level 0 窗口，输入与 `Cmd+A/C/X/V` 不受影响。

## DEV 验收与 0.5.6 发布授权

- 用户在完整重启的 Desktop DEV 上复现原问题后，确认同一 main 动态切换方案已恢复 Chrome / YouTube
  原生全屏覆盖，并明确授权无需再次确认、直接发布新版本。
- 退出 DEV 进程前原生日志确认：影院升级为历史 NSPanel，`level=25`、
  `collectionBehavior=0b100000001`；返回 list 后恢复 `level=0`、`collectionBehavior=0b0`。
- 发布版本为 Desktop `0.5.6`；Extension 与 Website 版本不变。正式资产只认 tag CI，workflow 任一步
  失败都保持 draft，不手工公开不完整资产。
