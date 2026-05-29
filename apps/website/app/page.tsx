import "./landing.css";
import { ScriptedPanel } from "./_components/ScriptedPanel";

export default function Home() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--ink)", fontFamily: "var(--font-sans)", minHeight: "100vh" }}>
      {/* ── Nav ── */}
      <nav className="nav">
        <a href="/" className="nav-brand">
          <div className="nav-logo" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="14" height="14">
              <rect x="2" y="8" width="2" height="4" rx="1" fill="currentColor"/>
              <rect x="6" y="5" width="2" height="10" rx="1" fill="currentColor"/>
              <rect x="10" y="2" width="2" height="16" rx="1" fill="currentColor"/>
              <rect x="14" y="6" width="2" height="8" rx="1" fill="currentColor"/>
            </svg>
          </div>
          Listen Up
        </a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-cta">
          <a href="#" className="btn btn--ghost">Sign in</a>
          <a href="#" className="btn btn--solid">
            <ChromeIcon />
            Add to Chrome
          </a>
        </div>
      </nav>

      {/* ── Hero B — Asymmetric split ── */}
      <div className="hero hero-b">
        <div className="hero-b-grid">
          {/* Left — copy */}
          <div className="hero-b-left">
            <div className="overline">
              <span className="dot" /> For language learners
            </div>
            <h1 className="hero-b-title">
              Every YouTube video,<br/>
              now <span className="underline">studyable</span>.
            </h1>
            <p className="hero-b-sub">
              Click any line to jump there. Highlight a phrase to ask AI
              what it means. Save the transcript when you&apos;re done. It just
              lives in the sidebar where the recommendations used to be.
            </p>
            <div className="hero-b-ctas">
              <a href="#" className="btn btn--solid btn--lg">
                <ChromeIcon />
                Add to Chrome
              </a>
              <a href="#" className="btn btn--ghost btn--lg">Watch 30s demo</a>
            </div>
            <ul className="hero-b-bullets">
              <li>
                <span className="check">✓</span>
                <div><strong>Click-to-jump.</strong> Hop to any timestamp without scrubbing.</div>
              </li>
              <li>
                <span className="check">✓</span>
                <div><strong>AI explain.</strong> Idioms, grammar, slang — in plain English.</div>
              </li>
              <li>
                <span className="check">✓</span>
                <div><strong>Copy &amp; download.</strong> Full transcripts with timestamps.</div>
              </li>
            </ul>
          </div>

          {/* Right — floating panel with annotations attached to panel edges */}
          <div className="hero-b-right">
            <div className="hero-b-floatwrap">
              <div className="hero-b-shadow" />
              <ScriptedPanel width={380} height={580} initialIndex={0} />

              {/* Left annotations: dot sits on panel's left edge */}
              <div className="annot annot-tl">
                <span className="annot-label">Click any line to jump</span>
                <span className="annot-line" />
                <span className="annot-dot" />
              </div>
              <div className="annot annot-bl">
                <span className="annot-label">Copy or download transcript</span>
                <span className="annot-line" />
                <span className="annot-dot" />
              </div>
              {/* Right annotation: dot sits on panel's right edge */}
              <div className="annot annot-r">
                <span className="annot-label">AI explains selected text</span>
                <span className="annot-line" />
                <span className="annot-dot" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChromeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
      <path d="M12 8h8.66" stroke="#EA4335" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M16.33 21A10 10 0 0 1 3.34 15" stroke="#34A853" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M3.34 9A10 10 0 0 1 12 2" stroke="#4285F4" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
