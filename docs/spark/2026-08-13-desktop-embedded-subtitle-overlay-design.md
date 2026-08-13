# Desktop Embedded 视频可拖动悬浮字幕 — 设计

- 日期：2026-08-13
- 状态：设计已确认，待用户审核书面规格
- Plane：LISTENUP-15
- 依赖设计：[Desktop 内嵌 YouTube 播放与字幕通信](2026-08-10-desktop-embedded-youtube-player-design.md)
- 相关决策：[ADR-0015：Desktop 同窗 YouTube 的播放与字幕传输边界](../decisions/0015-desktop-same-window-youtube-transports.md)

## 背景

Desktop 通过 YouTube 链接自播时，当前界面采用“上方官方 iframe 视频、下方完整字幕列表”。已有
视频专注模式可以收起字幕列表和 Footer，只保留标题栏与视频，但此时用户无法继续看到 ListenUp
字幕。用户希望在视频专注布局中把当前 ListenUp 字幕叠在播放画面上，并能在视频区域内自由拖动，
形成类似现有影院模式的观看体验。

官方 YouTube iframe 是跨域内容，可信 `main` 不得读取或修改其 DOM。本文所称“iframe 里的字幕”
指视觉上覆盖在视频区域内的本地 Overlay；实现上必须位于可信 React 页面，与 iframe 为同级元素，
不得向 YouTube iframe 注入 ListenUp 字幕。

## 已确认的产品决定

| 主题 | 决定 |
|---|---|
| 架构 | 采用可信 `main` 中 iframe 同级 Overlay，不注入 iframe、不读取 YouTube DOM |
| 入口 | 悬浮字幕开关只在 Embedded 链接播放时显示，放在 ListenUp 自有播放 / 暂停按钮旁 |
| 关闭状态 | 保持“视频 + 下方完整字幕列表 + Footer” |
| 开启状态 | 隐藏下方字幕列表和 Footer，窗口缩成“标题栏 + 视频”，视频上显示当前 ListenUp 字幕 |
| 拖动 | 采用独立拖动手柄；只有手柄启动拖动，字幕文字保持可选择 |
| 拖动范围 | 字幕卡和手柄必须完整留在视频区域内 |
| 位置记忆 | 所有 Embedded 视频共用一份相对位置；换视频、缩放窗口和重启 Desktop 后继续使用 |
| 字幕内容 | 直接跟随现有原语 / 译文 / 双语选择；双语上下两层显示 |
| 空白间隙 | 当前没有字幕时隐藏悬浮卡，不保留上一句 |
| 缺少译文 | 不偷偷回退原文，复用紧凑型本地 AI 翻译引导 |
| 恢复 | 再次点击开关后恢复完整字幕列表及进入悬浮模式前的窗口尺寸 |

## 目标

- 在 Desktop 自播的专注布局中持续显示 ListenUp 当前字幕。
- 让字幕位置适应不同视频内容、窗口宽度和用户观看偏好。
- 复用既有字幕游标、语义块、翻译选择与窗口尺寸恢复能力，不建立第二套字幕状态。
- 保留 YouTube iframe 的跨域与 Tauri 权限隔离，不扩大 loopback 播放协议。
- 保证拖动只影响悬浮字幕，不破坏 YouTube 播放器的点击、进度条、音量与全屏操作。

## 非目标

- 不把 ListenUp 字幕写入 YouTube iframe、loopback 包装页或 YouTube 原生字幕轨。
- 不读取、隐藏或重排 YouTube iframe 内部控件。
- 不为 BrowserSource 增加视频 Overlay；BrowserSource 继续使用现有列表与影院模式。
- 不增加字幕字体、颜色、背景、字号等样式编辑器。
- 不支持每个视频单独保存位置；首版所有 Embedded 视频共用一份位置偏好。
- 不支持拖动字幕卡正文，正文只用于阅读和选择文字。
- 不让点击悬浮字幕执行 seek；字幕 seek 继续由完整字幕列表负责。
- 不在本文阶段实现代码；通过书面规格审核后再单独编写实施计划。

## 方案比较

