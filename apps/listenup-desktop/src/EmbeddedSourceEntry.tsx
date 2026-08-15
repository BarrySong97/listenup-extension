/**
 * @purpose 在无权威来源时同时呈现浏览器自动接入与 Desktop 链接播放入口。
 * @role    main 字幕区空态；本地校验通过后才调用 start_embedded_playback。
 * @deps    @tauri-apps/api/core、react-i18next、HeroUI wrappers、embeddedPlayback
 * @gotcha  校验失败不能调用 Rust，因此不会暂停浏览器或建立 Embedded 锁。
 */
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopTextField } from "./components/ui/DesktopTextField";
import { normalizeYoutubeWatchUrl, YoutubeLinkError } from "./embeddedPlayback";

interface EmbeddedSourceEntryProps {
  awaitingBrowserPlayback: boolean;
  browserConnected: boolean;
}

export const EmbeddedSourceEntry = ({
  awaitingBrowserPlayback,
  browserConnected,
}: EmbeddedSourceEntryProps) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeYoutubeWatchUrl(url);
    } catch (cause) {
      setError(
        cause instanceof YoutubeLinkError
          ? t(`linkValidation.${cause.code}`)
          : t("sourceEntry.invalidLink")
      );
      return;
    }
    setStarting(true);
    try {
      await invoke("start_embedded_playback", { url: normalizedUrl });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(false);
    }
  }, [t, url]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[340px] flex-col justify-center gap-4 px-5 py-8">
      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <Icon icon="mdi:google-chrome" className="h-4 w-4 text-sky-300" />
          {t("sourceEntry.browserTitle")}
        </div>
        <p className="mb-0 mt-2 text-[11px] leading-relaxed text-fg-muted">
          {awaitingBrowserPlayback
            ? t("sourceEntry.exitedDescription")
            : browserConnected
              ? t("sourceEntry.connectedDescription")
              : t("sourceEntry.disconnectedDescription")}
        </p>
      </div>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-fg-faint">
        <span className="h-px flex-1 bg-white/10" />{t("sourceEntry.or")}<span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <Icon icon="mdi:play-box-outline" className="h-4 w-4 text-red-400" />
          {t("sourceEntry.desktopTitle")}
        </div>
        <p className="mb-3 mt-2 text-[11px] leading-relaxed text-fg-muted">
          {t("sourceEntry.desktopDescription")}
        </p>
        <div className="flex gap-2">
          <DesktopTextField
            aria-label={t("sourceEntry.linkLabel")}
            placeholder="https://youtu.be/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void start();
            }}
            className="h-9 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-[11px] text-fg placeholder:text-fg-faint"
          />
          <DesktopButton
            className="h-9 cursor-pointer rounded-lg bg-red-500 px-3 text-[11px] font-semibold text-white hover:bg-red-400 disabled:cursor-wait disabled:opacity-50"
            isDisabled={starting}
            onPress={() => void start()}
          >
            {starting ? t("sourceEntry.starting") : t("common.play")}
          </DesktopButton>
        </div>
        {error && <p className="mb-0 mt-2 text-[10px] text-red-300">{error}</p>}
      </div>
    </div>
  );
};
