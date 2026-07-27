/**
 * @purpose Publish ListenUp's public privacy policy for website and Chrome Web Store users.
 * @role    Static legal-information route at /privacy.
 * @deps    next/metadata
 * @gotcha  Keep this page statically renderable and update it whenever extension data handling changes.
 */
import type { Metadata } from "next";
import Link from "next/link";

const EFFECTIVE_DATE = "July 25, 2026";
const GITHUB_ISSUES_URL =
  "https://github.com/BarrySong97/listenup-extension/issues";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How ListenUp handles subtitles, AI settings, microphone audio, and other user data.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 font-sans text-[#16181d] sm:py-24">
      <article className="mx-auto max-w-[760px]">
        <Link
          href="/"
          className="text-sm font-medium text-black/55 transition-colors hover:text-black"
        >
          ← ListenUp
        </Link>

        <header className="mt-10 border-b border-black/10 pb-10">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-black/40">
            Effective {EFFECTIVE_DATE}
          </p>
          <h1 className="mt-4 text-[clamp(40px,8vw,64px)] font-semibold leading-none tracking-[-0.04em]">
            Privacy Policy
          </h1>
          <p className="mt-6 text-lg leading-8 text-black/60">
            ListenUp is a language-learning tool for interactive YouTube
            subtitles. This policy explains what information the ListenUp
            browser extension processes, when it leaves your device, and the
            choices available to you.
          </p>
        </header>

        <div className="space-y-12 py-12 text-[16px] leading-7 text-black/68">
          <PolicySection title="Information ListenUp handles">
            <p>
              ListenUp processes YouTube captions, video metadata, playback
              timing, selected subtitle text, and surrounding subtitle context
              to provide replay, looping, transcript, and explanation features.
            </p>
            <p>
              The extension stores settings, subtitle transcripts, cached
              explanations, visual-reference caches, and your configured AI
              service details—including an API key, if you provide one—in
              Chrome&apos;s local extension storage.
            </p>
            <p>
              If you use pronunciation recording, microphone audio is used
              locally for recording and playback. ListenUp does not send those
              recordings to a ListenUp server or an AI provider.
            </p>
          </PolicySection>

          <PolicySection title="When information leaves your device">
            <p>
              ListenUp has no developer-operated account system or data
              collection backend. YouTube captions and playback information
              remain on your device unless you explicitly request a feature
              that uses a third-party service.
            </p>
            <p>
              When you request an AI explanation, the selected subtitle text,
              relevant surrounding context, and the API credential you
              configured are sent directly from the extension to your chosen AI
              service. That service processes the request under its own privacy
              policy and retention terms.
            </p>
            <p>
              When an explanation requests visual references, a search query
              derived from the selected phrase may be sent directly to a
              supported image-search service such as Google, Bing, or Baidu.
            </p>
            <p>
              If you install and run the ListenUp desktop app, the extension
              sends subtitle sessions and playback timing to that app through
              Chrome Native Messaging on the same computer. This local
              communication is not routed through a ListenUp server.
            </p>
          </PolicySection>

          <PolicySection title="How information is used">
            <p>
              Information is used only to provide and improve the feature you
              requested: loading and synchronizing subtitles, saving
              preferences, replaying or looping segments, recording local
              pronunciation practice, generating explanations, finding visual
              references, and exporting transcripts.
            </p>
            <p>
              ListenUp does not sell user data, use it for advertising, transfer
              it for unrelated purposes, or use it to determine creditworthiness
              or eligibility for lending.
            </p>
          </PolicySection>

          <PolicySection title="Retention and your choices">
            <p>
              Data stored by the extension remains in Chrome&apos;s local
              extension storage until it is cleared by you, removed by the
              extension&apos;s cache behavior, or deleted when you uninstall
              the extension. You can stop third-party processing by not using AI
              explanations or visual-reference features and by removing your
              configured API key.
            </p>
            <p>
              Data sent to a third-party AI or search service is retained
              according to that provider&apos;s own terms. ListenUp does not
              control those providers&apos; retention practices.
            </p>
          </PolicySection>

          <PolicySection title="Security">
            <p>
              ListenUp limits data access to the permissions needed for its
              subtitle-learning features and sends third-party requests over
              HTTPS. No storage or transmission method can be guaranteed
              completely secure, so you should protect any API key you choose
              to configure.
            </p>
          </PolicySection>

          <PolicySection title="Changes to this policy">
            <p>
              We may update this policy when ListenUp&apos;s features or data
              practices change. The effective date at the top of this page will
              be updated when a revised policy is published.
            </p>
          </PolicySection>

          <PolicySection title="Contact">
            <p>
              For privacy questions or requests, open an issue in the{" "}
              <a
                href={GITHUB_ISSUES_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#2457d6] underline decoration-[#2457d6]/30 underline-offset-4 hover:decoration-[#2457d6]"
              >
                ListenUp GitHub repository
              </a>
              .
            </p>
          </PolicySection>
        </div>
      </article>
    </main>
  );
}

function PolicySection({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-[-0.02em] text-black">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