### 方案 A：可信 main 的 iframe 同级 Overlay（采用）

`EmbeddedVideoPanel` 使用相对定位容器，YouTube iframe 保持视频层，本地字幕 Overlay 作为其上方
的绝对定位同级层。它直接消费 React 已有的当前语义块和显示偏好。

优点是无需新增跨域协议、能直接复用字幕数据、拖动边界可由可信页面精确控制；代价是字幕卡覆盖
到的少量画面区域不能同时点击 YouTube，但未覆盖区域和所有原生控件仍可正常操作。

### 方案 B：把字幕传给 loopback 包装页（不采用）

需要通过 `postMessage` 传输字幕正文、模式、位置和拖动结果，并扩大当前只承载播放状态与控制的
包装页协议。它没有产品收益，却增加字幕数据边界、消息身份校验和双向状态同步复杂度。

### 方案 C：独立透明窗口覆盖视频（不采用）

独立窗口可跨出主窗口，但需要额外处理窗口跟随、焦点、缩放、Space 和多显示器坐标。它与“仅在
当前视频区域内拖动”的目标相反，也会重复现有影院窗口职责。

## 用户体验

### 1. 开关位置和默认状态

EmbeddedSource 活跃时，在原语 / 译文 / 双语控制行最右侧的 ListenUp 播放 / 暂停按钮旁显示
“视频悬浮字幕”图标按钮。按钮使用现有 `DesktopIconButton`，必须提供 Tooltip、`aria-label`、
hover 和 keyboard focus 状态。BrowserSource、空态和影院模式不显示该入口。

首次使用默认关闭。关闭 Desktop 或退出 EmbeddedSource 后，悬浮模式本身回到关闭状态；只持久化
用户拖好的位置。这样再次进入自播不会在用户未选择时自动收起完整字幕列表。

### 2. 开启悬浮字幕

用户点击开关后：

1. 保存当前展开窗口尺寸；
2. 隐藏下方 `SubtitleViewer` 和 Footer；
3. 按现有视频专注布局把窗口缩成标题栏与完整视频区域；
4. 在视频上显示当前 ListenUp 字幕卡；
5. 图标、Tooltip 与 `aria-label` 切换成“关闭视频悬浮字幕”。

标题栏、视频标题、轨道、时间、原语 / 译文 / 双语选择和播放按钮都保留。因此用户可以在悬浮模式
中切换字幕内容或控制播放，不必先恢复完整列表。

### 3. 字幕卡

字幕卡默认位于视频画面下部、YouTube 控制栏上方。视觉沿用影院字幕的字重、层级与玻璃背景：

- 原语：一层原文；
- 译文：一层译文；
- 双语：原文在上、译文在下；
- 文本最多按现有字幕块自然换行，不横向超出视频安全边距；
- 卡片左侧提供独立拖动手柄，鼠标 hover / keyboard focus 时强化显示；
- 卡片正文允许文本选择，不把普通 pointer down 解释成拖动。

Overlay 根层使用 `pointer-events: none`，只有字幕卡和手柄使用 `pointer-events: auto`。因此字幕卡以外
的整个视频区域仍直接操作 YouTube。字幕卡覆盖区域用于字幕交互，不把点击穿透给 iframe。

### 4. 拖动

用户按住手柄后进入拖动状态：

- 手柄调用 Pointer Capture，指针跨过 iframe 时拖动不会中断；
- 移动过程中只更新内存中的位置，使用 `requestAnimationFrame` 合并高频 pointer move；
- 字幕卡四边和手柄始终完整留在视频容器的安全边距内；
- 松开或取消 pointer 后结束拖动，并只写一次持久化位置；
- 拖动不暂停视频、不 seek、不改变当前字幕或窗口焦点策略。

### 5. 位置记忆和窗口变化

位置以可移动范围内的归一化坐标保存，而不是绝对像素：

```ts
interface EmbeddedSubtitleOverlayPositionV1 {
  version: 1;
  x: number; // 0..1，在容器宽度扣除卡片宽度后的可移动范围内
  y: number; // 0..1，在容器高度扣除卡片高度后的可移动范围内
}
```

