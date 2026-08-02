/**
 * @purpose 统一 Desktop 启动检查、标题栏/tray 安装和重启更新流程。
 * @role    封装 Tauri updater/process API，启动只提示，用户确认后才下载安装。
 * @deps    @tauri-apps/api/event、@tauri-apps/plugin-updater、@tauri-apps/plugin-process
 * @gotcha  启动检查不能自动安装；busyRef 必须先置位，避免启动、标题栏与 tray 并发。
 */
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

const CHECK_UPDATE_EVENT = "desktop-check-for-update";
const CHECK_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const NOTICE_DURATION_MS = 6_000;

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installed"
  | "current"
  | "error";

export interface DesktopUpdateState {
  phase: UpdatePhase;
  message: string | null;
}

const INITIAL_STATE: DesktopUpdateState = {
  phase: "idle",
  message: null,
};

const errorMessage = (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  if (/404|not found/i.test(detail)) {
    return "暂时没有可用的更新信息";
  }
  if (/timed? ?out|timeout/i.test(detail)) {
    return "检查更新超时，请稍后重试";
  }
  return `更新失败：${detail}`;
};

export const useDesktopUpdater = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const [state, setState] = useState<DesktopUpdateState>(INITIAL_STATE);
  const busyRef = useRef(false);
  const launchCheckStartedRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);

  const clearNoticeTimer = useCallback(() => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  const showTemporaryNotice = useCallback(
    (nextState: DesktopUpdateState) => {
      clearNoticeTimer();
      setState(nextState);
      noticeTimerRef.current = window.setTimeout(() => {
        noticeTimerRef.current = null;
        setState(INITIAL_STATE);
      }, NOTICE_DURATION_MS);
    },
    [clearNoticeTimer]
  );

  const runUpdateCheck = useCallback(
    async ({
      installWhenAvailable,
      silent,
    }: {
      installWhenAvailable: boolean;
      silent: boolean;
    }) => {
      if (busyRef.current) return;
      if (!enabled) {
        if (!silent) {
          showTemporaryNotice({
            phase: "current",
            message: "开发版不会安装正式版更新",
          });
        }
        return;
      }

      busyRef.current = true;
      clearNoticeTimer();
      if (!silent) {
        setState({ phase: "checking", message: "正在检查更新…" });
      }

      let update: Awaited<ReturnType<typeof check>> = null;
      try {
        update = await check({ timeout: CHECK_TIMEOUT_MS });
        if (!update) {
          if (silent) {
            setState(INITIAL_STATE);
          } else {
            showTemporaryNotice({ phase: "current", message: "当前已是最新版本" });
          }
          return;
        }

        if (!installWhenAvailable) {
          setState({
            phase: "available",
            message: `发现新版本 v${update.version}`,
          });
          return;
        }

        let downloadedBytes = 0;
        let contentLength: number | undefined;
        const onDownloadEvent = (event: DownloadEvent) => {
          if (event.event === "Started") {
            contentLength = event.data.contentLength;
            setState({
              phase: "downloading",
              message: `发现 v${update?.version ?? ""}，正在下载…`,
            });
            return;
          }

          if (event.event === "Progress") {
            downloadedBytes += event.data.chunkLength;
            const percentage = contentLength
              ? Math.min(100, Math.round((downloadedBytes / contentLength) * 100))
              : null;
            setState({
              phase: "downloading",
              message:
                percentage === null
                  ? `正在下载 v${update?.version ?? ""}…`
                  : `正在下载 v${update?.version ?? ""}… ${percentage}%`,
            });
          }
        };

        await update.downloadAndInstall(onDownloadEvent, {
          timeout: DOWNLOAD_TIMEOUT_MS,
        });
        setState({ phase: "installed", message: "更新完成，正在重启…" });
        await update.close();
        update = null;
        await relaunch();
      } catch (error) {
        if (silent) {
          setState(INITIAL_STATE);
        } else {
          showTemporaryNotice({ phase: "error", message: errorMessage(error) });
        }
      } finally {
        busyRef.current = false;
        if (update) {
          void update.close().catch(() => undefined);
        }
      }
    },
    [clearNoticeTimer, enabled, showTemporaryNotice]
  );

  const checkForUpdates = useCallback(
    () => runUpdateCheck({ installWhenAvailable: true, silent: false }),
    [runUpdateCheck]
  );

  const installAvailableUpdate = useCallback(
    () => runUpdateCheck({ installWhenAvailable: true, silent: false }),
    [runUpdateCheck]
  );

  useEffect(() => {
    if (!enabled || launchCheckStartedRef.current) return;
    launchCheckStartedRef.current = true;
    void runUpdateCheck({ installWhenAvailable: false, silent: true });
  }, [enabled, runUpdateCheck]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen(CHECK_UPDATE_EVENT, () => {
      if (!disposed) void checkForUpdates();
    }).then((stopListening) => {
      if (disposed) {
        stopListening();
      } else {
        unlisten = stopListening;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
      clearNoticeTimer();
    };
  }, [checkForUpdates, clearNoticeTimer]);

  return {
    state,
    isBusy: state.phase === "checking" || state.phase === "downloading",
    checkForUpdates,
    installAvailableUpdate,
  };
};
