/**
 * @purpose 商店图草案画布与三个方向的切换交互。
 * @role    组合 ListenUp 品牌、Extension 字幕面板与 Desktop 浮窗的静态营销分镜。
 * @deps    @listenup/mock-ui、./ConceptGallery.module.css
 * @gotcha  草图只使用真实产品组件与 HTML UI；画布固定 1280×800，外层负责按视口缩放。
 */
"use client";

import { LogoMark, SubtitlePanelMock, YoutubeLogo } from "@listenup/mock-ui";
import { useState } from "react";
import styles from "./ConceptGallery.module.css";

type ConceptId = "brand" | "feature" | "desktop";

const CONCEPTS: Array<{ id: ConceptId; label: string; note: string }> = [
  { id: "brand", label: "01 品牌首图", note: "Trancy 式价值表达" },
  { id: "feature", label: "02 单功能分镜", note: "Migaku 式一图一卖点" },
  { id: "desktop", label: "03 双端联动", note: "ListenUp 独有差异点" },
];

const CAPTIONS = [
  ["03:42", "Today we’re going to learn ten common English idioms."],
  ["03:48", "These are phrases native speakers use every day."],
  ["03:54", "The first one is “break the ice.”"],
  ["04:01", "It means to start a conversation in a social setting."],
  ["04:08", "You might tell a joke to break the ice."],
] as const;

function BrandLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`${styles.brand} ${inverse ? styles.brandInverse : ""}`}>
      <span className={styles.brandMark}><LogoMark size={24} /></span>
      <span>ListenUp</span>
    </div>
  );
}

function BrowserPanel({ explain = false }: { explain?: boolean }) {
  return (
    <div className={styles.browserPanel} aria-label="ListenUp on YouTube product mock">
      <div className={styles.browserBar}>
        <span className={styles.browserProduct}>youtube.com</span>
        <span className={styles.browserStatus}>ListenUp active</span>
      </div>
      <div className={styles.browserBody}>
        <div className={styles.videoStage}>
          <div className={styles.videoBrand}><YoutubeLogo size={34} /> YouTube</div>
          <div className={styles.videoTitle}>10 English Idioms Native Speakers Use</div>
          <div className={styles.playerCaption}>
            The first one is <strong>“break the ice.”</strong>
          </div>
          <div className={styles.playerProgress}><span /></div>
        </div>
        <div className={styles.extensionPanel}>
          <div className={styles.extensionHead}>
            <BrandLockup />
            <span className={styles.extensionMode}>LIVE</span>
          </div>
          <div className={styles.captionList}>
            {CAPTIONS.map(([time, text], index) => (
              <div
                className={`${styles.captionRow} ${index === 2 ? styles.captionActive : ""}`}
                key={time}
              >
                <time>{time}</time>
                <p>{text}</p>
                {index === 2 && !explain ? (
                  <div className={styles.selectionMenu}>
                    <button type="button">Copy</button>
                    <button type="button">Explain</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {explain ? (
            <div className={styles.explainCard}>
              <div className={styles.explainTop}>
                <strong>break the ice</strong>
                <span>idiom</span>
              </div>
              <p>To make people feel more relaxed when meeting for the first time.</p>
              <div className={styles.explainExample}>“A quick joke helped break the ice.”</div>
            </div>
          ) : (
            <div className={styles.panelActions}>
              <span>Loop this line</span>
              <span>Record yourself</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandConcept() {
  return (
    <article className={`${styles.artboard} ${styles.brandConcept}`}>
      <div className={styles.conceptMeta}>
        <BrandLockup inverse />
        <span>Interactive subtitles for YouTube</span>
      </div>
      <div className={styles.brandCopy}>
        <p className={styles.eyebrowDark}>WATCH · UNDERSTAND · SPEAK</p>
        <h1>Learn English from videos you already love.</h1>
        <p>Replay any sentence, ask AI what it means, and practice speaking without leaving YouTube.</p>
        <div className={styles.darkPills}>
          <span>Click to replay</span>
          <span>AI explanations</span>
          <span>Voice practice</span>
        </div>
      </div>
      <div className={styles.brandProduct}><BrowserPanel /></div>
      <div className={styles.brandFooter}>One video. A complete language lesson.</div>
    </article>
  );
}

function FeatureConcept() {
  return (
    <article className={`${styles.artboard} ${styles.featureConcept}`}>
      <div className={styles.featureHeader}>
        <BrandLockup inverse />
        <span>AI-powered language learning</span>
      </div>
      <h1>Click any subtitle.<br />Understand every phrase.</h1>
      <p className={styles.featureSub}>From unfamiliar words to meaning, grammar, and natural usage—in one focused view.</p>
      <div className={styles.featureProduct}><BrowserPanel explain /></div>
      <div className={styles.featureIndex}>02 / AI EXPLAIN</div>
    </article>
  );
}

function DesktopConcept() {
  return (
    <article className={`${styles.artboard} ${styles.desktopConcept}`}>
      <div className={styles.desktopHeader}>
        <BrandLockup />
        <span>Chrome Extension + macOS Desktop</span>
      </div>
      <div className={styles.desktopCopy}>
        <p className={styles.eyebrowLight}>SUBTITLES THAT FOLLOW YOU</p>
        <h1>Your subtitles,<br />out of the browser.</h1>
        <p>Keep the video full-screen. ListenUp sends every line to a focused Desktop window that stays in sync.</p>
        <div className={styles.desktopProof}>
          <span><b>1</b> Play on YouTube</span>
          <span><b>2</b> Read anywhere on your Mac</span>
        </div>
      </div>
      <div className={styles.desktopVisual}>
        <div className={styles.miniBrowser}><BrowserPanel /></div>
        <div className={styles.desktopWindow}><SubtitlePanelMock /></div>
      </div>
      <div className={styles.desktopFooter}>The only subtitle extension with a native macOS companion.</div>
    </article>
  );
}

export function ConceptGallery() {
  const [active, setActive] = useState<ConceptId>("brand");

  return (
    <main className={styles.gallery}>
      <header className={styles.galleryHeader}>
        <div>
          <p>LISTENUP · CHROME WEB STORE</p>
          <h1>商店图方向草案</h1>
        </div>
        <span>1280 × 800 · Round 01</span>
      </header>

      <nav className={styles.tabs} aria-label="Store screenshot concepts">
        {CONCEPTS.map((concept) => (
          <button
            className={active === concept.id ? styles.tabActive : ""}
            key={concept.id}
            onClick={() => setActive(concept.id)}
            type="button"
          >
            <strong>{concept.label}</strong>
            <span>{concept.note}</span>
          </button>
        ))}
      </nav>

      <section className={styles.canvasShell}>
        {active === "brand" ? <BrandConcept /> : null}
        {active === "feature" ? <FeatureConcept /> : null}
        {active === "desktop" ? <DesktopConcept /> : null}
      </section>

      <p className={styles.galleryHint}>点击上方三个方向切换。草图先看信息结构和气质，选中后再精修文案、素材和尺寸安全区。</p>
    </main>
  );
}
