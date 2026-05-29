import { FC } from 'react';
import { useAtomValue } from 'jotai';
import { Chip } from '@heroui/react';
import {
  adStatusTextAtom,
  isAdPlayingAtom
} from '@src/store/playerMonitor';
import { useYouTubePlayerMonitor } from '@src/hooks/useYouTubePlayerMonitor';

export const PlayerStatusBadge: FC = () => {
  // Initialize the monitor
  useYouTubePlayerMonitor();
  
  // Get ad state
  const adStatusText = useAtomValue(adStatusTextAtom);
  const isAdPlaying = useAtomValue(isAdPlayingAtom);
  
  return (
    <div className="px-4 py-2 border-b border-divider">
      <Chip
        size="sm"
        color={isAdPlaying ? 'warning' : 'success'}
        variant="flat"
      >
        {adStatusText}
      </Chip>
    </div>
  );
};