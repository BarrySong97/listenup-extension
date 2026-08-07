# Desktop HeroUI 基础组件迁移 — 设计

- 日期：2026-08-07
- 状态：已批准
- 影响范围：`apps/listenup-desktop/`

## 背景

Desktop 当前直接使用原生 `button` 和 `select`，相同的尺寸、禁用态、图标按钮与提示行为
散落在 `App.tsx`、`TranslationMissingState.tsx` 和 `VideoSessionPicker.tsx`。播放 / 暂停按钮
位于标题栏，和原语 / 译文 / 双语这一组字幕显示控制相距较远；部分图标操作只依赖原生
`title`，提示样式与键盘行为不统一。列表 footer 还在左侧暴露“SQLite 缓存 / 本地字幕库”
实现细节。

仓库 workspace catalog 已统一声明 HeroUI 3.1.0，Website 已通过 `catalog:` 使用
`@heroui/react` 与 `@heroui/styles`。本次让 Desktop 复用同一版本，并建立 Desktop 专用的
基础组件层；Extension 和 Website 的现有 UI 不迁移。

## 目标

- Desktop 的基础交互元素统一建立在 HeroUI 3 上，不再由业务组件直接使用原生
  `button` 或 `select`。
- 保留现有深色毛玻璃视觉、Tailwind token、控件尺寸、透明度和布局密度。
- 把列表形态的播放 / 暂停按钮移动到原语 / 译文 / 双语控制行最右侧。
- 为所有纯图标操作提供一致、可聚焦且能解释禁用原因的 Tooltip。
- 移除 footer 左侧 SQLite 实现文案，保留右侧语义块数量。
- 保持现有播放权威、Tauri 窗口、拖拽、影院 hover、菜单栏和字幕偏好行为不变。

## 非目标

- 不迁移 Extension 或 Website 的业务 UI。
- 不改变 HeroUI catalog 版本，也不在 Desktop 单独锁定另一套版本。
- 不把 YouTube 标志、连接状态点、加载 / 成功状态等纯展示图标变成带 Tooltip 的操作。
- 不重设计字幕列表、颜色系统、字号、毛玻璃或窗口尺寸。
- 不修改 Native Messaging、SQLite、播放命令或 appMode 协议。

## 方案选择

采用“Desktop 基础组件封装层”，不在每个业务组件中直接重复 HeroUI 配置。

被否决的方案：

- 在所有调用点直接使用 HeroUI：迁移快，但样式覆盖、Tooltip 参数和禁用态会再次分散。
- 只引入 HeroUI 样式与 Tooltip：改动小，但没有完成基础组件替换。

封装层作为唯一视觉适配边界：HeroUI 提供交互与无障碍语义，现有 Tailwind class 和 Desktop
token 继续决定最终外观。以后调整控件尺寸、Tooltip 延迟或焦点样式只改一处。

## 依赖与样式接入

Desktop `package.json` 使用 workspace catalog：

```json
{
  "dependencies": {
    "@heroui/react": "catalog:",
    "@heroui/styles": "catalog:"
  }
}
```

`src/styles.css` 在 Tailwind v4 之后引入 `@heroui/styles`，继续保留现有 `@theme` token。
Desktop 不复制 Website 样式，也不新增第二套全局颜色。HeroUI 的默认 variant 由基础组件层的
class 覆盖为当前像素尺寸、圆角、边框、背景和文字颜色；键盘焦点可见性保留。

## 基础组件边界

新增 Desktop UI primitives，职责如下：

### `DesktopButton`

建立在 HeroUI `Button` 上，承载有可见文字的操作：

- 更新提示中的“立即更新”；
- 影院“返回列表”；
- 无译文状态的复制入口；
- 多视频候选项。

组件允许业务层传入布局 class，但统一处理 `isDisabled`、`onPress`、按钮类型、焦点和 pending
语义。按钮内部可以继续使用 Iconify 图标；已有可见文字时不重复显示 Tooltip。

### `DesktopIconButton`

组合 HeroUI `Button` 与 `Tooltip`，用于所有纯图标操作。`tooltip` 与 `aria-label` 为必填，
不能只依赖原生 `title`。覆盖范围包括：

- 播放 / 暂停；
- 检查更新；
- 切换影院模式；
- Desktop / 菜单栏 App 形态切换；
- 收进菜单栏；
- 影院悬浮工具条中的纯图标操作。

Tooltip 支持鼠标悬停和键盘聚焦，并由 overlay placement 在窗口边缘自动翻转。禁用按钮外层
仍保留可命中的 Tooltip trigger，使“正在控制 YouTube…”、“广告播放中”等原因可见。

