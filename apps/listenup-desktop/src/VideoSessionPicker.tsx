/**
 * @purpose 多个 YouTube 视频同时播放时，让用户选择 Desktop 显示哪个视频的字幕。
 * @role    App 的不可关闭 HeroUI Modal，只在播放来源冲突时出现。
 * @deps    @iconify/react、DesktopModal、DesktopButton、./types
 * @gotcha  这里只展示 Rust 标记为 verified 且正在播放的候选，不自行推断播放状态。
 */
import { Icon } from "@iconify/react";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopModal } from "./components/ui/DesktopModal";
import type { PlayingCandidate } from "./types";

interface VideoSessionPickerProps {
  isOpen: boolean;
  candidates: PlayingCandidate[];
  selectedSessionId: string | null;
  busySessionId: string | null;
  error: string | null;
  onSelect: (sessionId: string) => void;
}

export const VideoSessionPicker = ({
  isOpen,
  candidates,
  selectedSessionId,
  busySessionId,
  error,
  onSelect,
}: VideoSessionPickerProps) => (
  <DesktopModal
    isOpen={isOpen}
    onClose={() => undefined}
    ariaLabelledBy="video-session-picker-title"
    ariaDescribedBy="video-session-picker-description"
    size="full"
    isDismissable={false}
    isKeyboardDismissDisabled
    backdropClassName="bg-transparent backdrop-blur-none"
    containerClassName="p-0 sm:p-0"
    dialogClassName="h-full min-h-full w-full rounded-none border-none bg-[#151517] p-3 shadow-none"
  >
    <div className="mb-2 flex items-start gap-2">
      <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-white/10 text-fg">
        <Icon icon="mdi:youtube" className="h-5 w-5 text-yt" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h2
          id="video-session-picker-title"
          className="m-0 text-[13px] font-semibold text-fg"
        >
          选择字幕视频
        </h2>
        <p
          id="video-session-picker-description"
          className="m-0 mt-0.5 text-[10px] leading-normal text-fg-faint"
        >
          检测到多个视频正在播放，请选择字幕来源。
        </p>
      </div>
    </div>

    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
      {candidates.map((candidate) => {
        const selected = selectedSessionId === candidate.sessionId;
        const busy = busySessionId === candidate.sessionId;
        return (
          <DesktopButton
            key={candidate.sessionId}
            className={`flex w-full cursor-pointer items-center justify-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
              selected
                ? "border-yt/60 bg-yt/10"
                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
            }`}
            isDisabled={busySessionId !== null}
            onPress={() => onSelect(candidate.sessionId)}
            aria-pressed={selected}
          >
            <Icon
              icon={busy ? "mdi:loading" : "mdi:play-circle-outline"}
              className={`h-4 w-4 flex-none text-yt ${busy ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-fg">
                {candidate.title || "YouTube 视频"}
              </span>
              <span className="block truncate text-[9px] text-fg-faint">
                YouTube · {candidate.videoId}
              </span>
            </span>
            {selected && (
              <Icon
                icon="mdi:check-circle"
                className="h-4 w-4 flex-none text-yt"
                aria-hidden="true"
              />
            )}
          </DesktopButton>
        );
      })}
    </div>

    {error && <p className="m-0 mt-2 text-[10px] text-red-300">{error}</p>}
  </DesktopModal>
);
