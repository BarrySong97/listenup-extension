import { FC } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";

interface PlaybackDividerProps {
  isPlaying: boolean;
  onTogglePlayback: () => void;
}

export const PlaybackDivider: FC<PlaybackDividerProps> = ({
  isPlaying,
  onTogglePlayback,
}) => {
  return (
    <div className="shrink-0 border-t border-zinc-200 bg-white px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <Button
          size="md"
          radius="full"
          variant="solid"
          color="default"
          startContent={
            <Icon
              icon={isPlaying ? "mdi:pause" : "mdi:play"}
              className={iconScale.primaryControl}
            />
          }
          className="h-10 min-w-[8.5rem] bg-zinc-900 px-5 text-white hover:bg-black"
          onPressStart={onTogglePlayback}
        >
          <span className="text-sm font-semibold">
            {isPlaying ? "Pause" : "Play"}
          </span>
        </Button>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
    </div>
  );
};
