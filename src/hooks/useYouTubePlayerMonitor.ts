import { useEffect } from "react";
import { useSetAtom } from "jotai";
import {
  isAdPlayingAtom,
  adTypeAtom,
  adTextAtom,
  adRemainingTimeAtom,
} from "@src/store/playerMonitor";
import { youtubeSDK } from "@src/lib/youtube-sdk";

/**
 * React hook for YouTube ad monitoring using the YouTube SDK
 */
export const useYouTubePlayerMonitor = () => {
  const setIsAdPlaying = useSetAtom(isAdPlayingAtom);
  const setAdType = useSetAtom(adTypeAtom);
  const setAdText = useSetAtom(adTextAtom);
  const setAdRemainingTime = useSetAtom(adRemainingTimeAtom);

  useEffect(() => {
    // Start monitoring with ad state callback
    youtubeSDK.start({
      onAdStateChange: (state) => {
        setIsAdPlaying(state.isAdPlaying);
        setAdType(state.adType);
        setAdText(state.adText);
        setAdRemainingTime(state.adRemainingTime);
      },
      // We can also monitor player state if needed
      onPlayerStateChange: (state) => {
        // Log for debugging
        console.log('Player state:', {
          available: state.isVideoAvailable,
          time: `${state.currentTime}/${state.duration}`,
          paused: state.isPaused
        });
      }
    });

    // Cleanup
    return () => {
      youtubeSDK.stop();
    };
  }, [setIsAdPlaying, setAdType, setAdText, setAdRemainingTime]);
};
