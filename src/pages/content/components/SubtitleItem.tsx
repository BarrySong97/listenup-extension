import { memo } from "react";
import { SubtitleItem } from "@src/lib/subtitleTypes";

interface SubtitleItemProps {
  subtitle: SubtitleItem;
  isActive: boolean;
  onSubtitleClick?: (startTime: number) => void;
}

export const SubtitleItemComponent = memo(function SubtitleItem({
  subtitle,
  isActive,
  onSubtitleClick,
}: SubtitleItemProps) {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      className={`
        p-4 rounded-lg cursor-pointer transition-all duration-200 
        hover:bg-default-100 border
        ${
          isActive
            ? "bg-primary-50 border-primary shadow-sm"
            : "bg-content1 border-transparent hover:border-default-200"
        }
      `}
      onClick={() => onSubtitleClick?.(subtitle.startTime)}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`text-sm font-mono shrink-0 `}>
          {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-base leading-relaxed `}>{subtitle.text}</p>
        </div>
      </div>
    </div>
  );
});
