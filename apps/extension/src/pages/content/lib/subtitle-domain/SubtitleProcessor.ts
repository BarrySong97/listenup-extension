/**
 * @purpose 读取清洗/合并配置、算配置指纹、调用纯处理逻辑。
 * @role    SubtitleRepository 与 subtitles 纯逻辑层之间的适配。
 * @deps    subtitles/{subtitleConfig,subtitleCleaner,subtitleMerger}
 * @gotcha  configHash 参与缓存键：处理配置变了缓存要自动失效，改结构记得同步
 */
import { subtitleConfig } from "../subtitles/subtitleConfig";
import { SubtitleCleaner } from "../subtitles/subtitleCleaner";
import { SubtitleMerger } from "../subtitles/subtitleMerger";
import { SubtitleItem } from "../subtitles/subtitleTypes";

export const getSubtitleProcessingConfig = () => ({
  clean: subtitleConfig.getCleanConfig(),
  merge: subtitleConfig.getMergeConfig(),
});

export const createConfigHash = (config: ReturnType<
  typeof getSubtitleProcessingConfig
>) =>
  JSON.stringify(config);

export const processSubtitles = (
  rawSubtitles: SubtitleItem[],
  config: ReturnType<typeof getSubtitleProcessingConfig>
): SubtitleItem[] => {
  const cleaner = new SubtitleCleaner(config.clean);
  const merger = new SubtitleMerger(config.merge);

  const cleaned = cleaner.cleanSubtitles(rawSubtitles);
  return merger.mergeSubtitles(cleaned);
};

