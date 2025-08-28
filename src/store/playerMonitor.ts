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