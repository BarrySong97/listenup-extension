import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { isRTL } from "@heroui/react";
import { ClientProviders } from "./provider";
import "./globals.css";
import "@listenup/mock-ui/styles/tokens.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

// The live production origin. Update this if a custom domain is added later.
const SITE_URL = "https://trylistenup.pages.dev";
const SITE_NAME = "ListenUp";
const TITLE = "ListenUp — Subtitles for anything. One menu bar.";
const DESCRIPTION =
  "ListenUp captions whatever's playing on your Mac — YouTube, Netflix, podcasts, live calls — in real time. Click any line to replay it or ask AI what it means. A macOS menu-bar app.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s — ListenUp",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "ListenUp",
    "live subtitles",
    "real-time captions",
    "macOS menu bar app",
    "YouTube subtitles",
    "video transcription",
    "AI subtitle explanations",
    "language learning",
    "listening practice",
    "closed captions",
    "Mac subtitles",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "productivity",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1116" },
  ],
};

// Static English marketing site — no per-request locale detection (that would
// force dynamic rendering and break the static export).
const LANG = "en-US";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={LANG}
      dir={isRTL(LANG) ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ClientProviders lang={LANG}>{children}</ClientProviders>
      </body>
    </html>
  );
}
