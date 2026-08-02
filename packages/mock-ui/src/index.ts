/**
 * @purpose mock-ui 的导出面（组件、默认数据、图标与类型）。
 * @role    website 从这里 import；样式需另行引入 styles/tokens.css。
 * @deps    ./SubtitlePanelMock、./data、./icons
 * @gotcha  改导出面要同步 website 的 package.json、next.config.ts 的 transpilePackages 与 layout.tsx 的样式引入
 */
export { SubtitlePanelMock } from "./SubtitlePanelMock";
export type { SubtitlePanelMockProps } from "./SubtitlePanelMock";
export { DEFAULT_MOCK } from "./data";
export type { SubtitleMock, Caption } from "./data";
export { YoutubeLogo, MovieOpen, Close, LogoMark } from "./icons";
