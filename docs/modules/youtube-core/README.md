# youtube-core（`packages/youtube-core/`）

## 职责

Extension 与 ListenUp Desktop EmbeddedSource 共用的 YouTube 纯逻辑：原始音轨语言识别、字幕
轨选择、player response 字幕轨归一化、带 POT 的 JSON3 URL 构建、videoId 三重身份校验、字幕
解析和浏览器播放世代计算。

## 边界

- 不访问 `chrome.*`、Tauri IPC、React、网络、Cookie、SQLite 或文件系统。
- BrowserSource 与 EmbeddedSource 分别保留页面读取和 transport 适配器。
- `normalizeCaptionTracksFromPlayerResponse()` 是两种来源读取 `getPlayerResponse()` 后的共同归一化
  入口，renderer、videoId 与 streamingData 必须来自同一 response。
- `CaptionTrackDescriptor.sourceVideoId`、播放器 videoId 与 track URL 的 `v` 必须同时一致。
- `PlaybackEpochTracker` 只在暂停→播放或新 session 首次播放时递增；seek 和周期 cursor 不递增，
  广告区间使用 `suspend()` 保留进入广告前的播放状态与 epoch。

## 验证

```bash
pnpm --filter @listenup/youtube-core test
pnpm --filter @listenup/youtube-core build
```

改动共享核心后还必须跑 Extension tests、production/DEV builds 和 Desktop EmbeddedSource tests。
