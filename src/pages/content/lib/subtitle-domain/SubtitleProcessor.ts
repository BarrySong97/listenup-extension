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

