/**
 * @purpose 写死的展示用假数据（标题、连接状态、字幕列表）与相关类型。
 * @role    SubtitlePanelMock 的默认内容。
 * @deps    无
 * @gotcha  纯假数据，别接真实来源；字段形状跟着桌面端列表模式走
 */
/** Fake, hard-coded content for the ListenUp Desktop subtitle-window mock.
 *  Shape mirrors what App.tsx renders in list mode. */

export type Caption = { time: string; text: string };

export type SubtitleMock = {
  /** window title — the currently-playing video */
  title: string;
  connected: boolean;
  /** header status label, e.g. "已连接" / "等待扩展连接" */
  connectionLabel: string;
  /** subtitle track name */
  track: string;
  /** playback state label, e.g. "同步播放中" */
  playback: string;
  /** current playback time, e.g. "0:35" */
  clock: string;
  /** footer left, e.g. "YouTube · dQw4w9WgXcQ" */
  source: string;
  captions: Caption[];
  /** index into `captions` that is currently active */
  activeIndex: number;
};

export const DEFAULT_MOCK: SubtitleMock = {
  title: "10 Common English Idioms",
  connected: true,
  connectionLabel: "已连接",
  track: "English · 自动字幕",
  playback: "同步播放中",
  clock: "0:35",
  source: "YouTube · dQw4w9WgXcQ",
  activeIndex: 3,
  captions: [
    { time: "0:00", text: "Today we're going to learn ten common English idioms." },
    { time: "0:12", text: "These are phrases native speakers use every day." },
    { time: "0:24", text: 'The first one is "break the ice."' },
    { time: "0:35", text: "It means to start a conversation in a social setting." },
    { time: "0:48", text: "For example, you might tell a joke to break the ice." },
    { time: "1:02", text: '"Hit the books" — this one means to study hard.' },
    { time: "1:15", text: "You'd say it before a big exam." },
    { time: "1:28", text: 'Next up: "under the weather," meaning a little sick.' },
  ],
};
