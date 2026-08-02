/**
 * @purpose subtitles 纯逻辑层的导出面。
 * @role    对外统一入口。
 * @deps    ./subtitle*
 * @gotcha  这一层必须保持无副作用（不碰 DOM / chrome.*），它是最先能加单测的地方
 */
export * from "./subtitleTypes";
export * from "./subtitleParser";
export * from "./subtitleCleaner";
export * from "./subtitleMerger";
export * from "./subtitleConfig";
