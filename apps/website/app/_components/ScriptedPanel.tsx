"use client";
import { useEffect, useRef, useState } from "react";
import { RealExtensionPanel } from "./extension/RealExtensionPanel";

function FakeCursor({ x, y, clicking, visible }: { x: number; y: number; clicking: boolean; visible: boolean }) {
  return (
    <div
      className={`fake-cursor ${visible ? "is-visible" : ""}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <div className={`fake-cursor-inner ${clicking ? "is-clicking" : ""}`}>
        {clicking && <span className="fake-cursor-ring" />}
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <path
            d="M3 2 L3 16 L7 12.5 L9.7 18.5 L12 17.5 L9.3 11.5 L15 11.5 Z"
            fill="#0a0a0a" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

interface ScriptedPanelProps {
  width?: number;
  height?: number;
  initialIndex?: number;
}

export function ScriptedPanel({ width = 380, height = 580, initialIndex = 0 }: ScriptedPanelProps) {
  const [view, setView] = useState<"list" | "explain">("list");
  const [showSelection, setShowSelection] = useState(false);
  const [cursor, setCursor] = useState({ x: width - 40, y: height - 40 });
  const [clicking, setClicking] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sleep = (ms: number) => new Promise<void>((r) => { timer = setTimeout(r, ms); });

    const centerOf = (selector: string) => {
      const root = wrapRef.current;
      if (!root) return null;
      const el = root.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      const pr = root.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      return { x: er.left - pr.left + er.width / 2, y: er.top - pr.top + er.height / 2 };
    };

    const moveTo = (selector: string, fallback: { x: number; y: number }) =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          const c = centerOf(selector) ?? fallback;
          setCursor(c);
          resolve();
        });
      });

    const run = async () => {
      await sleep(400); if (cancelled) return;

      while (!cancelled) {
        setView("list"); setShowSelection(false);
        setCursorVisible(false);
        setCursor({ x: width / 2, y: height / 2 });
        await sleep(600); if (cancelled) return;
        setCursorVisible(true);
        await sleep(300); if (cancelled) return;

        await moveTo('[data-lu-target="word"]', { x: width / 2, y: height / 2 });
        await sleep(800); if (cancelled) return;

        setClicking(true);
        await sleep(180); if (cancelled) return;
        setClicking(false);
        setShowSelection(true);
        await sleep(550); if (cancelled) return;

        await moveTo('[data-lu-target="explain"]', { x: width / 2 + 30, y: 60 });
        await sleep(900); if (cancelled) return;

        setClicking(true);
        await sleep(180); if (cancelled) return;
        setClicking(false);
        setView("explain");
        await sleep(500); if (cancelled) return;

        setCursor({ x: width - 50, y: height - 60 });
        await sleep(4200); if (cancelled) return;

        await moveTo('[data-lu-target="close"]', { x: width - 30, y: 28 });
        await sleep(800); if (cancelled) return;

        setClicking(true);
        await sleep(180); if (cancelled) return;
        setClicking(false);
        setView("list");
        setShowSelection(false);
        await sleep(600); if (cancelled) return;
      }
    };

    run();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [width, height]);

  return (
    <div ref={wrapRef} style={{ position: "relative", width, height }}>
      <RealExtensionPanel
        width={width}
        height={height}
        view={view}
        onViewChange={setView}
        showSelection={showSelection}
      />
      <FakeCursor x={cursor.x} y={cursor.y} clicking={clicking} visible={cursorVisible} />
    </div>
  );
}
