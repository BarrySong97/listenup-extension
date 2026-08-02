/**
 * @purpose 构建期生成社交分享卡片（左文案右产品 mock）。
 * @role    Next 的 OG image 约定文件。
 * @deps    next/og 的 ImageResponse
 * @gotcha  静态导出要求 export const dynamic = "force-static"；satori 不支持 backdrop-filter，毛玻璃是用半透明填充伪造的。见 docs/decisions/0004-website-static-export.md
 */
import { ImageResponse } from "next/og";

export const alt = "ListenUp — Subtitles for anything. One menu bar.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Required for `output: export` — render this image once at build time.
export const dynamic = "force-static";

// Social share card, composed like the landing hero (copy left, product mock
// right). Self-contained — no external fonts or images. Satori has no
// backdrop-filter, so the panel fakes the frosted-glass look with a
// semi-transparent dark fill (the light background shows through as dark-grey)
// plus a top highlight. Labels are English to avoid missing-glyph boxes.
export default function OpengraphImage() {
  const rows = [
    { t: "0:00", text: "Today we're going to learn ten common idioms.", state: "played" },
    { t: "0:12", text: "These are phrases native speakers use every day.", state: "played" },
    { t: "0:24", text: 'The first one is "break the ice."', state: "played" },
    { t: "0:35", text: "It means to start a conversation in a social setting.", state: "active" },
    { t: "0:48", text: "For example, you might tell a joke to break the ice.", state: "upcoming" },
    { t: "1:02", text: '"Hit the books" — this one means to study hard.', state: "upcoming" },
    { t: "1:15", text: "You'd say it before a big exam.", state: "upcoming" },
    { t: "1:28", text: '"Under the weather" means a little sick.', state: "upcoming" },
    { t: "1:40", text: "Try using one in your next conversation.", state: "upcoming" },
  ];

  const dotColor = (s: string) =>
    s === "active" ? "#ff0033" : s === "played" ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.16)";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 60,
          width: "100%",
          height: "100%",
          padding: "0 76px",
          fontFamily: "sans-serif",
          background:
            "radial-gradient(120% 120% at 100% 0%, #eceef3 0%, #f6f6f4 46%, #f4f4f2 100%)",
        }}
      >
        {/* ── left: copy ── */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, maxWidth: 590 }}>
          {/* brand — the real app icon (black tile + white subtitle screen + caption bars) */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="58" height="58" viewBox="0 0 100 100">
              <rect width="100" height="100" rx="22" fill="#1b1d26" />
              <rect x="18" y="27" width="64" height="46" rx="13" fill="#ffffff" />
              <rect x="28" y="40" width="26" height="6.4" rx="3.2" fill="#1b1d26" />
              <rect x="58" y="40" width="14" height="6.4" rx="3.2" fill="#1b1d26" />
              <rect x="28" y="53.5" width="16" height="6.4" rx="3.2" fill="#1b1d26" />
              <rect x="48" y="53.5" width="24" height="6.4" rx="3.2" fill="#1b1d26" />
            </svg>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "#16181d" }}>ListenUp</div>
          </div>

          {/* pill */}
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              alignItems: "center",
              gap: 9,
              marginTop: 28,
              padding: "7px 15px",
              borderRadius: 100,
              background: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(0,0,0,0.1)",
              fontSize: 18,
              color: "#565b64",
            }}
          >
            <div style={{ display: "flex", width: 9, height: 9, borderRadius: 5, background: "#34c759" }} />
            macOS menu-bar app
          </div>

          {/* headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 26,
              fontSize: 60,
              fontWeight: 700,
              color: "#0a0a0a",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            <div style={{ display: "flex" }}>Subtitles for anything.</div>
            <div style={{ display: "flex" }}>One menu bar.</div>
          </div>

          {/* subtext */}
          <div style={{ display: "flex", marginTop: 22, maxWidth: 460, fontSize: 22, lineHeight: 1.4, color: "#565b64" }}>
            Live captions for whatever&apos;s playing on your Mac — click any line to replay it.
          </div>
        </div>

        {/* ── right: subtitle-window mock — slender, frosted-glass, fully in frame ── */}
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            flexDirection: "column",
            width: 322,
            borderRadius: 20,
            background: "linear-gradient(180deg, rgba(40,42,52,0.84), rgba(20,22,28,0.82))",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 40px 80px rgba(24,18,44,0.3)",
            overflow: "hidden",
          }}
        >
          {/* header */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "15px 16px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="23" height="23" viewBox="0 0 24 24">
                <path
                  fill="#FF0000"
                  d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
                />
                <path fill="#FFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <div style={{ display: "flex", flex: 1, fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>
                10 Common English Idioms
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5, color: "rgba(255,255,255,0.42)" }}>
              <div style={{ display: "flex", width: 7, height: 7, borderRadius: 4, background: "#30d158" }} />
              Connected · English (auto) · Playing
            </div>
          </div>

          {/* rows */}
          <div style={{ display: "flex", flexDirection: "column", padding: "7px 7px" }}>
            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 11,
                  padding: "9px 10px",
                  borderRadius: 10,
                  background: r.state === "active" ? "rgba(255,255,255,0.09)" : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginTop: 7,
                    background: dotColor(r.state),
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    width: 32,
                    marginTop: 1,
                    fontSize: 12,
                    color: r.state === "active" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.34)",
                  }}
                >
                  {r.t}
                </div>
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    fontSize: 14.5,
                    lineHeight: 1.4,
                    fontWeight: r.state === "active" ? 500 : 400,
                    color: r.state === "active" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {r.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
