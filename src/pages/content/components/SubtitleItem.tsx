import { memo } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SubtitleItem } from "@src/lib/subtitleTypes";

interface SubtitleItemProps {
  subtitle: SubtitleItem;
  isActive: boolean;
  onSubtitleClick?: (subtitle: SubtitleItem, index: number) => void;
  index: number;
}

export const SubtitleItemComponent = memo(function SubtitleItem({
  subtitle,
  isActive,
  onSubtitleClick,
  index,
}: SubtitleItemProps) {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleCopySubtitle = async () => {
    try {
      const timeText = `${formatTime(subtitle.startTime)} - ${formatTime(subtitle.endTime)}`;
      const copyText = `${timeText}\n${subtitle.text}`;
      
      await navigator.clipboard.writeText(copyText);
      console.log("已复制字幕:", copyText);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  return (
    <div
      className={`
        group p-4 rounded-lg cursor-pointer transition-all duration-200 
        hover:bg-default-100 border
        ${
          isActive
            ? "bg-primary-50 border-primary shadow-sm"
            : "bg-content1 border-transparent hover:border-default-200"
        }
      `}
      onClick={() => onSubtitleClick?.(subtitle, index)}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`text-xs font-mono shrink-0 select-none`}>
          {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed `}>{subtitle.text}</p>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
          onPressStart={handleCopySubtitle}
        >
          <Icon icon="mdi:content-copy" className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});
