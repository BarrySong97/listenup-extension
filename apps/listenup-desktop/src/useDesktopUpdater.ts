/**
 * @purpose 统一 Desktop 启动检查、标题栏/tray 安装和重启更新流程。
 * @role    封装 Tauri updater/process API，启动只提示，用户确认后才下载安装。
 * @deps    @tauri-apps/api/event、@tauri-apps/plugin-updater、@tauri-apps/plugin-process、react-i18next
 * @gotcha  启动检查不能自动安装；busyRef 必须先置位，避免启动、标题栏与 tray 并发。
 */
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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

const errorMessageKey = (error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  if (/404|not found/i.test(detail)) {
    return { key: "update.unavailable" };
  }
  if (/timed? ?out|timeout/i.test(detail)) {
    return { key: "update.timeout" };
  }
  return { key: "update.failed", detail };
};

export const useDesktopUpdater = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const { t } = useTranslation();
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
            message: t("update.devSkipped"),
          });
        }
        return;
      }

      busyRef.current = true;
      clearNoticeTimer();
      if (!silent) {
        setState({ phase: "checking", message: t("update.checking") });
      }

      let update: Awaited<ReturnType<typeof check>> = null;
      try {
        update = await check({ timeout: CHECK_TIMEOUT_MS });
        if (!update) {
          if (silent) {
            setState(INITIAL_STATE);
          } else {
            showTemporaryNotice({ phase: "current", message: t("update.current") });
          }
          return;
        }

        if (!installWhenAvailable) {
          setState({
            phase: "available",
            message: t("update.available", { version: update.version }),
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
              message: t("update.downloading", { version: update?.version ?? "" }),
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
                  ? t("update.downloading", { version: update?.version ?? "" })
                  : t("update.downloadingProgress", {
                      version: update?.version ?? "",
                      percentage,
                    }),
            });
          }
        };

        await update.downloadAndInstall(onDownloadEvent, {
          timeout: DOWNLOAD_TIMEOUT_MS,
        });
        setState({ phase: "installed", message: t("update.installed") });
        await update.close();
        update = null;
        await relaunch();
      } catch (error) {
        if (silent) {
          setState(INITIAL_STATE);
        } else {
          const translatedError = errorMessageKey(error);
          showTemporaryNotice({
            phase: "error",
            message: t(translatedError.key, { detail: translatedError.detail }),
          });
        }
      } finally {
        busyRef.current = false;
        if (update) {
          void update.close().catch(() => undefined);
        }
      }
    },
    [clearNoticeTimer, enabled, showTemporaryNotice, t]
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
