import { memo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@heroui/react";
import { iconScale } from "@src/components/ui/iconScale";
import { Dropdown, type DropdownItem } from "@src/components/ui";
import { subtitleDebug } from "../lib/subtitle-domain/subtitleDebug";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";

interface SubtitleHeaderProps {
  title?: string;
  subtitles: SubtitleItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  audioInputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedAudioInputLabel: string;
  audioInputError: string | null;
  onSelectAudioInput: (deviceId: string) => void;
  onRefreshAudioInputs: () => void;
}

const actionButtonClassName =
  "h-9 w-9 min-w-0 rounded-md p-0 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 data-[hover=true]:bg-zinc-100 data-[hover=true]:text-zinc-900";

export const SubtitleHeader = memo(function SubtitleHeader({
  title = "Listen Up",
  subtitles,
  isCollapsed,
  onToggleCollapse,
  audioInputDevices,
  selectedAudioInputId,
  selectedAudioInputLabel,
  audioInputError,
  onSelectAudioInput,
  onRefreshAudioInputs,
}: SubtitleHeaderProps) {
  const [copyStatus, setCopyStatus] = useState(false);
  const [exportStatus, setExportStatus] = useState(false);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const showCopySuccess = () => {
    setCopyStatus(true);
    window.setTimeout(() => {
      setCopyStatus(false);
    }, 1500);
  };

  const showExportSuccess = () => {
    setExportStatus(true);
    window.setTimeout(() => {
      setExportStatus(false);
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
      showCopySuccess();
    } catch (error) {
      console.error("Copy failed:", error);
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
      showCopySuccess();
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const formatTimeToSRT = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const milliseconds = Math.floor((secs % 1) * 1000);
    const wholeSeconds = Math.floor(secs);

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${wholeSeconds
      .toString()
      .padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
  };

  const handleDownloadSRT = () => {
    try {
      const srtContent = subtitles
        .map((subtitle, index) => {
          const startTime = formatTimeToSRT(subtitle.startTime);
          const endTime = formatTimeToSRT(subtitle.endTime);
          return `${index + 1}\n${startTime} --> ${endTime}\n${
            subtitle.text
          }\n`;
        })
        .join("\n");

      const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `subtitles_${new Date().getTime()}.srt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("SRT download failed:", error);
    }
  };

  const handleDownloadTXT = () => {
    try {
      const txtContent = subtitles
        .map((subtitle) => {
          const startTime = formatTime(subtitle.startTime);
          const endTime = formatTime(subtitle.endTime);
          return `${startTime} - ${endTime}\n${subtitle.text}`;
        })
        .join("\n\n");

      const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `subtitles_${new Date().getTime()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("TXT download failed:", error);
    }
  };

  const handleExportLogs = () => {
    subtitleDebug.exportLogs();
    showExportSuccess();
  };

  const menuDropdownItems: DropdownItem[] = [
    {
      key: "audio-inputs",
      label: "Microphone",
      icon: "mdi:microphone-outline",
      items: audioInputError
        ? [
            {
              key: "audio-input-error",
              label: audioInputError,
              icon: "mdi:alert-circle-outline",
              isDisabled: true,
            },
            {
              key: "audio-input-refresh",
              label: "Retry microphone list",
              icon: "mdi:refresh",
              onClick: onRefreshAudioInputs,
            },
          ]
        : [
        {
          key: "audio-input-default",
          label: `System default${selectedAudioInputId ? "" : " · Selected"}`,
          icon: "mdi:tune-vertical",
          isSelected: !selectedAudioInputId,
          onClick: () => onSelectAudioInput(""),
        },
        ...audioInputDevices.map((device, index) => ({
          key: `audio-input-${device.deviceId}`,
          label: `${device.label || `Microphone ${index + 1}`}${
            selectedAudioInputId === device.deviceId ? " · Selected" : ""
          }`,
          icon: "mdi:microphone-outline",
          isSelected: selectedAudioInputId === device.deviceId,
          onClick: () => onSelectAudioInput(device.deviceId),
        })),
        {
          key: "audio-input-refresh",
          label: `Refresh devices · ${selectedAudioInputLabel}`,
          icon: "mdi:refresh",
          onClick: onRefreshAudioInputs,
        },
      ],
    },
    {
      key: "export-logs",
      label: exportStatus ? "Logs exported" : "Export logs",
      icon: exportStatus ? "mdi:check" : "mdi:format-list-bulleted",
      onClick: handleExportLogs,
    },
  ];

  const copyDropdownItems: DropdownItem[] = [
    {
      key: "copy-all",
      label: "Copy all subtitles",
      icon: "mdi:content-copy",
      onClick: handleCopyAllSubtitles,
    },
    {
      key: "copy-llm",
      label: "Copy for LLM",
      icon: "mdi:robot-outline",
      onClick: handleCopyForLLM,
    },
  ];

  const downloadDropdownItems: DropdownItem[] = [
    {
      key: "download-srt",
      label: "Download SRT",
      icon: "mdi:file-video-outline",
      onClick: handleDownloadSRT,
    },
    {
      key: "download-txt",
      label: "Download TXT",
      icon: "mdi:file-document-outline",
      onClick: handleDownloadTXT,
    },
  ];

  return (
    <div className="sticky top-0 z-20 border-b border-zinc-100 bg-white/95 px-3 py-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600">
            <Icon icon="mdi:waveform" className={`${iconScale.brand} text-white`} />
          </div>
          <div className="truncate text-sm font-semibold tracking-tight text-zinc-900">
            {title}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Dropdown
            items={menuDropdownItems}
            menuClassName="min-w-40"
            trigger={
              <Button
                isIconOnly
                size="md"
                variant="light"
                className={actionButtonClassName}
                aria-label="More actions"
                title="Settings"
              >
                <Icon
                  icon="mdi:cog-outline"
                  className={iconScale.headerAction}
                />
              </Button>
            }
          />
          <Dropdown
            items={downloadDropdownItems}
            menuClassName="min-w-44"
            trigger={
              <Button
                isIconOnly
                size="md"
                variant="light"
                className={actionButtonClassName}
                aria-label="Download subtitles"
                title="Download"
              >
                <Icon
                  icon="mdi:download-outline"
                  className={iconScale.headerAction}
                />
              </Button>
            }
          />
          <Dropdown
            items={copyDropdownItems}
            menuClassName="min-w-44"
            trigger={
              <Button
                isIconOnly
                size="md"
                variant="light"
                className={`${actionButtonClassName} ${
                  copyStatus ? "text-blue-600" : ""
                }`}
                aria-label="Copy subtitles"
                title="Copy"
              >
                <Icon
                  icon={copyStatus ? "mdi:check" : "mdi:content-copy"}
                  className={iconScale.headerAction}
                />
              </Button>
            }
          />
          <div className="mx-1 h-4 w-px bg-zinc-200" />
          <Button
            isIconOnly
            size="md"
            variant="light"
            className={actionButtonClassName}
            aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
            onPressStart={onToggleCollapse}
          >
            <Icon
              icon="mdi:chevron-up"
              className={`${iconScale.headerAction} transition-transform duration-200 ${
                isCollapsed ? "rotate-180" : ""
              }`}
            />
          </Button>
        </div>
      </div>
    </div>
  );
});
