# YouTube SDK

`apps/extension/src/pages/content/lib/youtube-sdk/` —— 内容脚本与 YouTube 播放器之间唯一的适配层。单例导出 `youtubeSDK`，其余代码不应直接查询 `#movie_player` 或 `video` 元素。

## 组成

| 文件 | 职责 |
|---|---|
| `YouTubeSDK.ts` | 主编排：管理子组件生命周期、装 MutationObserver、拦 History API、对外统一 API |
| `YouTubeAdDetector.ts` | 广告探测：类型、文案、剩余时间 |
| `YouTubePlayerFacade.ts` | 播放控制：**广告播放时 `getVideoElement()` 返回 `null`**，防止误操作广告视频；缓存 video 元素 |
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

对外方法分四组：广告（`isAdPlaying` / `getCurrentAdState`）、播放（`getVideo` / `play` / `pause` / `seekTo` / `setVolume` / `getCurrentTime` / `getDuration` / `isPlaying` / `getCurrentPlayerState`）、会话（`getVideoId` / `getSessionState`）、主题（`getCurrentTheme` / `isDarkTheme` / `isLightTheme` / `getThemeColors`）。子组件也可直接取（`getAdDetector` / `getPlayerFacade` / `getThemeDetector`）。

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
- **广告期间 video 不可用**是刻意设计，不是 bug。上层要处理 `null`。
- 离开 watch 页时状态会被重置。
- 选择器全部依赖 YouTube 的 DOM class，**YouTube 改版就会静默失效**——面板"没反应"时先怀疑这里。
- MutationObserver 只观察特定属性和节点，改观察范围前先想清楚性能影响（YouTube 页面 DOM 变动极频繁）。

## 相关

- [内容脚本分层](content.md) · [FAQ](faq.md)
