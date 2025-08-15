import { memo } from "react";
import { CardHeader, Chip, Divider } from "@heroui/react";

interface SubtitleHeaderProps {
  subtitleCount: number;
  title?: string;
}

export const SubtitleHeader = memo(function SubtitleHeader({
  subtitleCount,
  title = "Listen Up",
}: SubtitleHeaderProps) {
  return (
    <>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-semibold ">{title}</h3>
          </div>
        </div>
      </CardHeader>
      <Divider />
    </>
  );
});
