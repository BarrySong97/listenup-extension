/**
 * @purpose 把持久译文句段合并为 viewer 语义块。
 * @role    main 与 player-ui 共用的翻译展示适配器。
 * @deps    useSubtitleView、SubtitleList DisplayBlock
 * @gotcha  只合并时间和 sourceText 完全相同的连续拆分译句，不能跨原句重排。
 */
import type { DisplayBlock } from "./SubtitleList";
import type { useSubtitleView } from "./useSubtitleView";

export const groupTranslationBlocks = (
  segments: NonNullable<ReturnType<typeof useSubtitleView>["data"]>["translation"]
): DisplayBlock[] => {
  if (!segments) return [];
  const blocks: DisplayBlock[] = [];
  for (const segment of segments.segments) {
    const startTime = segment.startTimeMs / 1000;
    const endTime = segment.endTimeMs / 1000;
    const previous = blocks.at(-1);
    if (
      previous &&
      previous.startTime === startTime &&
      previous.endTime === endTime &&
      previous.sourceText === segment.sourceText
    ) {
      previous.translationText = [previous.translationText, segment.text]
        .filter(Boolean)
        .join("\n");
      continue;
    }
    blocks.push({
      id: segment.id,
      startTime,
      endTime,
      sourceText: segment.sourceText,
      translationText: segment.text,
    });
  }
  return blocks;
};
