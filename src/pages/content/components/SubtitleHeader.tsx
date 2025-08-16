import { memo, useState } from "react";
import { CardHeader, Divider, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SubtitleItem } from "@src/lib/subtitleTypes";
import { Dropdown, type DropdownItem } from "@src/components/ui";

interface SubtitleHeaderProps {
  subtitleCount: number;
  title?: string;
  subtitles: SubtitleItem[];
}

export const SubtitleHeader = memo(function SubtitleHeader({
  title = "Listen Up",
  subtitles,
}: SubtitleHeaderProps) {
  const [copyStatus, setCopyStatus] = useState(false);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const showCopySuccess = () => {
    setCopyStatus(true);
    setTimeout(() => {
      setCopyStatus(false);
    }, 1500);
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
      showCopySuccess();
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const handleCopyForLLM = async () => {
    try {
      const llmText = subtitles
        .map((subtitle) => {
          const startTime = formatTime(subtitle.startTime);
          const endTime = formatTime(subtitle.endTime);
          return `${startTime} - ${endTime}\n${subtitle.text}`;
        })
        .join("\n");

      await navigator.clipboard.writeText(llmText);
      console.log("已复制给大模型格式");
      showCopySuccess();
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  // 配置dropdown菜单项
  const dropdownItems: DropdownItem[] = [
    {
      key: "copy-all",
      label: "复制所有字幕",
      icon: "mdi:content-copy",
      onClick: handleCopyAllSubtitles,
    },
    {
      key: "copy-llm",
      label: "复制给大模型",
      icon: "mdi:robot",
      onClick: handleCopyForLLM,
    },
  ];

  return (
    <>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center w-full">
          <h3 className="text-base font-semibold">{title}</h3>
          <Dropdown
            items={dropdownItems}
            trigger={
              <Button
                size="sm"
                variant="flat"
                isDisabled={subtitles.length === 0}
                className="min-w-0"
              >
                {copyStatus ? (
                  <>
                    <Icon icon="mdi:check" className="w-4 h-4" />
                    已复制
                  </>
                ) : (
                  <>
                    复制
                    <Icon icon="mdi:chevron-down" className="w-4 h-4" />
                  </>
                )}
              </Button>
            }
          />
        </div>
      </CardHeader>
      <Divider />
    </>
  );
});
