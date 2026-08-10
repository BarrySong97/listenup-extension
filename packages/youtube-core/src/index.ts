/**
 * @purpose 导出 Extension 与 Desktop Embedded bridge 共用的 YouTube 纯核心。
 * @role    @listenup/youtube-core 唯一公共入口。
 * @deps    audioLanguage、captionTrack、playbackEpoch、subtitleParser、types、videoIdentity
 * @gotcha  不得在这里引入 chrome.*、Tauri IPC、React、网络请求或持久化副作用。
 */
export * from "./audioLanguage.ts";
export * from "./captionTrack.ts";
export * from "./playbackEpoch.ts";
export * from "./subtitleParser.ts";
export * from "./types.ts";
export * from "./videoIdentity.ts";
