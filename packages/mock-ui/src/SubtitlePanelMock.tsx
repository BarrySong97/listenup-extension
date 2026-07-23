import { DEFAULT_MOCK, type SubtitleMock } from "./data";
import { Close, MovieOpen, YoutubeLogo } from "./icons";

export type SubtitlePanelMockProps = {
  data?: SubtitleMock;
  className?: string;
};

/**
 * A faithful, static reproduction of the ListenUp Desktop subtitle window
 * (list mode) — dark frosted card, header with the official YouTube logo + status
 * line, the synced subtitle list, and the footer. Structure/values match
 * apps/listenup-desktop/src/App.tsx. Pure presentation, no dependencies.
 */
export function SubtitlePanelMock({ data = DEFAULT_MOCK, className }: SubtitlePanelMockProps) {
  return (
    <div className={`lu-ui${className ? ` ${className}` : ""}`}>
      <div className="lu-shell" role="figure" aria-label="ListenUp Desktop subtitle window">
        {/* header */}
        <div className="lu-hd">
          <div className="lu-hd__top">
            <span className="lu-yt" aria-hidden="true">
              <YoutubeLogo size={22} />
            </span>
            <h1 className="lu-title">{data.title}</h1>
            <button className="lu-iconbtn" type="button" tabIndex={-1} aria-label="Cinema mode">
              <MovieOpen size={14} />
            </button>
            <button className="lu-iconbtn" type="button" tabIndex={-1} aria-label="Close">
              <Close size={14} />
            </button>
          </div>
          <div className="lu-hd__status">
            <span className={`lu-sdot${data.connected ? "" : " lu-sdot--off"}`} />
            <span className="lu-status__sep">{data.connectionLabel}</span>
            <span className="lu-status__sep">·</span>
            <span className="lu-status__track">{data.track}</span>
            <span className="lu-status__spacer" />
            <span>{data.playback}</span>
            <span className="lu-status__time">{data.clock}</span>
          </div>
        </div>

        {/* subtitle list */}
        <div className="lu-list">
          {data.captions.map((caption, i) => {
            const active = i === data.activeIndex;
            const played = i < data.activeIndex;
            const dotState = active ? "active" : played ? "played" : "upcoming";
            return (
              <div key={`${caption.time}-${i}`} className={`lu-row${active ? " lu-row--active" : ""}`}>
                <span className={`lu-rdot lu-rdot--${dotState}`} />
                <time className="lu-rtime">{caption.time}</time>
                <p className="lu-rtext">{caption.text}</p>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div className="lu-ft">
          <span>{data.source}</span>
          <span>{data.captions.length} 条字幕</span>
        </div>
      </div>
    </div>
  );
}
