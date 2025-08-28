import { Card } from "@heroui/react";
import { FC, useEffect, useState } from "react";
import { useYouTubeLayout } from "@src/hooks/useYouTubeLayout";
import { youtubeSDK, YouTubeTheme } from "@src/lib/youtube-sdk";

export interface SubtitlesProps {}
const Subtitles: FC<SubtitlesProps> = () => {
  // 使用各种专门的hooks
  const [youtbeTheme, setYoutbeTheme] = useState<YouTubeTheme | null>(null);
  const { videoHeight, containerRef, isPositioned } = useYouTubeLayout();

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
    <div
      ref={containerRef}
      className={`absolute w-[400px] ${
        youtbeTheme === "dark" ? "dark" : "light"
      }`}
      style={{
        opacity: isPositioned ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      <Card
        shadow="lg"
        style={{
          height: videoHeight > 0 ? `${videoHeight}px` : "400px",
          maxHeight: "80vh",
        }}
      ></Card>
    </div>
  );
};

export default Subtitles;
