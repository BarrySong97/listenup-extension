import { Button, Card } from "@heroui/react";
import { FC, useEffect, useRef, useState } from "react";
import {
  YouTubeSDK,
  youtubeSDK,
  YouTubeTheme,
} from "@pages/content/lib/youtube-sdk";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  MaterialSymbolsSubtitlesGearOutlineSharp,
  MaterialSymbolsSubtitlesGearRounded,
} from "../icon";
import { SubtitleStates } from "./SubtitleStates";
import { useSubtitleContent } from "../hooks/useSubtitleContent";
import { useSubtitleSync } from "../hooks/useSubtitleSync";
type CaptionMessage = {
  type: "YT_CAPTION_URL";
  url: string | null;
};

export interface SubtitlesProps {}
const Subtitles: FC<SubtitlesProps> = () => {
  // 使用各种专门的hooks
  const [youtbeTheme, setYoutbeTheme] = useState<YouTubeTheme | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [headerHeight, setheaderHeig] = useState(0);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const YoutubeSDK = useRef<YouTubeSDK>(youtubeSDK);
  const [url, setUrl] = useState<string | undefined>(undefined);
  const { subtitles, loading, error } = useSubtitleContent(url);
  const { currentSubtitleIndex, setCurrentTime } = useSubtitleSync(subtitles);
  // 获取header高度
  useEffect(() => {
    const header = document.querySelector("#masthead");
    if (header) {
      setheaderHeig(header.clientHeight);
    }

    return () => {};
  }, []);

  // 初始化YoutubeSDK
  useEffect(() => {
    YoutubeSDK.current.start({
      onThemeChange: (theme) => {
        setYoutbeTheme(theme);
      },
      onAdStateChange: (adState) => {
        setIsAdPlaying(adState.isAdPlaying);
      },
      onPlayerStateChange: (playerState) => {
        setCurrentTime(playerState.currentTime);
      },
    });
    return () => {
      youtubeSDK.stop();
    };
  }, []);

  // 获取字幕
  useEffect(() => {
    if (isAdPlaying || subtitles.length > 0) {
      return;
    }

    YoutubeSDK.current.getSubtitleUrl("en").then((res) => {
      if (res) {
        setUrl(res);
      }
    });
    // 找到第一个为en的字幕，或者en-US的字幕
  }, [isAdPlaying, subtitles]);

  const variant = {
    initial: { x: 480 },
    animate: { x: 0 },
    exit: { x: 480 },
  };

  return (
    <div className={`${youtbeTheme === "dark" ? "dark" : "light"}`}>
      <motion.div
        id="listenup"
        style={{
          height: "774px",
          width: "454px",
          top: headerHeight + 24,
          display: "block",
          zIndex: 9999,
          position: "fixed",
          right: 16,
        }}
        initial="initial"
        animate={isOpen ? "animate" : "exit"}
        variants={variant}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          duration: 0.3,
        }}
      >
        <Card shadow="lg" className="h-full w-full">
          <SubtitleStates
            isAd={isAdPlaying}
            error={error}
            loading={loading}
            isEmpty={subtitles.length === 0}
          />
        </Card>
      </motion.div>
      <div className="fixed bottom-4 right-6 z-30 ">
        <Button
          radius="full"
          isIconOnly
          onPressStart={() => setIsOpen(!isOpen)}
          color="primary"
        >
          {isOpen ? (
            <MaterialSymbolsSubtitlesGearOutlineSharp />
          ) : (
            <MaterialSymbolsSubtitlesGearRounded />
          )}
        </Button>
      </div>
    </div>
  );
};

export default Subtitles;
