/**
 * @purpose 面板头部：标题、折叠、整段复制/下载、麦克风选择与设置菜单入口。
 * @role    SubtitlePanelShell 的顶部区域。
 * @deps    components/ui 的 Dropdown、react-i18next、src/i18n、hooks/useAudioInputLevel、lib/subtitle-domain/subtitleDebug
 * @gotcha  下拉必须用自建 Dropdown；麦克风电平只在菜单展开时采样。见 docs/modules/extension/faq.md
 */
import { memo, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@heroui/react";
import { iconScale } from "@src/components/ui/iconScale";
import { Dropdown, type DropdownItem } from "@src/components/ui";
import { subtitleDebug } from "../lib/subtitle-domain/subtitleDebug";
import { SubtitleItem } from "../lib/subtitles/subtitleTypes";
import { useAudioInputLevel } from "../hooks/useAudioInputLevel";
import { useTranslation } from "react-i18next";
import { changeUiLanguage, normalizeUiLanguage } from "@src/i18n";

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
  onOpenAiSettings: () => void;
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
  onOpenAiSettings,
}: SubtitleHeaderProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = normalizeUiLanguage(i18n.resolvedLanguage);
  const [copyStatus, setCopyStatus] = useState(false);
  const [exportStatus, setExportStatus] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { level: audioInputLevel } = useAudioInputLevel(
    selectedAudioInputId,
    isMenuOpen
  );

  const renderAudioLevelMeter = useMemo(() => {
    return () => (
      <span className="ml-1.5 flex h-4 w-10 items-center rounded-full bg-zinc-200/80 px-1">
        <span
          className="h-2 rounded-full bg-emerald-500 transition-[width] duration-100"
          style={{
            width: `${Math.max(10, Math.round(audioInputLevel * 100))}%`,
            opacity: audioInputLevel > 0.02 ? 1 : 0.35,
          }}
        />
      </span>
    );
  }, [audioInputLevel]);

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
      label: t("header.microphone"),
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
              label: t("header.retryMicrophones"),
              icon: "mdi:refresh",
              onClick: onRefreshAudioInputs,
            },
          ]
        : [
        {
          key: "audio-input-default",
          label: `${t("header.systemDefault")}${
            selectedAudioInputId ? "" : ` · ${t("header.selected")}`
          }`,
          icon: "mdi:tune-vertical",
          isSelected: !selectedAudioInputId,
          renderEnd: !selectedAudioInputId ? renderAudioLevelMeter : undefined,
          onClick: () => onSelectAudioInput(""),
        },
        ...audioInputDevices.map((device, index) => ({
          key: `audio-input-${device.deviceId}`,
          label: `${device.label || t("header.microphoneNumber", { number: index + 1 })}${
            selectedAudioInputId === device.deviceId ? ` · ${t("header.selected")}` : ""
          }`,
          icon: "mdi:microphone-outline",
          isSelected: selectedAudioInputId === device.deviceId,
          renderEnd:
            selectedAudioInputId === device.deviceId ? renderAudioLevelMeter : undefined,
          onClick: () => onSelectAudioInput(device.deviceId),
        })),
        {
          key: "audio-input-refresh",
          label: t("header.refreshDevices", { device: selectedAudioInputLabel }),
          icon: "mdi:refresh",
          onClick: onRefreshAudioInputs,
        },
      ],
    },
    {
      key: "ai-settings",
      label: t("header.aiSettings"),
      icon: "mdi:robot-outline",
      onClick: onOpenAiSettings,
    },
    {
      key: "export-logs",
      label: exportStatus ? t("header.logsExported") : t("header.exportLogs"),
      icon: exportStatus ? "mdi:check" : "mdi:format-list-bulleted",
      onClick: handleExportLogs,
    },
    {
      key: "language",
      label: t("common.language"),
      icon: "mdi:translate",
      items: [
        {
          key: "language-en",
          label: t("common.english"),
          isSelected: currentLanguage === "en",
          onClick: () => void changeUiLanguage("en"),
        },
        {
          key: "language-zh-cn",
          label: t("common.chinese"),
          isSelected: currentLanguage === "zh-CN",
          onClick: () => void changeUiLanguage("zh-CN"),
        },
      ],
    },
  ];

  const copyDropdownItems: DropdownItem[] = [
    {
      key: "copy-all",
      label: t("header.copyAll"),
      icon: "mdi:content-copy",
      onClick: handleCopyAllSubtitles,
    },
    {
      key: "copy-llm",
      label: t("header.copyForLlm"),
      icon: "mdi:robot-outline",
      onClick: handleCopyForLLM,
    },
  ];

  const downloadDropdownItems: DropdownItem[] = [
    {
      key: "download-srt",
      label: t("header.downloadSrt"),
      icon: "mdi:file-video-outline",
      onClick: handleDownloadSRT,
    },
    {
      key: "download-txt",
      label: t("header.downloadTxt"),
      icon: "mdi:file-document-outline",
      onClick: handleDownloadTXT,
    },
  ];

  return (
    <div className="sticky top-0 z-20 border-b border-zinc-100 bg-white/95 px-3 py-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-600">
              <Icon
                icon="mdi:subtitles-outline"
                className={`${iconScale.brand} text-white`}
              />
            </div>
            <div className="truncate text-sm font-semibold tracking-tight text-zinc-900">
              {title}
            </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Dropdown
            items={menuDropdownItems}
            menuClassName="min-w-40"
            onOpenChange={setIsMenuOpen}
            trigger={
              <Button
                isIconOnly
                size="md"
                variant="light"
                className={actionButtonClassName}
                aria-label={t("header.moreActions")}
                title={t("header.settings")}
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
                aria-label={t("header.downloadSubtitles")}
                title={t("header.download")}
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
                aria-label={t("header.copySubtitles")}
                title={t("common.copy")}
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
            aria-label={isCollapsed ? t("header.expandPanel") : t("header.collapsePanel")}
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
