import { Button, Card } from "@heroui/react";
import { FC, useEffect, useState } from "react";
import { youtubeSDK, YouTubeTheme } from "@src/lib/youtube-sdk";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  MaterialSymbolsSubtitlesGearOutlineSharp,
  MaterialSymbolsSubtitlesGearRounded,
} from "../icon";

export interface SubtitlesProps {}
const Subtitles: FC<SubtitlesProps> = () => {
  // 使用各种专门的hooks
  const [youtbeTheme, setYoutbeTheme] = useState<YouTubeTheme | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [headerHeig, setheaderHeig] = useState(0);
  useEffect(() => {
    const header = document.querySelector("#masthead");
    if (header) {
      setheaderHeig(header.clientHeight);
    }

    return () => {};
  }, []);

  useEffect(() => {
    youtubeSDK.start({
      onThemeChange: (theme) => {
        setYoutbeTheme(theme);
      },
      onAdStateChange: (adState) => {
        console.log(adState);
      },
      onPlayerStateChange: (playerState) => {
        console.log(playerState);
      },
    });
    return () => {
      youtubeSDK.stop();
    };
  }, []);
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
          top: headerHeig,
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
        <Card shadow="lg" className="h-full w-full"></Card>
      </motion.div>
      <div className="fixed bottom-8 right-6 z-30 ">
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
