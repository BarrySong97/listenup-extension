import { Button, Card } from "@heroui/react";
import { FC, useEffect, useState } from "react";
import { useYouTubeLayout } from "@src/hooks/useYouTubeLayout";
import { youtubeSDK, YouTubeTheme } from "@src/lib/youtube-sdk";
import { motion, AnimatePresence } from "framer-motion";

export interface SubtitlesProps {}
const Subtitles: FC<SubtitlesProps> = () => {
  // 使用各种专门的hooks
  const [youtbeTheme, setYoutbeTheme] = useState<YouTubeTheme | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="listenup"
            className={`${youtbeTheme === "dark" ? "dark" : "light"}`}
            style={{
              height: "774px",
              width: "454px",
              display: "block",
              zIndex: 100,
              position: "fixed",
              top: 0,
              right: 0,
            }}
            initial={{ opacity: 0, x: 454 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 454 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.3,
            }}
          >
            <Card shadow="lg"></Card>
          </motion.div>
        )}
      </AnimatePresence>
      <Button
        className="absolute top-20 left-0 right-0 z-30"
        onPressStart={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "Close" : "Open"}
      </Button>
    </div>
  );
};

export default Subtitles;