建议存储键为 `listenup-embedded-subtitle-overlay-position-v1`。默认值取下部居中，例如
`{ x: 0.5, y: 0.72 }`。读取时拒绝非有限数、版本不符和越界值；损坏数据回退默认位置。

`ResizeObserver` 监听视频容器和字幕卡尺寸。窗口缩放、单双语高度变化或字体布局变化时，根据归一化
坐标重新计算像素位置并 clamp。位置保存不包含 videoId，因此换链接后直接复用同一观看偏好。

### 6. 关闭和来源退出

再次点击开关后：

1. 卸载 Overlay；
2. 恢复普通列表最小尺寸；
3. 恢复进入悬浮模式前保存的窗口宽高；
4. 重新显示完整字幕列表和 Footer；
5. 当前句继续由现有列表居中逻辑收敛。

如果用户在悬浮模式中换链接，Overlay 保持开启并使用保存的位置；如果显式退出 EmbeddedSource，
必须自动关闭悬浮模式并恢复普通布局，防止 BrowserSource 或空态继承视频专注高度。

## 组件边界

### `App.tsx`

- 拥有 `embeddedSubtitleOverlayEnabled` UI 状态；
- 把开关放在 `PlaybackButton` 旁；
- 复用现有窗口尺寸保存、专注高度计算和退出恢复能力；
- 从现有 `displayBlocks` 与 cursor presentation 取得当前语义块；
- 把当前显示内容传给视频面板，不复制字幕索引算法。

### `EmbeddedVideoPanel.tsx`

- 保持视频容器为 Overlay 的唯一定位边界；
- 组合 iframe、加载 / 错误状态与 `EmbeddedSubtitleOverlay`；
- 不拥有字幕模式偏好、窗口尺寸或持久化位置。

### 新增 `EmbeddedSubtitleOverlay.tsx`

- 渲染原语 / 译文 / 双语卡片与独立手柄；
- 实现 Pointer Capture、拖动状态和可访问性；
- 通过纯坐标函数计算 / clamp 位置；
- 在 pointer end 时通知位置变更；
- 不访问 Tauri、播放器命令、SQLite 或字幕查询。

### 新增纯布局模块

坐标归一化、像素换算、默认值校验和边界 clamp 放在无 React 依赖的纯 TypeScript 模块中。它不读取
DOM 或 `localStorage`，便于 Node test 覆盖不同窗口、卡片尺寸和损坏输入。

## 数据流

```text
YouTube iframe cursor
  → useYoutubeIframePlayer
  → EmbeddedSource cursor / viewer
  → App 的 resolveSubtitleCursorPresentation
  → current DisplayBlock
  → EmbeddedVideoPanel
  → EmbeddedSubtitleOverlay

原语 / 译文 / 双语偏好
  → App 的 effectiveSubtitleMode / displayBlocks
  └──────────────────────────────→ 同一个 Overlay

拖动手柄
  → Overlay 内存坐标
  → pointer end
  → App 偏好适配层
  → localStorage v1 位置
```

连续 `currentTime` 仍只让时间标签按整秒更新；Overlay 只在 active block 或显示模式变化时更新文本，
不能因为每个 100ms cursor 重新渲染字幕静态子树。

## 空态和错误处理

| 场景 | 悬浮模式行为 |
|---|---|
| 字幕正在加载 | 不显示旧字幕卡，视频 loading 行为不变 |
| 当前时间处于字幕间隙 | 暂时隐藏字幕卡，下一句在保存位置出现 |
| 视频无字幕 | 不显示字幕卡；现有字幕状态继续提供反馈 |
| 字幕 transport 失败 | 不覆盖 iframe 错误或恢复入口，不显示旧字幕 |
| iframe 播放失败 | 现有播放器错误层优先，Overlay 不遮挡其反馈 |
| 选择译文 / 双语但译文缺失 | 显示现有紧凑型本地 AI 翻译引导，不静默显示原文 |
| 持久化位置损坏 | 回退下部居中默认值，不阻止视频或字幕工作 |
| Overlay 测量为 0 | 等下一次有效 ResizeObserver 测量后定位，不写坏坐标 |
| 来源退出 | 自动关闭 Overlay、恢复普通最小尺寸与展开布局 |

