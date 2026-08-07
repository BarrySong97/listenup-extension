# YouTube SDK

`apps/extension/src/pages/content/lib/youtube-sdk/` —— 内容脚本与 YouTube 播放器之间唯一的适配层。单例导出 `youtubeSDK`，其余代码不应直接查询 `#movie_player` 或 `video` 元素。

## 组成

| 文件 | 职责 |
|---|---|
| `YouTubeSDK.ts` | 主编排：管理子组件生命周期、装 MutationObserver、拦 History API、对外统一 API |
| `YouTubeAdDetector.ts` | 广告探测：类型、文案、剩余时间 |
| `YouTubePlayerFacade.ts` | 播放控制与状态事件；缓存 video 元素，播放且有订阅者时用 100ms clock 采样 currentTime |
| `YouTubeSessionMonitor.ts` | 会话状态：`videoId` / 是否 watch 页 / 播放器是否就绪 |
| `YouTubeThemeDetector.ts` | 明暗主题探测与配色 |
| `types.ts` | `AdState` / `PlayerState` / `YouTubeSessionState` 与四个回调类型 |
| `index.ts` | 导出 + `export const youtubeSDK = new YouTubeSDK()` 单例 |

## 状态结构

```ts
interface AdState     { isAdPlaying: boolean; adType: 'none'|'skippable'|'non-skippable'|'overlay'; adText: string; adRemainingTime: number }
interface PlayerState { isVideoAvailable: boolean; currentTime: number; duration: number; isPaused: boolean; volume: number }
interface YouTubeSessionState { videoId: string | null; isWatchPage: boolean; isPlayerReady: boolean }
```

## 用法

```ts
import { youtubeSDK } from '.../lib/youtube-sdk';

youtubeSDK.start({ onAdStateChange, onPlayerStateChange, onThemeChange, onSessionChange });
// 组件卸载时
youtubeSDK.stop();
```

`onPlayerStateChange(state, reason)` 的 `reason` 保留 `timeupdate`、`play`、`pause`、
`seeking`、`seeked` 等原生事件来源。Facade 会把一次拖动的第一个 `seeking` 和最终 `seeked`
明确标出，供 Native cursor 绕过普通节流。

浏览器原生 `timeupdate` 频率不足以保证 Desktop 低延迟高亮。Facade 在视频播放且至少有一个
state listener 时启动 100ms clock，直接读取 `video.currentTime`；暂停、最后一个 listener
取消订阅、video 被替换或 SDK stop 时立即清理。原生 `timeupdate` 保留为 clock 没运行时的兜底，
seek / play / pause 仍由原生事件立即通知，不能改成永久轮询。

对外方法分四组：广告（`isAdPlaying` / `getCurrentAdState`）、播放（`getVideo` / `play` /
`pause` / `controlPlayback` / `seekTo` / `setVolume` / `getCurrentTime` / `getDuration` /
`isPlaying` / `getCurrentPlayerState`）、会话（`getVideoId` / `getSessionState`）、主题
（`getCurrentTheme` / `isDarkTheme` / `isLightTheme` / `getThemeColors`）。Native 反向命令只能走
`controlPlayback("play" | "pause")`，它复用广告保护并在 video 不可用时返回明确错误。
子组件也可直接取（`getAdDetector` / `getPlayerFacade` / `getThemeDetector`）。

## 探测机制

广告靠这些 DOM 信号：

| 信号 | 选择器 |
|---|---|
| 主判据 | `#movie_player.ad-showing` |
| 广告文案 | `.ytp-ad-simple-ad-badge` |
| 可跳过 | `.ytp-ad-skip-button` |
| 剩余时间 | `.ytp-ad-duration-remaining` |
| 覆盖式广告 | `.ytp-ad-overlay-container` |

导航靠拦截 `history.pushState` / `history.replaceState` + 监听 `popstate`。

## 注意事项

- **单例**：避免装出多个 MutationObserver。别自己 `new YouTubeSDK()`。
- 播放 clock 只允许由 Facade 管理；上层不要再叠加 `setInterval` 读取 currentTime。
- **广告期间 video 不可用**是刻意设计，不是 bug。上层要处理 `null`。
- 离开 watch 页时状态会被重置。
- 选择器全部依赖 YouTube 的 DOM class，**YouTube 改版就会静默失效**——面板"没反应"时先怀疑这里。
- MutationObserver 只观察特定属性和节点，改观察范围前先想清楚性能影响（YouTube 页面 DOM 变动极频繁）。

## 相关

- [内容脚本分层](content.md) · [FAQ](faq.md)
