import { Button, Card } from "@heroui/react";
import { FC, useEffect, useRef, useState } from "react";
import { YouTubeSDK, youtubeSDK, YouTubeTheme } from "@src/lib/youtube-sdk";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  MaterialSymbolsSubtitlesGearOutlineSharp,
  MaterialSymbolsSubtitlesGearRounded,
} from "../icon";
import { SubtitleStates } from "./SubtitleStates";

export interface SubtitlesProps {}
const Subtitles: FC<SubtitlesProps> = () => {
  // 使用各种专门的hooks
  const [youtbeTheme, setYoutbeTheme] = useState<YouTubeTheme | null>(null);
  const [isSubtitleEmpty, setIsSubtitleEmpty] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [headerHeight, setheaderHeig] = useState(0);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const YoutubeSDK = useRef<YouTubeSDK>(youtubeSDK);

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
    });
    return () => {
      youtubeSDK.stop();
    };
  }, []);

  // 获取字幕
  useEffect(() => {
    if (isAdPlaying) {
      return;
    }
    const subtitle = YoutubeSDK.current.getSubtitleData();
    // 找到第一个为en的字幕，或者en-US的字幕

    const enSubtitle = subtitle.subtitles.find(
      (item) => item.languageCode === "en" || item.languageCode === "en-US"
    );
    if (!subtitle.available) {
      setIsSubtitleEmpty(true);
    }
  }, [isAdPlaying]);

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
            error="error"
            isEmpty={isSubtitleEmpty}
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
