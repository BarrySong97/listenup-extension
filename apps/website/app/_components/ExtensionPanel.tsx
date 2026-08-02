/**
 * @purpose 自绘的扩展面板演示（图标全部内联 SVG，不依赖扩展代码）。
 * @role    另一版落地页演示组件；**当前未被引用**。
 * @deps    react
 * @gotcha  与 ./extension/ 下那套是两条独立的演示实现，别混着改
 */
"use client";
import { useEffect, useRef, useState } from "react";

// ---- Icons ----------------------------------------------------------------
function Icon({ d, size = 16, strokeWidth = 1.6, fill = "none" }: {
  d: React.ReactNode; size?: number; strokeWidth?: number; fill?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}
const IcSettings = (p: { size?: number }) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>}/>;
const IcDownload = (p: { size?: number }) => <Icon {...p} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>}/>;
const IcCopy = (p: { size?: number }) => <Icon {...p} d={<><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>}/>;
const IcChevronUp = (p: { size?: number }) => <Icon {...p} d={<polyline points="18 15 12 9 6 15"/>}/>;
const IcPause = (p: { size?: number }) => <Icon {...p} strokeWidth={0} fill="currentColor" d={<><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>}/>;
const IcPlay = (p: { size?: number }) => <Icon {...p} strokeWidth={0} fill="currentColor" d={<path d="M7 5v14l12-7z"/>}/>;
const IcTranslate = (p: { size?: number }) => <Icon {...p} d={<><path d="M4 5h7"/><path d="M9 3v2c0 4.4-2.7 8-6 8"/><path d="M5 9c0 2.6 3.6 5 8 5"/><path d="M12 20l4-9 4 9"/><path d="M13.5 17h5"/></>}/>;
const IcMic = (p: { size?: number }) => <Icon {...p} d={<><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="22"/></>}/>;
const IcSparkle = (p: { size?: number }) => <Icon {...p} d={<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"/>}/>;
const IcRefresh = (p: { size?: number }) => <Icon {...p} d={<><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>}/>;
const IcClose = (p: { size?: number }) => <Icon {...p} d={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}/>;
const IcSpeaker = (p: { size?: number }) => <Icon {...p} d={<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></>}/>;
const IcBook = (p: { size?: number }) => <Icon {...p} d={<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>}/>;
const IcList = (p: { size?: number }) => <Icon {...p} d={<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></>}/>;
const IcImage = (p: { size?: number }) => <Icon {...p} d={<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>}/>;
const IcSearch = (p: { size?: number }) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></>}/>;

// ---- Data -----------------------------------------------------------------
const SUBTITLE_SETS: Record<string, { time: string; text: string }[]> = {
  english: [
    { time: "03:42", text: "Today we're going to learn ten common English idioms." },
    { time: "03:48", text: "These are phrases native speakers use every day." },
    { time: "03:54", text: 'The first one is "break the ice."' },
    { time: "04:01", text: "It means to start a conversation in a social setting." },
    { time: "04:08", text: "For example, you might tell a joke to break the ice." },
    { time: "04:15", text: '"Hit the books" — this means to study hard.' },
    { time: "04:23", text: "I need to hit the books before my exam tomorrow." },
    { time: "04:31", text: 'Let\'s try one more: "piece of cake."' },
    { time: "04:38", text: "This idiom means something is very easy to do." },
    { time: "04:44", text: '"The test was a piece of cake."' },
    { time: "04:50", text: "Now I'll explain a slightly harder one." },
    { time: "04:57", text: '"Bite the bullet" — to do something difficult you\'ve been avoiding.' },
    { time: "05:06", text: "Try using these idioms this week and let me know how it goes." },
  ],
};

const DEFAULT_SELECTIONS: Record<string, { row: number; word: string }> = {
  english: { row: 0, word: "idioms" },
};

const EXPLAIN_DATA: Record<string, {
  word: string; pos: string; usPron: string; ukPron: string;
  exampleBefore: string; exampleAfter: string; meaning: string; details: string[];
}> = {
  english: {
    word: "idioms", pos: "noun", usPron: "/ˈɪdiəmz/", ukPron: "/ˈɪdɪəmz/",
    exampleBefore: "Today we're going to learn ten common English ",
    exampleAfter: ".",
    meaning: "Fixed expressions whose meaning cannot be guessed from the individual words alone — phrases that native speakers use in everyday conversation.",
    details: [
      "In this sentence, 'idioms' refers to a set of figurative phrases the speaker is about to teach.",
      "Idioms are almost always used in their fixed form — changing a word usually breaks the meaning.",
      "Common usage: often plural; learning idioms is a hallmark of advanced fluency.",
    ],
  },
};

