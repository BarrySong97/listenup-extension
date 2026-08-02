/**
 * @purpose jotai 原子：广告播放状态、类型、文案、剩余时间与展示文本。
 * @role    全局 store，目前只被遗留的 PlayerStatusBadge 使用。
 * @deps    jotai
 * @gotcha  面板本身直接订阅 youtubeSDK，没走这些 atom；要扩全局状态前先确认是否真有必要
 */
import { atom } from 'jotai';

// Ad detection atoms
export const isAdPlayingAtom = atom<boolean>(false);
export const adTypeAtom = atom<'none' | 'skippable' | 'non-skippable' | 'overlay'>('none');
export const adTextAtom = atom<string>(''); // Ad text like "Ad 1 of 2"
export const adRemainingTimeAtom = atom<number>(0); // Remaining ad time in seconds

// Ad status text for display
export const adStatusTextAtom = atom((get) => {
  const isAd = get(isAdPlayingAtom);
  
  if (!isAd) {
    return '✅ No Ad';
  }
  
  const adType = get(adTypeAtom);
  const adText = get(adTextAtom);
  const adRemaining = get(adRemainingTimeAtom);
  
  let statusText = '🎬 ';
  
  if (adText) {
    statusText += adText;
  } else {
    statusText += 'Ad';
  }
  
  if (adType === 'skippable') {
    statusText += ' (Skip)';
  }
  
  if (adRemaining > 0) {
    statusText += ` - ${adRemaining}s`;
  }
  
  return statusText;
});