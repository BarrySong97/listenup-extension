import { LogoMark, SubtitlePanelMock } from "@listenup/mock-ui";

const DOWNLOAD_URL = "#";
const GITHUB_URL = "#";
const VERSION = "v0.1.0";

export default function Home() {
  return (
    <main className="relative flex min-h-[100vh] flex-col bg-white font-sans text-[#16181d]">

      {/* ── nav ── */}
      <nav className="sticky top-0 z-20 border-b border-transparent bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-6">
          <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#1b1d26] text-white">
              <LogoMark size={17} />
            </span>
            ListenUp
          </a>
          <div className="flex items-center gap-6 text-[14px] text-black/55">
            <a href={GITHUB_URL} className="transition-colors hover:text-black">
              GitHub
            </a>
            <span className="font-mono text-[12.5px] text-black/40">{VERSION}</span>
          </div>
        </div>
      </nav>

      {/* ── content ── */}
      <section className="mx-auto grid w-full max-w-[1180px] flex-1 items-center gap-14 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8 lg:py-16">
        {/* left — copy */}
        <div className="max-w-[560px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-black/60 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34c759] shadow-[0_0_7px_#34c759]" />
            macOS menu-bar app
          </span>

          <h1 className="mt-6 text-[clamp(42px,6vw,66px)] font-semibold leading-[1.02] tracking-[-0.03em] text-balance">
            Subtitles for anything.
            <br />
            One menu bar.
          </h1>

          <p className="mt-6 max-w-[500px] text-[18px] leading-[1.55] text-black/60 text-pretty">
            ListenUp captions whatever&apos;s playing on YouTube in real time.
            Click any line to replay it, and put your subtitles anywhere you
            want. It lives quietly in your menu bar.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={DOWNLOAD_URL}
              className="inline-flex items-center gap-2.5 rounded-[12px] bg-[#141416] px-6 py-[13px] text-[15.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-px"
            >
              <AppleIcon />
              Download for macOS
              <span className="font-mono text-[12px] font-normal text-white/55">
                {VERSION}
              </span>
            </a>
          </div>

          <p className="mt-4 font-mono text-[12.5px] text-black/45">
            Free · macOS 13+
          </p>
        </div>

        {/* right — the menu-bar mock */}
        <div className="flex justify-center lg:justify-end">
          <SubtitlePanelMock />
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-6 py-8 text-[13px] text-black/45">
        <span>© 2026 ListenUp</span>
        <a
          href="https://twitter.com/listenup"
          className="hover:text-black/70"
          target="_blank"
          rel="noreferrer"
        >
          Twitter
        </a>
      </footer>
    </main>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.9c.02 2.5 2.2 3.33 2.22 3.34-.02.06-.35 1.2-1.15 2.37-.69 1.02-1.4 2.03-2.53 2.05-1.1.02-1.46-.65-2.72-.65-1.26 0-1.66.63-2.7.67-1.09.04-1.92-1.1-2.62-2.11-1.42-2.06-2.5-5.83-1.05-8.38.72-1.27 2.01-2.07 3.41-2.09 1.07-.02 2.08.72 2.73.72.65 0 1.88-.89 3.17-.76.54.02 2.06.22 3.03 1.64-.08.05-1.81 1.06-1.79 3.15M14.3 5.4c.58-.7.97-1.67.86-2.64-.83.03-1.84.55-2.44 1.25-.54.62-1.01 1.6-.88 2.55.93.07 1.87-.47 2.46-1.16"/>
    </svg>
  );
}
