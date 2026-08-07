# Desktop 自由窗口与菜单栏 App 双形态 — 设计

- 日期：2026-08-07
- 状态：已批准
- Plane：LISTENUP-2
- 参考：Separate/Grove 的 Tauri runtime、tray、positioning 和 window 实现

## 目标

ListenUp 提供两种可在运行中切换并跨重启恢复的应用形态：

- 自由 Desktop：现有可移动、可缩放、覆盖其他 App 全屏 Space 的字幕窗口。
- 菜单栏 App：点击 tray 后在图标下方弹出列表面板，再次点击或失焦时收起。

两种形态复用同一个 Tauri main window、实时字幕状态和更新流程，不创建第二套业务 UI。

## 从 Separate/Grove 采用的行为

参考仓库已经验证的行为包括：

- `ActivationPolicy::Accessory` 菜单栏运行方式。
- tray 左键切换 panel，右键打开菜单。
- 使用 tray rect、点击位置、monitor scale factor 和 work area 定位并 clamp。
- `show + unminimize + focus` 的显示顺序。
- `CloseRequested` 隐藏而不是退出。
- 只有窗口确实获得过焦点后，`Focused(false)` 才隐藏，避免刚打开即消失。
- native dialog 打开期间不因失焦吞掉 panel。

不直接照搬的部分：Grove 是纯菜单栏应用，没有运行时 Regular/Accessory 切换，也没有
ListenUp 的 NSPanel class-swap、全屏 Space overlay、列表/影院模式、vibrancy 和鼠标 tracking。

## 独立状态轴

新增应用形态：

```ts
type AppMode = "desktop" | "menubar";
type ViewMode = "list" | "cinema";
```

`appMode` 与现有 `viewMode` 独立：

- Desktop 支持 list 和 cinema。
- Menubar 固定使用 list panel。
- 进入 Menubar 前保存 Desktop 的 viewMode、位置和尺寸。
- 切回 Desktop 后恢复保存值；进入 Menubar 不覆盖用户的 cinema 偏好。

## 偏好与启动

Rust 在各环境 app-data 下原子维护带版本号的偏好文件：

```json
{
  "version": 1,
  "appMode": "desktop"
}
```

production 与 DEV 因 bundle/app-data 根目录不同而天然隔离。缺少偏好时默认 `desktop`，保持
现有用户升级后的行为；无效版本、损坏 JSON 或未知值也回退 Desktop，并只向 stderr 记录诊断。

启动 setup 在显示窗口前读取 appMode：

- Desktop 设置 `ActivationPolicy::Regular`。
- Menubar 设置 `ActivationPolicy::Accessory`，主窗口保持隐藏，等待 tray 点击。

Accessory 模式不会把应用作为正在运行的普通 App 放入 Dock/Cmd+Tab。用户固定在 Dock 的快捷
方式可以继续显示，但通常不显示运行指示点；未固定时不会新增运行中的普通 App 图标。

现有 WebView localStorage 继续保存 viewMode、字幕模式和窗口尺寸，并新增 Desktop 窗口位置。
Rust appMode 是应用形态的唯一权威，前端通过 Tauri command 读取和切换。

## 状态切换

### Desktop → Menubar

1. 前端保存 Desktop 的位置、尺寸和 viewMode。
2. Rust 尝试设置 Accessory 和菜单栏窗口属性。
3. 全部成功后原子保存 `appMode = menubar` 并广播形态变化。
4. 主窗口隐藏；用户下一次点击 tray 时按 tray rect 显示。
5. 前端切换为 list shell，禁用拖动和自由缩放，隐藏影院入口。

### Menubar → Desktop

1. 用户从 tray 右键菜单选择“切换到自由窗口”。
2. Rust 尝试设置 Regular 和 Desktop 窗口属性。
3. 全部成功后原子保存 `appMode = desktop` 并广播形态变化。
4. 前端恢复位置、尺寸和原 viewMode。
5. 窗口显示，并重新应用 vibrancy、shadow、NSPanel overlay 和 mouse tracking。

controller 在切换前保存旧 activation policy 和窗口属性。任一步失败时立即回滚旧属性，不保存
新 appMode，也不广播成功事件；错误通过现有 Desktop notice 机制展示。若系统 API 导致回滚本身
失败，则明确报告运行时状态不确定，并保留磁盘上的旧 appMode，使下次启动恢复到已知形态。

## 菜单栏窗口行为

- tray 左键：显示时隐藏，隐藏时定位到 tray 下方后显示。
- tray 右键：显示窗口、检查更新、切换应用形态、退出。
- 面板使用列表 UI 的默认 400×640 逻辑尺寸；当 work area 不足时缩小到可见范围。
- Menubar 面板不可拖动、不可自由缩放，不提供 cinema 切换。
- 失焦、关闭按钮或再次点击 tray 时隐藏；真正退出只走 tray 菜单。
- 显示失败或拿不到 tray rect 时安全居中，不能把窗口放到屏幕外。
- 每次显示、切换尺寸和 activation policy 后重新配置 NSPanel、vibrancy 和 tracking areas。
- 检查更新会先显示窗口，再复用现有 updater 流程；重复点击仍不能并发下载。

Desktop 形态下 tray 左键只负责显示自由窗口，不强行移动用户窗口；右键菜单行为与 Menubar
保持一致。Desktop header 提供“切换到菜单栏 App”入口，原关闭按钮仍只表示隐藏窗口。

## 组件边界

Rust runtime 拆出清晰模块：

- app mode preference：读取、校验、原子写入。
- app mode controller：activation policy 与窗口属性的事务式切换。
- tray：菜单、左右键事件、动态切换标题。
- positioning：从 Grove 适配的多显示器 panel 定位。
- window：保留 ListenUp NSPanel/vibrancy/tracking 配置，并按 appMode 应用差异。

前端新增 appMode hook 和切换入口；App 只根据 appMode 组合现有 list/cinema 内容，不复制字幕
查询、session 仲裁或 updater 状态。

## 验证

自动验证：

- 偏好缺失、合法值、未知值、损坏 JSON 和原子写入失败。
- appMode 状态转换成功才持久化，失败保持原状态。
- tray 菜单标题和动作随 appMode 更新。
- positioning 覆盖缩放、多显示器、屏幕边界和 tray rect 缺失 fallback。
- 前端覆盖 Menubar 强制 list、切回 Desktop 恢复原 viewMode。

真实 macOS 回归：

- Desktop → Menubar 后不再作为普通运行 App 出现在 Dock/Cmd+Tab；固定 Dock 快捷方式行为符合系统规则。
- tray 左键弹出、再次点击收起、失焦收起，右键菜单可用。
- 多显示器和不同缩放下 panel 位于正确 tray 下方且不越界。
- 重启后恢复 appMode；production/DEV 偏好互不影响。
- Menubar → Desktop 恢复位置、尺寸、列表/影院模式、拖动和缩放。
- 列表/影院切换、全屏 Space、vibrancy、shadow、hover tracking 和更新流程不回归。
- 隐藏/重显不会创建重复 tray、重复窗口或僵尸进程。

最低命令：

```bash
pnpm --filter @listenup/desktop build
cargo test --manifest-path apps/listenup-desktop/src-tauri/Cargo.toml
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

完整 bundle 回归后运行：

```bash
pnpm clean:desktop:bundles
```

## 文档与决策

- 新增 ADR，记录单 main window、动态 Regular/Accessory 和两个独立状态轴。
- 更新 Desktop 模块文档和 `docs/testing.md`。
- 更新涉及源码的 AI 文件头。
- 作为独立 feature 提交交付，不与播放协议改造混合。
