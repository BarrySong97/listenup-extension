import { memo } from "react";
import { CardHeader, Chip, Divider, Button } from "@heroui/react";
import { SubtitleItem } from "@src/lib/subtitleTypes";

interface SubtitleHeaderProps {
  subtitleCount: number;
  title?: string;
  subtitles: SubtitleItem[];
}

export const SubtitleHeader = memo(function SubtitleHeader({
  subtitleCount,
  title = "Listen Up",
  subtitles,
}: SubtitleHeaderProps) {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleCopyAllSubtitles = async () => {
    try {
      const allSubtitlesText = subtitles
        .map((subtitle) => {
          const startTime = formatTime(subtitle.startTime);
          const endTime = formatTime(subtitle.endTime);
          return `${startTime} - ${endTime}\n${subtitle.text}`;
        })
        .join("\n\n");
      
      await navigator.clipboard.writeText(allSubtitlesText);
      console.log("已复制所有字幕内容");
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  return (
    <>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center w-full">
          <h3 className="text-base font-semibold">
            {title}
          </h3>
          <Button 
            size="sm" 
            variant="flat" 
            onPressStart={handleCopyAllSubtitles}
            isDisabled={subtitles.length === 0}
          >
            复制全部
          </Button>
        </div>
      </CardHeader>
      <Divider />
    </>
  );
});
