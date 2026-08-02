/**
 * @purpose 调试用的广告状态徽章，读 jotai 里的广告 atom 渲染一行状态。
 * @role    当前**没有任何地方引用**，属于遗留组件。
 * @deps    jotai、store/playerMonitor、@heroui/react
 * @gotcha  它 import 的 @src/hooks/useYouTubePlayerMonitor 已不存在，直接引用会编译失败；要用先补回那个 hook 或改写
 */
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