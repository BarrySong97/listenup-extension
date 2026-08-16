# 0011. 菜单栏形态保留 Desktop 窗口尺寸

- 状态：已被 [ADR-0019](0019-desktop-normal-window-and-dedicated-cinema-panel.md) 取代
- 日期：2026-08-07
- 取代：[ADR-0010](0010-desktop-and-menubar-app-modes.md) 中“Menubar 固定 400×640”的部分

## 背景

首版双形态实现把 Menubar 强制为 400×640 列表面板。用户在自由 Desktop 中手工调整窗口后，
点击“切换到菜单栏 App”会立刻看到窗口尺寸跳变；appMode 切换因此意外覆盖了用户刚设置的几何。

## 决策

1. 运行中 Desktop ↔ Menubar 切换只改变 activation、resizable、skip-taskbar、列表外壳和外观，
   React 不调用 `setSize`；Rust 捕获的窗口几何保持唯一事实来源。
2. Menubar 仍显示列表内容且不可缩放，但继承切换前 Desktop 的当前宽高，不再有专用固定尺寸。
3. 若应用冷启动时偏好已是 Menubar，从最后 Desktop 视图的持久尺寸恢复；只在冷启动执行一次
   `setSize`。切回 Desktop 时由 Rust 恢复同一运行周期捕获的几何。

## 理由

- appMode 是呈现与生命周期选择，不应隐式重置用户明确调整过的窗口尺寸。
- 运行时不写尺寸比“先改成菜单栏尺寸、之后再恢复”更稳定，也避免视觉跳变。
- 保留列表外壳和不可缩放属性，菜单栏形态仍有一致交互，只改变不必要的固定尺寸约束。

## 后果

- 从影院视图收进菜单栏时会切换为列表内容，但窗口仍保持影院当时的宽高；用户要求的尺寸
  稳定优先于列表的默认纵向比例。
- `appModeWindowPolicy.test.ts` 固定运行时 `resize=false` 与冷启动尺寸来源，防止回归。
