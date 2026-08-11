/**
 * @purpose 在无权威来源时同时呈现浏览器自动接入与 Desktop 链接播放入口。
 * @role    main 字幕区空态；本地校验通过后才调用 start_embedded_playback。
 * @deps    @tauri-apps/api/core、HeroUI wrappers、embeddedPlayback
 * @gotcha  校验失败不能调用 Rust，因此不会暂停浏览器或建立 Embedded 锁。
 */
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopTextField } from "./components/ui/DesktopTextField";
import { normalizeYoutubeWatchUrl } from "./embeddedPlayback";

interface EmbeddedSourceEntryProps {
  awaitingBrowserPlayback: boolean;
  browserConnected: boolean;
}

export const EmbeddedSourceEntry = ({
  awaitingBrowserPlayback,
  browserConnected,
}: EmbeddedSourceEntryProps) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeYoutubeWatchUrl(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "YouTube 链接无效");
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
  }, [url]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[340px] flex-col justify-center gap-4 px-5 py-8">
      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <Icon icon="mdi:google-chrome" className="h-4 w-4 text-sky-300" />
          连接浏览器播放
        </div>
        <p className="mb-0 mt-2 text-[11px] leading-relaxed text-fg-muted">
          {awaitingBrowserPlayback
            ? "已退出 Desktop 播放。等待你下一次手动播放、换视频或自动连播后重新接入。"
            : browserConnected
              ? "浏览器扩展已连接。直接在 YouTube 播放视频，字幕会自动出现在这里。"
              : "打开装有 ListenUp 扩展的浏览器并播放 YouTube，字幕会自动连接。"}
        </p>
      </div>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-fg-faint">
        <span className="h-px flex-1 bg-white/10" />或<span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <Icon icon="mdi:play-box-outline" className="h-4 w-4 text-red-400" />
          在 Desktop 里播放
        </div>
        <p className="mb-3 mt-2 text-[11px] leading-relaxed text-fg-muted">
          粘贴单个 YouTube 视频链接，当前窗口会原地显示上方官方播放器和下方字幕。
        </p>
        <div className="flex gap-2">
          <DesktopTextField
            aria-label="YouTube 视频链接"
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
            {starting ? "启动中" : "播放"}
          </DesktopButton>
        </div>
        {error && <p className="mb-0 mt-2 text-[10px] text-red-300">{error}</p>}
      </div>
    </div>
  );
};
