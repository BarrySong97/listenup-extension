# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ListenUp** is a Chrome/Firefox browser extension for YouTube language learning. It extracts video subtitles, displays them in a floating side panel on YouTube pages, and provides tools for learners: word-level click-to-explain, sentence loop playback, voice recording for pronunciation practice, subtitle copy/download, and a ChatGPT side panel for AI-assisted learning.

## Development Commands

### Build
- `npm run build` / `npm run build:chrome` - Build for Chrome (output: `dist_chrome/`)
- `npm run build:firefox` - Build for Firefox (output: `dist_firefox/`)

### Dev
- `npm run dev` / `npm run dev:chrome` - Dev mode for Chrome (nodemon + hot reload)
- `npm run dev:firefox` - Dev mode for Firefox

Package manager: **pnpm** (see `pnpm-lock.yaml`)

### Loading Extension for Testing
- **Chrome**: `chrome://extensions` -> Enable Developer mode -> Load unpacked -> select `dist_chrome`
- **Firefox**: `about:debugging#/runtime/this-firefox` -> Load temporary Add-on -> select file in `dist_firefox`

## Tech Stack

- **React 19** + TypeScript (strict mode)
- **Vite** with **@crxjs/vite-plugin** for extension bundling
- **Tailwind CSS 4** with `@tailwindcss/vite` plugin
- **HeroUI** (formerly NextUI) component library
- **Jotai** for state management
- **Framer Motion** for animations
- **Iconify** (`@iconify/react`) for icons (using `mdi:*` icon set)
- **virtua** (`VList`) for virtualized subtitle list rendering
- **Manifest V3**

## Architecture

### Extension Entry Points

| Page | Path | Purpose |
|------|------|---------|
| **content** | `src/pages/content/` | Core functionality - injected into YouTube pages, renders subtitle panel in Shadow DOM |
| **popup** | `src/pages/popup/Popup.tsx` | Extension popup (currently template placeholder) |
| **options** | `src/pages/options/` | Settings page (currently template placeholder) |
| **newtab** | `src/pages/newtab/` | New tab override (currently template placeholder) |
| **devtools** | `src/pages/devtools/` | DevTools panel (currently template placeholder) |

### Content Script Architecture (`src/pages/content/`)

The content script is the main feature. It only activates on `youtube.com`.

**Initialization flow** (`index.tsx`):
1. Checks if page is YouTube
2. Creates a Shadow DOM host element (`#__listenup-extension-host`)
3. Injects Tailwind CSS into Shadow DOM (with `rem` -> `em` conversion for isolation)
4. Renders React app (`<App />`) inside Shadow DOM with Jotai Provider + HeroUI Provider

**App component** (`app.tsx`):
- Listens for `yt-navigate-finish` events to detect YouTube SPA navigation
- Extracts video ID from URL and renders `<Subtitles />` keyed by video ID

**YouTube SDK** (`lib/youtube-sdk/`):
A modular SDK for interacting with YouTube's player, composed of:
- `YouTubeSDK` - Main orchestrator, uses `MutationObserver` on `#movie_player` and intercepts `history.pushState`/`replaceState` for SPA navigation
- `YouTubeAdDetector` - Detects ads via `.ad-showing` class on `#movie_player`, reports ad type (skippable/non-skippable/overlay), remaining time
- `YouTubeVideoController` - Controls video playback (`play`/`pause`/`seekTo`/`setVolume`), guards against ad state
- `YouTubeSubtitleExtractor` - Gets subtitle URLs by injecting `public/scripts/inject-youtube.js` into page context to access YouTube's internal `captionTracks` data, then constructs subtitle API URLs with required parameters
- `YouTubeThemeDetector` - Detects dark/light mode by observing `html[dark]` attribute and `ytd-app` element

There is also a legacy `youtubeController.ts` which provides a simpler interface used by subtitle navigation and loop hooks.

**Subtitle Processing Pipeline** (`lib/subtitles/`):
1. `subtitleFetcher.ts` - Manages fetching flow, delegates to parser
2. `subtitleParser.ts` - Auto-detects format (JSON/WebVTT/XML) and parses to `SubtitleItem[]`
3. `subtitleCleaner.ts` - Removes noise (brackets, music symbols, dashes, short/empty entries)
4. `subtitleMerger.ts` - Merges short/adjacent subtitles (configurable thresholds)
5. `subtitleConfig.ts` - Persists merge/clean settings in `localStorage`
6. `subtitleDirectFetcher.ts` - Alternative approach to get subtitles from `ytInitialPlayerResponse`
7. `subtitleTypes.ts` - Core types: `SubtitleItem { id, startTime, endTime, text, originalSubtitles? }`

