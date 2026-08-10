/**
 * @purpose 订阅 Rust SourceCoordinator 的 snapshot/cursor，并保持高频 cursor 与结构化 viewer 分离。
 * @role    main 与可信 player-ui 共用的实时会话 hook。
 * @deps    @tauri-apps/api core/event、types
 * @gotcha  cursor 只能命中当前 session；player-ui 不订阅浏览器 connection 旁路事件。
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CursorState, UiUpdate, ViewerSnapshot } from "./types";

export const EMPTY_VIEWER_SNAPSHOT: ViewerSnapshot = {
  connected: false,
  sourceMode: "empty",
  source: null,
  browserPauseState: "notNeeded",
  awaitingBrowserPlayback: false,
  activeSession: null,
  playingCandidates: [],
  playingSessionCount: 0,
  selectedSessionId: null,
  selectionRequired: false,
};

export const useViewerSession = ({
  listenToBrowserConnection = true,
}: { listenToBrowserConnection?: boolean } = {}) => {
  const [viewer, setViewer] = useState<ViewerSnapshot>(EMPTY_VIEWER_SNAPSHOT);
  const [connected, setConnected] = useState(false);
  const [cursor, setCursor] = useState<CursorState | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  const applyViewerSnapshot = useCallback(
    (snapshot: ViewerSnapshot, connectionOverride?: boolean) => {
      activeSessionIdRef.current = snapshot.activeSession?.sessionId ?? null;
      setViewer(snapshot);
      setCursor(snapshot.activeSession?.cursor ?? null);
      setConnected(connectionOverride ?? snapshot.connected);
    },
    []
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    let unlistenConnection: (() => void) | null = null;

    const initialize = async () => {
      if (listenToBrowserConnection) {
        unlistenConnection = await listen<boolean>(
          "native-subtitle-connection",
          (event) => setConnected(Boolean(event.payload))
        );
      }
      unlisten = await listen<UiUpdate>("native-subtitle-update", (event) => {
        const update = event.payload;
        if (update.kind === "snapshot") {
          applyViewerSnapshot(
            update.payload,
            listenToBrowserConnection ? true : undefined
          );
          return;
        }
        if (activeSessionIdRef.current === update.payload.sessionId) {
          if (listenToBrowserConnection) setConnected(true);
          setCursor(update.payload);
        }
      });

      const snapshot = await invoke<ViewerSnapshot>("get_snapshot");
      if (!disposed) applyViewerSnapshot(snapshot);
    };

    void initialize();
    return () => {
      disposed = true;
      unlisten?.();
      unlistenConnection?.();
    };
  }, [applyViewerSnapshot, listenToBrowserConnection]);

  return { viewer, connected, cursor, applyViewerSnapshot };
};
