/**
 * @purpose 提供本地 Player 窗口骨架，并用 ResizeObserver 把视频槽 bounds 同步给 Rust child WebView。
 * @role    可信 player-ui；批次 4 在视频槽下复用完整 SubtitleViewer 与控制区。
 * @deps    React、@tauri-apps/api/core
 * @gotcha  youtube-* WebView 是独立原生 child，不能用 iframe 或把远程 DOM 放入本 React 树。
 */
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";

const reportBounds = (element: HTMLDivElement) => {
  const bounds = element.getBoundingClientRect();
  return invoke("set_embedded_video_bounds", {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
};

export default function PlayerShell() {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const observer = new ResizeObserver(() => {
      void reportBounds(slot);
    });
    observer.observe(slot);
    void reportBounds(slot);
    const retries = [250, 1_000].map((delay) =>
      window.setTimeout(() => void reportBounds(slot), delay)
    );
    return () => {
      observer.disconnect();
      retries.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#080b10] text-white">
      <header
        className="flex h-14 items-center gap-3 border-b border-white/10 px-5"
        data-tauri-drag-region
      >
        <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <strong className="text-sm font-semibold">ListenUp · Desktop 播放</strong>
        <span className="text-xs text-white/45">正在建立安全播放器…</span>
      </header>
      <div ref={slotRef} className="aspect-video w-full bg-black" aria-label="YouTube 视频区域" />
      <section className="grid min-h-52 place-items-center px-6 text-sm text-white/45">
        字幕正在初始化
      </section>
    </main>
  );
}
