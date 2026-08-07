# Desktop HeroUI 基础组件迁移 — 实施计划

- 日期：2026-08-07
- 状态：已批准
- 关联设计：[`docs/spark/2026-08-07-desktop-heroui-primitives-design.md`](../spark/2026-08-07-desktop-heroui-primitives-design.md)
- 影响模块：ListenUp Desktop

## 实施目标

在不改变 Desktop 现有视觉和业务状态机的前提下，把业务 UI 中的原生按钮与选择器迁移到
HeroUI 3 基础组件层；把列表形态的播放 / 暂停按钮移动到原语 / 译文 / 双语控制行最右侧，
为所有纯图标操作补统一 Tooltip，并移除 footer 左侧 SQLite / 来源实现文案。

## 改动范围

- `apps/listenup-desktop/package.json`、`pnpm-lock.yaml` — 通过 workspace catalog 接入
  `@heroui/react` 与 `@heroui/styles`。
- `apps/listenup-desktop/src/styles.css` — 引入 HeroUI 3 样式，保留现有 Tailwind token。
- `apps/listenup-desktop/src/components/ui/` — 新增 Desktop HeroUI primitives。
- `apps/listenup-desktop/src/App.tsx` — 迁移标题栏、字幕模式、目标语言、播放控制、影院工具条、
  更新提示和 footer。
- `apps/listenup-desktop/src/TranslationMissingState.tsx` — 迁移有文字的复制按钮。
- `apps/listenup-desktop/src/VideoSessionPicker.tsx` — 迁移视频候选按钮。
- `apps/listenup-desktop/src/*.test.ts` — 增加禁止业务 JSX 直接使用原生交互元素的棘轮。
- `docs/decisions/`、`docs/modules/listenup-desktop/README.md`、`docs/testing.md` — 同步架构
  决策、UI 约定和回归清单。

不修改 Extension、Website、Rust、Native Messaging、SQLite schema 或窗口协议。

## 执行步骤

### 1. HeroUI 依赖与样式基线

1. [ ] Desktop 依赖使用 `"@heroui/react": "catalog:"` 和
   `"@heroui/styles": "catalog:"`，运行 pnpm 更新 lockfile，确认 Desktop 实际解析到 3.1.0。
2. [ ] 在 `styles.css` 中按 Website 已验证的顺序引入 HeroUI 样式，不复制 Website 的主题。
3. [ ] 先跑一次 Desktop build，暴露 Vite / Tailwind / React 19 集成问题，再开始业务迁移。

### 2. Desktop HeroUI primitives

1. [ ] 建立 `DesktopButton`：包装 HeroUI `Button`，统一 `onPress`、`isDisabled`、焦点和
   现有样式透传。
2. [ ] 建立 `DesktopIconButton`：组合 HeroUI `Button + Tooltip`；强制要求 tooltip 与
   aria label，并确保禁用按钮仍能触发原因提示。
3. [ ] 建立 `SubtitleModeControl`：用 `ToggleButtonGroup + ToggleButton` 实现三选一，分别
   支持列表和影院紧凑样式。
4. [ ] 建立 `TargetLanguageSelect`：使用 HeroUI 3 compound Select，保留现有受控 value、
   禁用态、选项文本和尺寸。
5. [ ] 给新增源文件补齐 AI 文件头。

### 3. 业务 UI 迁移与布局调整

1. [ ] 迁移 `UpdateNotice` 的“立即更新”和 App 内所有纯图标按钮。
2. [ ] 从列表标题栏移除播放 / 暂停，把它加入字幕显示控制行最后；原语模式无语言 Select 时
   仍保持最右对齐。
3. [ ] 迁移列表与影院的原语 / 译文 / 双语控件，保持同一 `subtitleMode` 与存储 key。
4. [ ] 迁移目标语言 Select，确认切换数据集后现有字幕重新居中逻辑不变。
5. [ ] 保留影院 hover 工具条中的紧凑播放控制，迁移其按钮与 Tooltip。
6. [ ] 迁移 `TranslationMissingState` 和 `VideoSessionPicker` 的有文字按钮，不为可见文字重复
   添加 Tooltip。
7. [ ] 将纯展示 Iconify 图标标为装饰或保留相邻状态文本，不生成不可操作 Tooltip。
8. [ ] 删除 footer 左侧 YouTube / SQLite 来源槽，只保留右侧语义块数量。
9. [ ] 更新所有受影响源码文件的 AI 文件头。

### 4. 可执行棘轮

1. [ ] 增加 Node test，扫描 Desktop 业务 TSX；除 UI primitives 文件外禁止原生
   `<button>` 和 `<select>`。