### `SubtitleModeControl`

使用 HeroUI `ToggleButtonGroup + ToggleButton` 表达原语、译文、双语三选一。视觉继续使用
列表形态的 24px 圆角矩形和影院形态的 20px 紧凑胶囊；选中状态继续由现有
`subtitleMode` 控制，持久化 key 不变。

### `TargetLanguageSelect`

使用 HeroUI `Select` 组合组件，保留 24px 高度、132px 最大宽度、深色透明背景和现有语言
显示文本。可用选项、空状态、禁用条件、`targetLanguage` 偏好及选择回调均沿用现有逻辑。

## 布局

### 列表与菜单栏列表形态

标题栏删除播放 / 暂停按钮，其他图标顺序不变。字幕显示控制行调整为：

```text
原语  译文  双语       [目标语言（按需显示）]  [播放 / 暂停]
```

播放 / 暂停始终是这一行最右侧元素。选择原语时目标语言 Select 不渲染，弹性空白仍把播放
按钮推到最右侧。Desktop 与菜单栏列表共用同一个 React shell，因此布局一致。

### 影院形态

影院没有常驻字幕控制行，继续在 hover 工具条中保留紧凑播放 / 暂停按钮。影院工具条的
入场短显、`group-hover`、拖拽和 mouse tracking 行为不变。

### Footer

删除左侧以下文案：

- `SQLite 缓存 · <videoId>`；
- `SQLite 本地字幕库`；
- live session 下的 `YouTube · <videoId>` 也随左侧来源槽一并移除。

footer 只在右侧显示 `<数量> 个语义块`。这只是隐藏实现和来源标识，不删除 SQLite
持久化、冷启动缓存或查询逻辑。

## 交互与状态

- HeroUI 事件统一使用 `onPress`；现有业务函数和异步状态机不改。
- 播放 / 暂停图标、标签和禁用原因仍从最新 cursor、pending、bridge 和广告状态推导。
- 播放命令不乐观修改 `isPaused`；command result 和后续 cursor 的权威关系不变。
- 更新、复制翻译指令和多视频选择继续使用现有 pending、错误与成功反馈。
- 字幕模式与目标语言继续使用现有 `localStorage` key。
- 交互控件不能成为 Tauri drag region；父级拖拽区域和现有窗口移动行为保持可用。
- 纯展示 Iconify 图标使用 `aria-hidden` 或现有 status 文本，不制造不可操作的 Tooltip。

## 可执行棘轮

增加 Desktop Node test，扫描业务 TSX：除 UI primitives 封装文件外，不允许出现原生
`<button>` 或 `<select>`。这保证后续新增业务 UI 继续复用 HeroUI 基础组件。

`DesktopIconButton` 的 `tooltip` / `aria-label` 通过必填 TypeScript props 强制，避免新增
纯图标按钮时漏掉提示。确定性检查不试图按字符串扫描每个 Iconify 图标，因为有可见文字的
按钮和纯展示图标不需要 Tooltip。

## 验证

自动验证：

```bash
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
node scripts/check-docs.mjs
```

手工回归：

- Desktop 与菜单栏两种 appMode 中，播放按钮都位于字幕显示控制行最右侧；窗口尺寸不变化。
- 列表和影院分别播放、暂停，并验证 pending、断连、广告和无 active session 禁用原因。
- 原语、译文、双语与目标语言选择的视觉、持久化和字幕重新居中行为不变。
- 更新、复制翻译指令和多视频选择的 pending / error / success 状态可操作。
- 所有纯图标操作支持鼠标 Tooltip、键盘 Tab 聚焦及 Enter / Space 激活。
- 标题栏拖拽、影院 hover 工具条、收进菜单栏、形态切换和窗口尺寸恢复不回归。
- footer 只显示语义块数量；SQLite 冷启动缓存能力仍正常。

## 文档与提交

实施阶段：

- 更新 `docs/modules/listenup-desktop/README.md` 的 UI 实现约定和布局说明；
- 更新 `docs/testing.md` 的 Desktop 手工回归项；
- 新增 ADR，记录 Desktop 业务 UI 统一经 HeroUI 3 primitives 的决策；
- 更新涉及源码的 AI 文件头；
- 依赖与 lockfile、primitives 与棘轮、业务迁移、文档按可回滚意图拆分 Conventional Commits。

本设计批准并提交后，下一步单独编写 `docs/plans/` 实施计划；未经计划确认不修改产品代码。
