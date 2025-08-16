import { memo } from "react";
import { CardHeader, Chip, Divider, Button } from "@heroui/react";

interface SubtitleHeaderProps {
  subtitleCount: number;
  title?: string;
}

export const SubtitleHeader = memo(function SubtitleHeader({
  subtitleCount,
  title = "Listen Up",
}: SubtitleHeaderProps) {
  const handleOpenPanel = () => {
    console.log(44444);
    try {
      chrome.runtime.sendMessage({ action: "openSidePanel" });
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <h3
              onClick={() => {
                handleOpenPanel();
              }}
              className="text-base font-semibold "
            >
              {title}
            </h3>
            <div onClick={handleOpenPanel}>
              <Button size="md" variant="flat" onPressStart={handleOpenPanel}>
                打开面板
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <Divider />
    </>
  );
});