2. [ ] 依赖 TypeScript 必填 props 保证每个 `DesktopIconButton` 都有 tooltip 和 aria label。
3. [ ] 运行测试并确认扫描规则不会把纯展示图标或 HeroUI 内部实现误判为业务违规。

### 5. 文档与决策同步

1. [ ] 新增 ADR，记录 Desktop 业务交互元素统一经过 HeroUI 3 primitives；说明为何不直接在
   每个调用点使用 HeroUI，以及 Extension / Website 不在本次迁移范围。
2. [ ] 更新 Desktop 模块文档：依赖、primitives 边界、Tooltip 规则、字幕控制行布局和 footer。
3. [ ] 更新 `docs/testing.md`：纯图标 Tooltip、键盘操作、列表最右播放按钮和 SQLite 文案移除。

### 6. 自动验证

```bash
pnpm --filter @listenup/desktop test
pnpm --filter @listenup/desktop build
node scripts/check-docs.mjs
```

如果依赖接入或构建触及环境标识文件，再补跑：

```bash
node scripts/check-environment-identifiers.mjs
```

### 7. DEV 手工回归

1. [ ] 在正在运行的 Desktop DEV 中验证热更新；如依赖变化导致 Vite 无法热加载，重启
   `pnpm dev:desktop`。
2. [ ] Desktop 与菜单栏 App 分别确认播放按钮位于字幕控制行最右侧，切换形态不改变窗口宽高。
3. [ ] 原语模式无语言 Select、译文 / 双语有语言 Select 时，播放按钮都稳定贴右。
4. [ ] 验证播放、暂停、pending、无 cursor、广告、bridge 断开和命令错误；状态仍只随 cursor
   更新，不乐观翻转。
5. [ ] 验证标题栏与影院工具条所有纯图标操作的鼠标 Tooltip 和键盘聚焦提示。
6. [ ] 验证更新、无译文复制、多视频选择、列表 / 影院切换、窗口拖拽和收进菜单栏。
7. [ ] 确认 footer 不再显示 YouTube / SQLite 来源，只显示语义块数量；无 live session 时
   SQLite 冷启动字幕仍能显示。

## 风险与应对

- HeroUI 3 与 Extension 使用的 HeroUI 2 同时存在：Desktop 必须通过自身 importer 解析 catalog
  v3，不能从根 `node_modules` 的 hoist 结果推断版本；build 和 lockfile importer 是验证依据。
- HeroUI 默认 variant 覆盖现有视觉：primitives 明确覆盖尺寸、padding、圆角、边框、背景和
  文字颜色；不在业务组件中混用默认主题。
- disabled Button 不接收 pointer event：Tooltip trigger 使用可命中的外层包装，Button 本身
  保持语义禁用，既能解释原因又不能执行操作。
- Select popover 在透明 NSPanel 边缘被裁切：使用 HeroUI overlay placement，并在列表窗口窄宽、
  菜单栏定位和不同目标语言长度下手工回归。
- HeroUI 交互节点影响 Tauri 拖拽：确保按钮 / Select 自身不是 drag region，标题栏剩余空白仍可拖。
- 全量迁移夹带业务状态改动：迁移只替换渲染组件和事件 prop；播放、字幕查询、偏好和窗口命令
  函数保持原实现，通过 diff 和手工状态回归约束。

## 提交拆分

1. `build(desktop): add catalog HeroUI dependencies` — package、lockfile 与全局样式接入。
2. `refactor(desktop): add HeroUI UI primitives` — primitives 与原生元素棘轮测试。
3. `refactor(desktop): migrate controls to HeroUI` — 业务组件迁移、播放按钮布局和 footer 文案。
4. `docs(desktop): document HeroUI UI primitives` — ADR、模块文档、testing 与完成后的计划勾选。

每批提交前使用 Conventional Commit Batcher 的安全闸门；不提交 `dist/`、Tauri `target/` 或
本地浏览器对比稿。

## 完成标准

- Desktop 业务 TSX 不再直接包含原生 `button` 或 `select`。
- 所有纯图标操作有统一 Tooltip 和 aria label；纯展示图标不产生虚假交互。
- 列表与菜单栏列表的播放 / 暂停位于字幕控制行最右侧，影院播放控制仍可用。
- UI 视觉与迁移前一致，字幕、播放、更新、窗口和偏好状态机无回归。
- footer 不显示 YouTube / SQLite 来源，SQLite 数据能力不受影响。
- Desktop test/build、docs sensor 和约定的 DEV 手工回归全部通过。
- 文档、ADR、文件头及四个 Conventional Commits 完整。
