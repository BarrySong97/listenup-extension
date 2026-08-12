/**
 * @purpose 在 BrowserSource 活跃时确认切换到 Desktop 同窗播放。
 * @role    统一承接 header 按钮的空链接入口与非输入区域 paste 的预填入口。
 * @deps    React、Iconify、DesktopModal、Desktop UI primitives、embeddedPlayback
 * @gotcha  只负责表单与确认；确认前不得调用来源迁移，失败时保留链接供用户修正或重试。
 */
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { DesktopButton } from "./components/ui/DesktopButton";
import { DesktopIconButton } from "./components/ui/DesktopIconButton";
import { DesktopModal } from "./components/ui/DesktopModal";
import { DesktopTextField } from "./components/ui/DesktopTextField";
import { normalizeYoutubeWatchUrl } from "./embeddedPlayback";

interface BrowserSourceSwitchModalProps {
  isOpen: boolean;
  initialUrl: string;
  onClose: () => void;
  onConfirm: (normalizedUrl: string) => Promise<void>;
}

const iconButtonClassName =
  "grid h-[26px] w-[26px] flex-none cursor-pointer place-items-center rounded-[7px] border-none bg-transparent p-0 text-fg-muted transition-colors hover:bg-wash hover:text-fg";

export const BrowserSourceSwitchModal = ({
  isOpen,
  initialUrl,
  onClose,
  onConfirm,
}: BrowserSourceSwitchModalProps) => {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setUrl(initialUrl);
    setError(null);
  }, [initialUrl, isOpen]);

  const submit = useCallback(async () => {
    setError(null);
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeYoutubeWatchUrl(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "YouTube 链接无效");
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(normalizedUrl);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  }, [onClose, onConfirm, url]);

  return (
    <DesktopModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="browser-source-switch-title"
      ariaDescribedBy="browser-source-switch-description"
      isKeyboardDismissDisabled={submitting}
      dialogClassName="max-w-[360px]"
    >
      <div className="flex items-center gap-2">
        <Icon
          icon="mdi:monitor-play"
          className="h-4 w-4 flex-none text-yt"
          aria-hidden="true"
        />
        <h2
          id="browser-source-switch-title"
          className="m-0 flex-1 text-[13px] font-[650] text-fg"
        >
          切换到 Desktop 播放
        </h2>
        <DesktopIconButton
          className={iconButtonClassName}
          onPress={onClose}
          isDisabled={submitting}
          tooltip="取消"
          ariaLabel="取消切换到 Desktop 播放"
          icon={
            <Icon
              icon="mdi:close"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
          }
        />
      </div>
      <p
        id="browser-source-switch-description"
        className="mb-3 mt-2 text-[11px] leading-relaxed text-fg-muted"
      >
        确认后，当前窗口会原地切换为播放器；浏览器之后的播放状态不会再影响这里。
      </p>
      <DesktopTextField
        autoFocus
        aria-label="要在 Desktop 播放的 YouTube 视频链接"
        aria-invalid={error ? true : undefined}
        placeholder="https://youtu.be/..."
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
        }}
        className="h-9 w-full rounded-lg border border-hairline bg-black/25 px-3 text-[11px] text-fg placeholder:text-fg-faint"
      />
      {error && (
        <p className="mb-0 mt-2 text-[10px] text-red-300" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <DesktopButton
          className="h-9 cursor-pointer rounded-lg border border-hairline bg-wash px-3 text-[11px] font-semibold text-fg hover:bg-wash-active disabled:cursor-wait disabled:opacity-50"
          isDisabled={submitting}
          onPress={onClose}
        >
          取消
        </DesktopButton>
        <DesktopButton
          className="h-9 cursor-pointer rounded-lg bg-yt px-3 text-[11px] font-semibold text-white hover:brightness-110 disabled:cursor-wait disabled:opacity-50"
          isDisabled={submitting}
          onPress={() => void submit()}
        >
          {submitting ? "切换中" : "切换并播放"}
        </DesktopButton>
      </div>
    </DesktopModal>
  );
};
