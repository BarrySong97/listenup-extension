import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CursorState, SessionState, UiUpdate, ViewerSnapshot } from "./types";

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const statusText = (session: SessionState | null) => {
  if (!session) return "等待 YouTube 字幕…";
  if (session.status === "loading") return "正在加载字幕…";
  if (session.status === "empty") return "这个视频没有可用字幕";
  if (session.status === "error") return session.error ?? "字幕加载失败";
  return null;
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    const initialize = async () => {
      unlisten = await listen<UiUpdate>("native-subtitle-update", (event) => {
        setConnected(true);
        const update = event.payload;
        if (update.kind === "session") {
          setSession(update.payload);
          return;
        }

        const cursor = update.payload;
        setSession((current) => {
          if (!current || current.sessionId !== cursor.sessionId) {
            return current;
          }
          return { ...current, cursor };
        });
      });

      const snapshot = await invoke<ViewerSnapshot>("get_snapshot");
      if (!disposed) {
        setConnected(snapshot.connected);
        setSession(snapshot.activeSession);
      }
    };

    void initialize();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const cursor: CursorState | null = session?.cursor ?? null;
  const currentIndex = cursor?.currentIndex ?? -1;
  const emptyMessage = statusText(session);

  useEffect(() => {
    if (currentIndex < 0 || !activeRowRef.current) return;
    activeRowRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [currentIndex, session?.sessionId]);

  const connectionLabel = connected ? "Native Host 已连接" : "等待 Chrome 连接";
  const playbackLabel = useMemo(() => {
    if (!cursor) return "等待播放";
    if (cursor.isAdPlaying) return "广告播放中";
    return cursor.isPaused ? "已暂停" : "同步播放中";
  }, [cursor]);

  return (
    <main className="app-shell">
      <header className="header">
        <div className="eyebrow-row">
          <span className={`status-dot ${connected ? "connected" : ""}`} />
          <span>{connectionLabel}</span>
          <span className="spacer" />
          <span>{playbackLabel}</span>
        </div>
        <h1>{session?.title ?? "ListenUp Native Subtitles"}</h1>
        <div className="metadata-row">
          <span>{session?.track?.displayName ?? "字幕同步 Demo"}</span>
          <span>{formatTime(cursor?.currentTime ?? 0)}</span>
        </div>
      </header>

      <section className="subtitle-list" aria-live="polite">
        {emptyMessage ? (
          <div className="empty-state">
            <div className="empty-icon">CC</div>
            <p>{emptyMessage}</p>
            {!connected && (
              <small>请通过 Chrome 扩展启动，而不是直接打开应用。</small>
            )}
          </div>
        ) : (
          session?.subtitles.map((subtitle, index) => {
            const isActive = index === currentIndex;
            return (
              <div
                key={`${session.sessionId}-${subtitle.id}-${index}`}
                ref={isActive ? activeRowRef : null}
                className={`subtitle-row ${isActive ? "active" : ""}`}
              >
                <time>{formatTime(subtitle.startTime)}</time>
                <p>{subtitle.text}</p>
              </div>
            );
          })
        )}
      </section>

      <footer>
        <span>{session ? `YouTube · ${session.videoId}` : "本地内存 · 不联网"}</span>
        <span>{session?.subtitles.length ?? 0} 条字幕</span>
      </footer>
    </main>
  );
}
