# mock-ui（`packages/mock-ui/`）

## 职责

一个零依赖的展示用包：把 ListenUp Desktop 字幕窗口（列表模式）**静态复刻**一份，供官网首屏当产品图用。纯呈现，没有状态、没有副作用。

边界：**不是**共享组件库，也**不是**桌面端的实现。桌面端真实 UI 在 `apps/listenup-desktop/src/App.tsx`；这里只是它的"照片"。

## 文件清单与关系

| 文件 | 职责 |
|---|---|
| `src/SubtitlePanelMock.tsx` | 主组件，结构与取值对齐 `apps/listenup-desktop/src/App.tsx` 的列表模式 |
| `src/data.ts` | 写死的假内容（标题 / 连接状态 / 字幕数组），导出 `DEFAULT_MOCK` |
| `src/icons.tsx` | `YoutubeLogo` / `MovieOpen` / `Close` / `LogoMark` |
| `src/styles/tokens.css` | `lu-*` 类名的样式与 token，由使用方单独 import |
| `src/index.ts` | 导出面 |

## 对外接口

```ts
import { SubtitlePanelMock, DEFAULT_MOCK, LogoMark } from "@listenup/mock-ui";
import "@listenup/mock-ui/styles/tokens.css";   // 样式要单独引
```

`SubtitlePanelMock` 接 `{ data?: SubtitleMock; className?: string }`，类型 `SubtitleMock` / `Caption` 一并导出。

## 注意事项

- 消费方只有 [website](../website/README.md)：`package.json` 里 `workspace:*`，`next.config.ts` 里 `transpilePackages: ["@listenup/mock-ui"]`，样式在 `app/layout.tsx` 引入。**改导出面要同步这三处。**
- 包不编译，`exports` 直接指向 `src/*.ts(x)` 源码，所以消费方必须能转译 TS/JSX（Next 靠 `transpilePackages`）。
- 桌面端窗口 UI 变了，这里**不会自动跟着变**，官网就会展示过时的产品图。改 `App.tsx` 的列表模式时顺手看一眼这里。
- 里面的按钮都是 `tabIndex={-1}` 的装饰件，别给它们接真实交互。
