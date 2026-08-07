# 0013. Desktop 使用 React Compiler 并隔离实时 cursor 渲染边界

- 状态：已采纳
- 日期：2026-08-07

## 背景

Native cursor 原先嵌在 `ViewerSnapshot.activeSession`。每条播放时间更新都会复制 viewer 与
session，让单体 `App` 重新构造 Header 的 HeroUI / React Aria 组件和全部字幕行 JSX。`virtua`
只减少真实 DOM，不会阻止调用方先执行完整 `displayBlocks.map()`。如果直接把同步频率从 250ms
提高到 100ms，这些无效工作也会同步放大。

Million.js 提供另一套 block reconciler，但当前发布和仓库 React adapter 以 React 18.2 为基线，
没有 React 19 兼容承诺，也不适合作为 HeroUI、Portal 与 `virtua` 组合的生产基础。React 官方
Compiler 1.0 已稳定并以 React 19 为首选目标。

## 决策

1. Desktop 精确锁定 `babel-plugin-react-compiler@1.0.0`，通过现有 Vite React Babel pipeline
   启用；Compiler 升级必须显式修改版本并重新回归。
2. Compiler 只编译 Desktop 自有源码，不改写 HeroUI、React Aria、virtua 或其他 node_modules。
3. 高频 cursor 使用独立 React state；只有 snapshot / session 切换才替换 viewer 结构状态。
4. 字幕列表是显式 memo 边界，只接收 `activeIndex`、`playedThroughIndex` 和稳定 blocks，不接收
   连续 `currentTime` 或完整 cursor。
5. 实时原语列表确认与 live session 一一对应时，直接采用扩展发送的 `currentIndex`；译文、
   双语和 SQLite fallback 按时间映射。
6. 播放时间标签只接收取整后的秒数，播放按钮只接收 paused / disabled 等稳定 primitive。
7. React Compiler 是手工数据流设计的补充，不得以 Compiler 为由把高频状态重新提升到页面根部，
   也不得用 transition / deferred rendering 延迟字幕高亮。

## 理由

- 先减少真正需要参与 render 的状态和组件，收益可预测，也不会依赖编译器是否选择某个组件。
- 官方 Compiler 保持 React 原生 reconciler 与语义，对 React 19、Hooks 和 Vite 有明确支持。
- 明确的 SubtitleList memo 边界确保 100ms cursor 不会重新创建整表 JSX；Compiler 继续缓存页面
  其余稳定子树，特别是较深的 HeroUI 控件。
- 精确版本和可退出编译保证工具链升级是可审计的，不让构建优化悄然改变交互语义。

## 后果

- Desktop 构建增加 Babel Compiler pass，构建时间和产物会小幅增加；运行时减少不必要 render。
- 代码必须遵守 Rules of React。Compiler 无法安全处理的组件应先修正规则问题，短期确需退出时
  可使用官方 `"use no memo"` 指令并记录原因。
- `cursor.currentIndex` 与 live source blocks 的对应条件成为显式契约，改变字幕重组策略时必须
  同步 selector 测试。
- React 性能回归要同时看消息延迟和 commit 耗时，不能只凭视觉体感判断 Native 链路。