// ---- Highlight + selection-tooltip helper ---------------------------------
function HighlightedText({ text, highlight, highlightActive = true }: {
  text: string; highlight: string; highlightActive?: boolean;
}) {
  if (!highlight) return <>{text}</>;
  const idx = text.indexOf(highlight);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className={`lu-selection ${highlightActive ? "is-on" : "is-off"}`}
        data-lu-target="word">{highlight}</span>
      {text.slice(idx + highlight.length)}
    </>
  );
}

// ---- Main panel -----------------------------------------------------------
export interface ExtensionPanelProps {
  language?: string;
  width?: number;
  height?: number;
  initialIndex?: number;
  autoplay?: boolean;
  defaultView?: "list" | "explain";
  view?: "list" | "explain";
  onViewChange?: (v: "list" | "explain") => void;
  showSelection?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ExtensionPanel({
  language = "english",
  width = 384,
  height = 640,
  initialIndex = 0,
  autoplay = true,
  defaultView = "list",
  view: viewProp,
  onViewChange,
  showSelection = true,
  className = "",
  style = {},
}: ExtensionPanelProps) {
  const subtitles = SUBTITLE_SETS[language] || SUBTITLE_SETS.english;
  const sel = DEFAULT_SELECTIONS[language] || DEFAULT_SELECTIONS.english;
  const explain = EXPLAIN_DATA[language] || EXPLAIN_DATA.english;

  const [internalView, setInternalView] = useState<"list" | "explain">(defaultView);
  const view = viewProp !== undefined ? viewProp : internalView;
  const setView = (v: "list" | "explain") => {
    if (viewProp === undefined) setInternalView(v);
    onViewChange?.(v);
  };
  const [activeIdx, setActiveIdx] = useState(initialIndex);
  const [playing, setPlaying] = useState(autoplay);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view !== "list" || !playing) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1 < subtitles.length ? i + 1 : 0));
    }, 2800);
    return () => clearInterval(id);
  }, [playing, subtitles.length, view]);

  useEffect(() => {
    if (view !== "list") return;
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    if (el && listRef.current) {
      const c = listRef.current;
      const cr = c.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const offset = er.top - cr.top - cr.height / 2 + er.height / 2;
      c.scrollBy({ top: offset, behavior: "smooth" });
    }
  }, [activeIdx, view]);

  const active = subtitles[activeIdx];

  const handleClickSubtitle = (idx: number) => { setActiveIdx(idx); setPlaying(true); };
  const handleCopy = () => {
    const txt = subtitles.map((s) => `[${s.time}] ${s.text}`).join("\n");
    navigator.clipboard?.writeText(txt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const goExplain = () => setView("explain");
  const goList = () => setView("list");

  // ── EXPLAIN VIEW ──
  if (view === "explain") {
    return (
      <div className={`lu-panel lu-panel--explain ${className}`} style={{ width, height, ...style }}>
        <div className="lu-explain-head">
          <div className="lu-explain-word">{explain.word}</div>
          <div className="lu-explain-headicons">
            <button className="lu-iconbtn" aria-label="Settings"><IcSettings/></button>
            <button className="lu-iconbtn" aria-label="Refresh"><IcRefresh/></button>
            <button className="lu-iconbtn" aria-label="Back to list" onClick={goList} data-lu-target="close"><IcClose/></button>
          </div>
        </div>
        <div className="lu-explain-body">
          <div className="lu-pospill">{explain.pos}</div>
          <div className="lu-pron-row">
            <div className="lu-pron">
              <span className="lu-pron-flag">US</span>
              <span className="lu-pron-text">{explain.usPron}</span>
              <button className="lu-pron-play" aria-label="Play US"><IcSpeaker size={11}/></button>
            </div>
            <div className="lu-pron">
              <span className="lu-pron-flag">UK</span>
              <span className="lu-pron-text">{explain.ukPron}</span>
              <button className="lu-pron-play" aria-label="Play UK"><IcSpeaker size={11}/></button>
            </div>
          </div>
          <div className="lu-example">
            <span className="lu-example-quote">&ldquo;</span>
            {explain.exampleBefore}
            <strong>{explain.word}</strong>
            {explain.exampleAfter}
            <span className="lu-example-quote">&rdquo;</span>
          </div>
          <div className="lu-section">
            <div className="lu-section-head"><IcBook size={13}/> Meaning</div>
            <div className="lu-meaning">{explain.meaning}</div>
          </div>
          <div className="lu-section">
            <div className="lu-section-head"><IcList size={13}/> Details &amp; Usage</div>
            <ul className="lu-details">
              {explain.details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
          <div className="lu-section">
            <div className="lu-section-head lu-section-head--row">
              <span><IcImage size={13}/> Visual Reference</span>
              <button className="lu-morebtn"><IcSearch size={11}/> More images</button>
            </div>
            <div className="lu-vref">
              <div className="lu-vref-img" aria-label="Reference image placeholder">
                <IcImage size={20}/>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className={`lu-panel ${className}`} style={{ width, height, ...style }}>
      <div className="lu-header">
        <div className="lu-brand">
          <div className="lu-logo" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="14" height="14">
              <rect x="2" y="8" width="2" height="4" rx="1" fill="currentColor"/>
              <rect x="6" y="5" width="2" height="10" rx="1" fill="currentColor"/>
              <rect x="10" y="2" width="2" height="16" rx="1" fill="currentColor"/>
              <rect x="14" y="6" width="2" height="8" rx="1" fill="currentColor"/>
            </svg>
          </div>
          <span className="lu-brandname">Listen Up</span>
        </div>
        <div className="lu-headicons">
          <button className="lu-iconbtn" aria-label="Settings"><IcSettings/></button>
          <button className="lu-iconbtn" aria-label="Download" onClick={handleCopy}><IcDownload/></button>
          <button className="lu-iconbtn" aria-label="Copy" onClick={handleCopy}><IcCopy/></button>
          <button className="lu-iconbtn" aria-label="Collapse"><IcChevronUp/></button>
        </div>
      </div>

      {copied && <div className="lu-toast">Copied to clipboard</div>}

      <div className="lu-list" ref={listRef}>
        {subtitles.map((s, i) => {
          const isActive = i === activeIdx;
          const rowHasWord = i === sel.row;
          const tipVisible = rowHasWord && showSelection;
          return (
            <div key={i} data-idx={i}
              className={`lu-row${isActive ? " is-active" : ""}${rowHasWord ? " has-sel" : ""}${tipVisible ? " tip-on" : ""}`}
              onClick={() => handleClickSubtitle(i)}>
              <div className="lu-time">{s.time}</div>
              <div className="lu-text">
                {rowHasWord
                  ? <HighlightedText text={s.text} highlight={sel.word} highlightActive={showSelection}/>
                  : s.text}
                {tipVisible && (
                  <div className="lu-seltip">
                    <button className="lu-seltip-btn" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
                      <IcCopy size={11}/> Copy
                    </button>
                    <div className="lu-seltip-divider"/>
                    <button className="lu-seltip-btn lu-seltip-btn--primary"
                      onClick={(e) => { e.stopPropagation(); goExplain(); }}
                      data-lu-target="explain">
                      <IcSparkle size={11}/> Explain
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="lu-playrow">
        <button className="lu-playbtn" onClick={() => setPlaying((p) => !p)}>
          {playing ? <IcPause size={14}/> : <IcPlay size={14}/>}
          <span>{playing ? "Pause" : "Play"}</span>
        </button>
      </div>

      <div className="lu-recent">
        <div className="lu-recent-head">
          <span className="lu-recent-label">RECENT SEGMENT</span>
          <span className="lu-recent-time">{active.time} – {subtitles[Math.min(activeIdx + 1, subtitles.length - 1)].time}</span>
        </div>
        <div className="lu-recent-text">{active.text}</div>
      </div>

      <div className="lu-bottom">
        <button className="lu-bottombtn" aria-label="Translate"><IcTranslate size={18}/></button>
        <button className="lu-bottombtn lu-bottombtn--active" aria-label="Voice"><IcMic size={18}/></button>
      </div>
    </div>
  );
}