## 安全与权限边界

```text
可信 main React
└─ EmbeddedVideoPanel（relative）
   ├─ YouTube loopback iframe（跨域、无 Tauri capability）
   └─ EmbeddedSubtitleOverlay（可信 sibling、只消费本地字幕展示数据）
```

- Overlay 不进入 loopback 包装页，不新增 `postMessage` 字幕消息。
- 不读取 iframe DOM、控件位置、字幕或样式。
- 不新增 Tauri command、capability、Cookie、剪贴板或网络权限。
- 持久化内容只有两个归一化数字和版本号，不含字幕正文、videoId 或观看历史。
- 实施时新增 ADR，增量覆盖 ADR-0015 中“播放器未经覆盖”的旧表述，明确只有可信、本地、用户显式
  开启的字幕层可以覆盖视频，播放与字幕 transport 的既有隔离保持不变。

## 可访问性

- 开关与手柄都必须有明确 `aria-label` 和可见 Tooltip。
- 开关支持 Enter / Space，焦点样式沿用 `DesktopIconButton`。
- 手柄使用可聚焦的专用交互 primitive，提供当前用途说明；键盘可用方向键按固定步长移动，按住
  Shift 时使用更大步长，位置同样经过 clamp 并在 key up / blur 后保存。
- 拖动时用 cursor `grabbing` 表达状态；系统减少动态效果时不增加过渡动画。
- 字幕正文保持可选择，语义上使用普通文本而不是按钮。

## 测试与验收

### 自动验证

- 纯函数测试：默认值、损坏存储、归一化往返、四边 clamp、卡片大于容器、尺寸变化。
- 组件 / 静态守卫：入口只出现在 EmbeddedSource，位于播放按钮旁，使用 Desktop UI primitive；
  iframe wrapper 没有新增字幕 `postMessage` 或 Tauri capability。
- 性能边界：Overlay 不直接订阅连续 `currentTime`，只消费 active block。
- 必跑：`pnpm --filter @listenup/desktop test`、`pnpm --filter @listenup/desktop build`、
  `node scripts/check-docs.mjs` 和相关环境 sensor。

### 真实 DEV `.app` 回归

1. 用 YouTube 链接进入 Embedded 播放，确认开关紧邻 ListenUp 播放按钮，BrowserSource 不显示。
2. 开启后列表和 Footer 消失，窗口缩到标题栏与完整视频，当前字幕叠在视频上。
3. 原语、译文、双语切换后，Overlay 内容和高度立即正确变化。
4. 从手柄拖到四个角和边缘，指针经过 iframe 仍连续，卡片不能越界。
5. 字幕正文可选择；点击卡片外的视频、YouTube 进度条、音量、设置和全屏仍正常。
6. 播放进入字幕间隙时卡片消失，下一句在原位置出现，不闪上一句。
7. 调整窗口宽高后位置按比例保持；换链接、退出并重进 Embedded、重启 Desktop 后位置仍保留。
8. 关闭开关恢复进入前尺寸、完整字幕列表、Footer 和当前句居中。
9. 在悬浮模式中显式退出 Embedded，空态恢复普通最小高度；后续 BrowserSource 不继承 Overlay。
10. 无字幕、字幕加载失败、iframe 失败和缺译文引导均不被悬浮层遮挡或伪装。
11. React Profiler 确认 100ms cursor 不让 Overlay 静态文本和工具栏持续 commit。

## 完成定义

- 上述用户体验、信任边界、可访问性与验收场景全部实现并真跑通过。
- 更新 `App.tsx`、`EmbeddedVideoPanel.tsx` 和新增文件的 AI 文件头。
- 同步 `docs/modules/listenup-desktop/README.md`、`docs/testing.md` 与新增 ADR。
- `node scripts/check-docs.mjs`、Desktop tests/build、环境 sensor 无错误。
- 将实现 commit、自动验证和真实 DEV `.app` 截图回写 LISTENUP-15，再更新到待验收或完成状态。
