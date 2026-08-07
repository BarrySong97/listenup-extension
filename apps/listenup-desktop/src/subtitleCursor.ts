/**
 * @purpose 把实时 cursor 映射为 Desktop 当前字幕与已播放边界。
 * @role    App 与 SubtitleList 之间的纯计算层，隔离高频时间更新和低频列表渲染。
 * @deps    ./types
 * @gotcha  只有当前列表确认来自 live 原语 session 时才能信任 cursor.currentIndex。
 */
import type { CursorState } from "./types";

export interface TimedSubtitleBlock {
  startTime: number;
  endTime: number;
}

export interface SubtitleCursorPresentation {
  activeIndex: number;
  playedThroughIndex: number;
}

const findLastIndexAtOrBefore = (
  blocks: readonly TimedSubtitleBlock[],
  value: number,
  selectTime: (block: TimedSubtitleBlock) => number
) => {
  let low = 0;
  let high = blocks.length - 1;
  let result = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (selectTime(blocks[middle]) <= value) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
};

export const findSubtitleIndexAtTime = (
  blocks: readonly TimedSubtitleBlock[],
  currentTime: number
) => {
  const candidate = findLastIndexAtOrBefore(
    blocks,
    currentTime,
    (block) => block.startTime
  );
  if (candidate < 0) return -1;

  // 相邻字幕偶尔会重叠。先退到仍覆盖当前时间的最早相邻块，保持 Desktop
  // 原先 findIndex 的“前一条优先”语义，同时让常见非重叠数据保持 O(log n)。
  let firstCandidate = candidate;
  while (
    firstCandidate > 0 &&
    blocks[firstCandidate - 1].endTime > currentTime
  ) {
    firstCandidate -= 1;
  }
  for (let index = firstCandidate; index <= candidate; index += 1) {
    const block = blocks[index];
    if (currentTime >= block.startTime && currentTime < block.endTime) {
      return index;
    }
  }
  return -1;
};

export const resolveSubtitleCursorPresentation = (
  blocks: readonly TimedSubtitleBlock[],
  cursor: CursorState | null,
  preferLiveSourceIndex: boolean
): SubtitleCursorPresentation => {
  if (!cursor || blocks.length === 0) {
    return { activeIndex: -1, playedThroughIndex: -1 };
  }

  const liveIndexIsValid =
    preferLiveSourceIndex &&
    Number.isInteger(cursor.currentIndex) &&
    cursor.currentIndex >= -1 &&
    cursor.currentIndex < blocks.length;
  const activeIndex = liveIndexIsValid
    ? cursor.currentIndex
    : findSubtitleIndexAtTime(blocks, cursor.currentTime);
  const timedPlayedThroughIndex = findLastIndexAtOrBefore(
    blocks,
    cursor.currentTime,
    (block) => block.endTime
  );
  const playedThroughIndex =
    liveIndexIsValid && activeIndex >= 0
      ? Math.max(timedPlayedThroughIndex, activeIndex - 1)
      : timedPlayedThroughIndex;

  return { activeIndex, playedThroughIndex };
};
