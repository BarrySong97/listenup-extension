/**
 * @purpose 落地页唯一页面：导航、主标题、macOS / Chrome 下载 CTA 与右侧桌面端窗口 mock。
 * @role    站点主体内容。
 * @deps    @heroui/react 的 Link、next/link、@listenup/mock-ui 的 SubtitlePanelMock / LogoMark
 * @gotcha  下载按钮用 Link 而不是 Button（HeroUI v3 的 Button 不是链接）；MAC_DOWNLOAD_URL 指向 releases/latest，CHROME_EXTENSION_URL 指向正式商店条目，VERSION 是手写常量，发版后要同步
 */
import { Link } from "@heroui/react";
import { LogoMark, SubtitlePanelMock } from "@listenup/mock-ui";
import NextLink from "next/link";
import type { SVGProps } from "react";

// Always resolves to the newest published GitHub Release (the macOS DMG).
const MAC_DOWNLOAD_URL =
  "https://github.com/BarrySong97/listenup-extension/releases/latest";
const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/nocahdalbgboblhbjkacpneakljldfjh";
const GITHUB_URL = "https://github.com/BarrySong97/listenup-extension";
const VERSION = "v0.2.1";

export default function Home() {
  return (
    <main className="relative flex min-h-[100vh] flex-col bg-white font-sans text-[#16181d]">

      {/* ── nav ── */}
      <nav className="sticky top-0 z-20 border-b border-transparent bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-6">
          <NextLink href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#1b1d26] text-white">
              <LogoMark size={17} />
            </span>
            ListenUp
          </NextLink>
          <div className="flex items-center gap-6 text-[14px] text-black/55">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-black"
            >
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
            <Link
              href={MAC_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Download the latest ListenUp for macOS"
              className="inline-flex items-center gap-2.5 rounded-[12px] bg-[#141416] px-6 py-[13px] text-[15.5px] font-semibold text-white no-underline shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] transition duration-100 data-[hovered]:opacity-90 active:scale-[0.97] data-[pressed]:scale-[0.97]"
            >
              <AppleIcon />
              Download for macOS
              <span className="font-mono text-[12px] font-normal text-white/55">
                {VERSION}
              </span>
            </Link>
            <Link
              href={CHROME_EXTENSION_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Install ListenUp from the Chrome Web Store"
              className="inline-flex items-center gap-2.5 rounded-[12px] border border-black/15 bg-white px-6 py-[13px] text-[15.5px] font-semibold text-[#141416] no-underline shadow-[0_8px_24px_-12px_rgba(0,0,0,0.28)] transition duration-100 data-[hovered]:border-black/25 data-[hovered]:bg-black/[0.03] active:scale-[0.97] data-[pressed]:scale-[0.97]"
            >
              <ChromeWebStoreIcon />
              Get Chrome Extension
            </Link>
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
          href="https://x.com/BarrySong97"
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

function ChromeWebStoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1.15em"
      height="1em"
      viewBox="0 0 256 223"
      aria-hidden="true"
      {...props}
    >
      {/* Icon from SVG Logos by Gil Barbara, copied from the Post website (MIT). */}
      <defs>
        <linearGradient id="chromeWebStoreRed" x1="0%" x2="100%" y1="50%" y2="50%">
          <stop offset="0%" stopColor="#D93025" />
          <stop offset="100%" stopColor="#EA4335" />
        </linearGradient>
        <linearGradient
          id="chromeWebStoreGreen"
          x1="74.943%"
          x2="19.813%"
          y1="95.826%"
          y2="-4.161%"
        >
          <stop offset="0%" stopColor="#1E8E3E" />
          <stop offset="100%" stopColor="#34A853" />
        </linearGradient>
        <linearGradient
          id="chromeWebStoreYellow"
          x1="59.898%"
          x2="21.416%"
          y1="-.134%"
          y2="99.86%"
        >
          <stop offset="0%" stopColor="#FBBC04" />
          <stop offset="100%" stopColor="#FCC934" />
        </linearGradient>
        <path
          id="chromeWebStoreOutline"
          d="M255.983 0H0v204.837c0 9.633 7.814 17.464 17.464 17.464h221.072c9.633 0 17.464-7.814 17.464-17.464z"
        />
      </defs>
      <path
        fill="#F1F3F4"
        d="M255.983 0H0v204.837c0 9.633 7.814 17.464 17.464 17.464h221.072c9.633 0 17.464-7.814 17.464-17.464z"
      />
      <path fill="#E8EAED" d="M0 0h255.983v111.74H0z" />
      <path
        fill="#FFF"
        d="M157.076 47.727H98.907A11.63 11.63 0 0 1 87.27 36.09a11.63 11.63 0 0 1 11.637-11.637h58.169a11.63 11.63 0 0 1 11.637 11.637c0 6.417-5.204 11.637-11.637 11.637"
      />
      <mask id="chromeWebStoreMask" fill="#fff">
        <use href="#chromeWebStoreOutline" />
      </mask>
      <g mask="url(#chromeWebStoreMask)">
        <g transform="translate(17.455 94.293)">
          <path
            fill="url(#chromeWebStoreRed)"
            d="m14.812 55.255l15.241 46.498l32.638 36.427l47.845-82.908l95.724-.017C187.146 22.213 151.443 0 110.536 0s-76.61 22.213-95.724 55.255"
          />
          <path
            fill="url(#chromeWebStoreGreen)"
            d="m110.52 221.105l32.637-36.443l15.224-46.482H62.674L14.812 55.255c-19.047 33.076-20.445 75.128.017 110.561c20.445 35.434 57.545 55.256 95.69 55.29"
          />
          <path
            fill="url(#chromeWebStoreYellow)"
            d="M206.26 55.272h-95.724l47.862 82.908l-47.862 82.925c38.162-.033 75.263-19.855 95.708-55.289c20.461-35.433 19.064-77.468.016-110.544"
          />
          <ellipse cx="110.536" cy="110.544" fill="#F1F3F4" rx="55.255" ry="55.272" />
          <ellipse cx="110.536" cy="110.544" fill="#1A73E8" rx="44.898" ry="44.915" />
        </g>
      </g>
      <path
        fill="#BDC1C6"
        d="M0 111.74h255.983v1.448H0zm0-1.465h255.983v1.448H0z"
        opacity=".1"
      />
    </svg>
  );
}