**React Hooks** (`hooks/`):
- `useSubtitleContent` - Fetches and processes subtitles, caches in `chrome.storage.local`
- `useSubtitleSync` - Tracks `currentTime` from YouTubeSDK callbacks, computes `currentSubtitleIndex` with overlap handling
- `useSubtitleNavigation` - Handles click-to-seek with smart time offset for overlapping subtitles
- `useSubtitleAutoScroll` - Auto-scrolls VList to current subtitle (instant on initial load, smooth after)
- `useSubtitleLoop` - Loop playback of current subtitle segment (100ms polling interval)
- `useAudioRecording` - Microphone recording for pronunciation practice (MediaRecorder API, WebM/Opus)

**UI Components** (`components/`):
- `subtitles.tsx` - Main container: floating card (454x774px, fixed position), slide-in animation, toggle button
- `SubtitleHeader.tsx` - Title bar with copy (all/LLM format) and download (SRT/TXT) dropdown menus
- `SubtitleItem.tsx` - Individual subtitle row: time display, word-level buttons (click copies explain prompt, shift+click selects phrase), copy/explain action buttons
- `SubtitleFooter.tsx` - Playback controls: play/pause segment, loop toggle, audio recording controls
- `SubtitleStates.tsx` - Loading/error/empty/ad state displays
- `PlayerStatusBadge.tsx` - Ad status chip (currently unused in main component tree)

**Shared UI** (`src/components/ui/`):
- `Dropdown.tsx` - Custom dropdown component (needed because HeroUI Dropdown doesn't work well in Shadow DOM), uses `onPressStart` events, manages global open state

### State Management

- **Jotai** atoms in `src/store/playerMonitor.ts` for ad detection state (currently used by `PlayerStatusBadge`)
- Most state is local React state within the `Subtitles` component tree
- YouTubeSDK uses callback-based state propagation

### Permissions & Host Access

```
permissions: activeTab, storage, unlimitedStorage
host_permissions: *://*.youtube.com/*
```

### Web Accessible Resources

`public/scripts/inject-youtube.js` is injected into YouTube page context to extract subtitle metadata from YouTube's internal player API. Accessible only to `*://*.youtube.com/*`.

## Key Patterns & Conventions

### Shadow DOM
The entire content script UI runs inside a Shadow DOM to isolate styles from YouTube's page. Key implications:

- **All CSS uses `em` instead of `rem`**: Tailwind output has `rem` replaced with `em` at injection time (`index.tsx` line 28), and there's a `tailwind-rem-to-em.js` plugin for build-time conversion
- **HeroUI `onPress` does NOT work in Shadow DOM** - always use `onPressStart` instead
- **Custom Dropdown component** exists because HeroUI's built-in Dropdown doesn't work properly in Shadow DOM
- **`:host` selector** is used in `style.css` instead of `:root` for CSS custom properties
- **Dark mode** uses `@custom-variant dark (&:is(.dark *))` in Tailwind config, toggled by adding `.dark` class based on YouTube's theme

### YouTube SPA Navigation
YouTube is a SPA - page navigations don't reload the page. The extension handles this by:
- Listening to `yt-navigate-finish` custom events
- Intercepting `history.pushState` / `history.replaceState`
- Using video ID as React key to force re-mount on video change

### Subtitle Caching
Subtitles are cached in `chrome.storage.local` keyed by `subtitle_${videoId}` to avoid refetching.

## Configuration Files

| File | Purpose |
|------|---------|
| `manifest.json` | Base MV3 manifest |
| `manifest.dev.json` | Dev overrides (dev icons, web accessible resources) |
| `vite.config.base.ts` | Shared Vite config (plugins, publicDir) |
| `vite.config.chrome.ts` | Chrome build config |
| `vite.config.firefox.ts` | Firefox build config |
| `custom-vite-plugins.ts` | `stripDevIcons` (removes dev icons from prod) and `crxI18n` (i18n asset emission) |
| `tailwind-rem-to-em.js` | Tailwind plugin to convert rem units to em for Shadow DOM isolation |
| `tsconfig.json` | TypeScript config with path aliases (`@src/*`, `@assets/*`, `@locales/*`, `@pages/*`) |

## i18n

Disabled by default. To enable: set `localize = true` in `vite.config.base.ts`, then use translation files in `src/locales/`.
