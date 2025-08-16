# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build Commands
- `npm run build` or `npm run build:chrome` - Build for Chrome (default)
- `npm run build:firefox` - Build for Firefox
- `npm run dev` or `npm run dev:chrome` - Development mode for Chrome with hot reload
- `npm run dev:firefox` - Development mode for Firefox with hot reload

### Development Workflow
Development uses nodemon with custom configs for each browser:
- Chrome: `nodemon.chrome.json`
- Firefox: `nodemon.firefox.json`

Output directories:
- Chrome: `dist_chrome/`
- Firefox: `dist_firefox/`

## Project Architecture

This is a cross-browser web extension (Chrome/Firefox) built with:
- **React 19** with TypeScript
- **Vite** as the build tool with **@crxjs/vite-plugin** for extension bundling
- **Tailwind CSS 4** for styling
- **Manifest V3** for Chrome extensions

### Extension Pages Structure
The extension includes multiple page types in `src/pages/`:

- **popup/**: Extension popup (opens when clicking extension icon)
- **options/**: Extension options/settings page
- **newtab/**: Overrides browser new tab page
- **content/**: Content script injected into web pages
- **background/**: Service worker for background functionality
- **devtools/**: Developer tools panel integration
- **panel/**: Side panel (not included in build by default)

### Configuration Files
- `manifest.json`: Base manifest configuration
- `manifest.dev.json`: Development-specific manifest overrides
- `vite.config.base.ts`: Base Vite configuration
- `vite.config.chrome.ts`: Chrome-specific build config
- `vite.config.firefox.ts`: Firefox-specific build config
- `custom-vite-plugins.ts`: Custom Vite plugins for extension development

### TypeScript Configuration
Uses path aliases defined in `tsconfig.json`:
- `@src/*`: Maps to `src/*`
- `@assets/*`: Maps to `src/assets/*`
- `@locales/*`: Maps to `src/locales/*`
- `@pages/*`: Maps to `src/pages/*`

### Internationalization
i18n support is available but disabled by default. To enable:
1. Set `localize = true` in `vite.config.base.ts`
2. Use translation files in `src/locales/`

### Adding/Removing Extension Pages
To customize which pages are included:
1. Add/remove directories in `src/pages/`
2. Update `manifest.json` to declare the pages
3. For additional pages, add them to `build.rollupOptions.input` in `vite.config.base.ts`

### Content Scripts
Content script configuration in `manifest.json` targets all URLs (`<all_urls>`) and injects:
- `src/pages/content/index.tsx` (JavaScript)
- `contentStyle.css` (CSS)

### Shadow DOM 特殊注意事项
在Shadow DOM环境中工作时需要注意以下问题：
- **Button事件处理**: HeroUI Button组件的`onPress`事件在Shadow DOM中可能无法正常触发，应该使用`onPressStart`事件替代
- **事件监听**: 某些React事件在Shadow DOM中的行为可能与常规DOM不同，需要使用替代的事件处理方式

### Loading Extension for Testing
**Chrome:**
1. Go to `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select `dist_chrome` folder

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load temporary Add-on"
3. Select any file in `dist_firefox` folder