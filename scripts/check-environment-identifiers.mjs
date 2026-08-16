#!/usr/bin/env node
/**
 * @purpose 校验环境标识、Native v5/Embedded/Cookie 隔离、共享原始音轨、Desktop 双窗口/输入/hover/更新/CLI 与发布边界不漂移。
 * @role    环境隔离 sensor；被 pre-commit 与人工验证调用。
 * @deps    环境矩阵、extension manifests/protocol/bridge、youtube-core、Desktop capabilities/CookieVault/i18n、website/Tauri/CLI/Query 配置
 * @gotcha  ADR-0008/0019：不得恢复英语优先、环境串库、主窗口 NSPanel 化、旧单窗口几何键、启动强装、本地 `.app` 残留、sidecar/updater 发布缺口或轮询；更新确认必须保留 HeroUI 显式操作。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = process.cwd();
const readJson = async (path) =>
  JSON.parse(await readFile(resolve(ROOT, path), "utf8"));

const environments = await readJson("config/listenup-environments.json");
const rootPackage = await readJson("package.json");
const production = environments.production;
const development = environments.development;

const extensionIdPattern = /^[a-p]{32}$/;
assert.match(production.extensionId, extensionIdPattern);
assert.match(development.extensionId, extensionIdPattern);
assert.equal(
  production.extensionId,
  "nocahdalbgboblhbjkacpneakljldfjh",
  "production Extension ID must match the published Chrome Web Store item"
);

for (const field of [
  "extensionId",
  "nativeHostName",
  "desktopBundleId",
  "desktopProductName",
  "deepLinkScheme",
]) {
  assert.notEqual(
    production[field],
    development[field],
    `${field} must differ between production and development`
  );
}

const productionManifest = await readJson("apps/extension/manifest.json");
const developmentManifest = await readJson("apps/extension/manifest.dev.json");
assert.ok(
  productionManifest.permissions.includes("nativeMessaging"),
  "production extension must include nativeMessaging"
);
assert.ok(
  developmentManifest.permissions.includes("nativeMessaging"),
  "development extension must include nativeMessaging"
);
for (const [environmentName, manifest] of [
  ["production", productionManifest],
  ["development", developmentManifest],
]) {
  assert.ok(
    !manifest.permissions.includes("cookies"),
    `${environmentName} Extension must never request browser Cookie access`
  );
}
assert.ok(
  !Object.hasOwn(productionManifest, "key"),
  "production manifest must not include a local key; Chrome Web Store owns its ID"
);

const extensionIdFromKey = (key) => {
  const digest = createHash("sha256")
    .update(Buffer.from(key, "base64"))
    .digest()
    .subarray(0, 16);
  return [...digest]
    .flatMap((byte) => [byte >> 4, byte & 0x0f])
    .map((nibble) => String.fromCharCode("a".charCodeAt(0) + nibble))
    .join("");
};

assert.equal(
  extensionIdFromKey(developmentManifest.key),
  development.extensionId,
  "development manifest key must generate the configured DEV Extension ID"
);

const productionTauri = await readJson(
  "apps/listenup-desktop/src-tauri/tauri.conf.json"
);
const developmentTauri = await readJson(
  "apps/listenup-desktop/src-tauri/tauri.dev.conf.json"
);
const cliTauri = await readJson(
  "apps/listenup-desktop/src-tauri/tauri.cli.conf.json"
);
assert.equal(productionTauri.identifier, production.desktopBundleId);
assert.equal(productionTauri.productName, production.desktopProductName);
assert.equal(
  productionTauri.mainBinaryName,
  "listenup-desktop",
  "ADR-0008: the CLI binary must never replace the Tauri GUI executable"
);
assert.equal(developmentTauri.identifier, development.desktopBundleId);
assert.equal(developmentTauri.productName, development.desktopProductName);
assert.deepEqual(developmentTauri.bundle.externalBin, [
  "target/sidecars/listenup",
]);
assert.deepEqual(cliTauri.bundle.externalBin, ["target/sidecars/listenup"]);

const defaultCapability = await readJson(
  "apps/listenup-desktop/src-tauri/capabilities/default.json"
);
const cinemaCapability = await readJson(
  "apps/listenup-desktop/src-tauri/capabilities/cinema.json"
);
assert.deepEqual(defaultCapability.webviews, ["main"]);
assert.deepEqual(cinemaCapability.webviews, ["cinema"]);
assert.ok(!Object.hasOwn(defaultCapability, "windows"));
assert.ok(
  defaultCapability.permissions.includes("clipboard-manager:allow-write-text"),
  "trusted main must retain explicit copy support"
);
assert.ok(
  !defaultCapability.permissions.includes("clipboard-manager:allow-read-text"),
  "source switching must use the user paste event instead of background clipboard reads"
);
assert.ok(
  !defaultCapability.permissions.some((permission) =>
    permission.includes("global-shortcut")
  ),
  "Desktop must never steal Command+V or Ctrl+V with a global shortcut"
);
for (const permission of [
  "allow-clear-youtube-cookies",
  "allow-embedded-source-event",
  "allow-fetch-youtube-caption-document",
  "allow-fetch-youtube-player-response",
  "allow-get-embedded-player-host-url",
  "allow-get-youtube-cookie-status",
  "allow-enter-cinema-mode",
  "allow-ensure-window-visible",
  "allow-reload-embedded-playback",
  "allow-report-embedded-player-failure",
  "allow-replace-embedded-playback",
  "allow-save-youtube-cookies",
  "allow-select-subtitle-session",
  "allow-set-vibrancy",
  "allow-viewer-read",
]) {
  assert.ok(
    defaultCapability.permissions.includes(permission),
    `main must retain ${permission} after custom command ACL is enabled`
  );
}
const mainWindowPermissionSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/permissions/embedded-player.toml"),
  "utf8"
);
assert.match(
  mainWindowPermissionSource,
  /identifier = "allow-enter-cinema-mode"[\s\S]*commands\.allow = \["enter_cinema_mode"\]/,
  "only the main capability should expose the cinema entry command"
);
for (const permission of [
  "allow-control-playback",
  "allow-ensure-window-visible",
  "allow-exit-cinema-mode",
  "allow-select-subtitle-session",
  "allow-set-vibrancy",
  "allow-viewer-read",
]) {
  assert.ok(
    cinemaCapability.permissions.includes(permission),
    `cinema must retain ${permission}`
  );
}
for (const forbiddenPermission of [
  "allow-enter-cinema-mode",
  "allow-save-youtube-cookies",
  "allow-start-embedded-playback",
  "updater:default",
]) {
  assert.ok(
    !cinemaCapability.permissions.includes(forbiddenPermission),
    `cinema must not receive ${forbiddenPermission}`
  );
}
const iframePlayerSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src/useYoutubeIframePlayer.ts"),
  "utf8"
);
assert.match(iframePlayerSource, /get_embedded_player_host_url/);
assert.match(iframePlayerSource, /event\.source !== iframe\.contentWindow/);
assert.match(iframePlayerSource, /event\.origin !== playerOrigin/);
assert.doesNotMatch(
  iframePlayerSource,
  /contentDocument|contentWindow\.document|document\.cookie|ytInitialPlayerResponse/,
  "main must not read cross-origin iframe DOM, Cookie, or internal player response"
);
const embeddedPlayerHostSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/embedded_player_host.rs"),
  "utf8"
);
assert.match(embeddedPlayerHostSource, /https:\/\/www\.youtube\.com\/iframe_api/);
assert.match(embeddedPlayerHostSource, /enablejsapi:\s*1/);
assert.match(embeddedPlayerHostSource, /origin:\s*location\.origin/);
assert.match(embeddedPlayerHostSource, /TcpListener::bind\(\("127\.0\.0\.1", 0\)\)/);
assert.doesNotMatch(
  embeddedPlayerHostSource.replace(/#\[cfg\(test\)\][\s\S]*$/, ""),
  /__TAURI__|document\.cookie/i
);
const embeddedLayoutSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src/App.tsx"),
  "utf8"
);
assert.match(embeddedLayoutSource, /<EmbeddedVideoPanel/);
assert.match(embeddedLayoutSource, /<SubtitleViewer/);
assert.doesNotMatch(
  embeddedLayoutSource,
  /PlayerShell/,
  "Desktop iframe mode must reuse the existing main layout and SubtitleViewer"
);
assert.doesNotMatch(
  embeddedLayoutSource,
  /set_vibrancy", \{ enabled: false \}/,
  "Desktop iframe mode must preserve the home layout vibrancy and transparency"
);
assert.doesNotMatch(
  embeddedLayoutSource,
  /setMinSize\(new LogicalSize\(720, 620\)\)/,
  "Desktop iframe mode must preserve the home layout minimum window size"
);
assert.doesNotMatch(
  embeddedLayoutSource,
  /embeddedWindowActiveRef|failed to (?:expand|restore) embedded iframe layout/,
  "entering or exiting Desktop iframe mode must not resize the user's window"
);
const embeddedRustSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/embedded_source.rs"),
  "utf8"
);
assert.match(embeddedRustSource, /MAX_SESSION_MESSAGE_BYTES: usize = 4 \* 1024 \* 1024/);
assert.match(embeddedRustSource, /MAX_INCREMENTAL_MESSAGE_BYTES: usize = 8 \* 1024/);
assert.match(embeddedRustSource, /TokenBucket::new\(20, 10, now\)/);

const embeddedPlayerSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/embedded_player.rs"),
  "utf8"
);
assert.doesNotMatch(
  embeddedPlayerSource,
  /WindowBuilder|WebviewBuilder|WebviewUrl|initialization_script|add_child/,
  "iframe playback must not recreate a Player window or remote watch child WebView"
);
assert.doesNotMatch(
  embeddedPlayerSource,
  /pause_warning/,
  "Browser pause results must never surface after Desktop takes source authority"
);
assert.match(
  embeddedPlayerSource,
  /tauri::async_runtime::spawn[\s\S]*PlaybackAction::Pause/,
  "Browser pause must remain fire-and-forget after the Embedded lock is established"
);
const youtubeSubtitleSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/youtube_subtitles.rs"),
  "utf8"
);
assert.match(youtubeSubtitleSource, /url\.path\(\) != "\/api\/timedtext"/);
assert.match(youtubeSubtitleSource, /key == "v" && value == expected_video_id/);
assert.match(youtubeSubtitleSource, /TVHTML5_SIMPLY/);
assert.match(youtubeSubtitleSource, /x-goog-visitor-id/);
assert.match(youtubeSubtitleSource, /bytes\.is_empty\(\)/);
assert.match(youtubeSubtitleSource, /Finder \/ LaunchServices/);
assert.match(youtubeSubtitleSource, /matches!\(shell\.as_str\(\), "\/bin\/zsh" \| "\/bin\/bash"\)/);
assert.match(youtubeSubtitleSource, /for attempt in 0\.\.3/);
assert.match(youtubeSubtitleSource, /error\.is_connect\(\) \|\| error\.is_timeout\(\)/);
assert.match(youtubeSubtitleSource, /StatusCode::TOO_MANY_REQUESTS/);
assert.match(youtubeSubtitleSource, /response\.status\(\)\.is_server_error\(\)/);
assert.match(youtubeSubtitleSource, /static YOUTUBE_CLIENT: OnceLock/);
assert.match(youtubeSubtitleSource, /YOUTUBE_CLIENT\.get_or_init\(build_client\)/);
assert.doesNotMatch(
  youtubeSubtitleSource,
  /proxy_url.*(?:println|dbg)|(?:println|dbg).*proxy_url/,
  "ADR-0015: resolved proxy URLs or credentials must never enter logs"
);
const captionTransportSource = youtubeSubtitleSource.match(
  /pub\(crate\) async fn fetch_youtube_caption_document[\s\S]*?(?=\n}\n\n#\[cfg\(test\)\])/
)?.[0];
assert.ok(captionTransportSource, "ADR-0015: caption transport must remain inspectable");
assert.match(captionTransportSource, /USER_AGENT, TV_USER_AGENT/);
assert.match(
  captionTransportSource,
  /with_cookie\(request, &vault\)/,
  "ADR-0015: timedtext must keep the same manual Cookie identity as watch and TV player"
);
assert.equal(
  (youtubeSubtitleSource.match(/with_cookie\(request, &vault\)/g) ?? []).length,
  3,
  "ADR-0015: watch, TV player, and timedtext must share one Cookie identity"
);
assert.doesNotMatch(
  youtubeSubtitleSource,
  /\b(?:e?println|dbg)!\s*\(/,
  "YouTube subtitle transport must never log Cookie-bearing request state"
);

const cookieVaultSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/cookie_vault.rs"),
  "utf8"
);
assert.match(cookieVaultSource, /env!\("LISTENUP_BUNDLE_ID"\)/);
assert.match(cookieVaultSource, /youtube-cookie-vault/);
assert.doesNotMatch(
  cookieVaultSource,
  /\b(?:e?println|dbg)!\s*\(/,
  "Cookie vault must never log secret-bearing state"
);
for (const boundaryPath of [
  "apps/listenup-desktop/src/types.ts",
  "apps/listenup-desktop/src-tauri/src/source_coordinator.rs",
  "apps/listenup-desktop/src-tauri/src/database/mod.rs",
  "apps/extension/src/shared/nativeSubtitleProtocol.ts",
]) {
  const source = await readFile(resolve(ROOT, boundaryPath), "utf8");
  assert.doesNotMatch(
    source,
    /cookie/i,
    `${boundaryPath} must not gain Cookie fields or transport paths`
  );
}

assert.equal(
  rootPackage.scripts["clean:desktop:bundles"],
  "node apps/listenup-desktop/scripts/clean-bundle-artifacts.mjs",
  "local Desktop app bundles need one stable cleanup command"
);
const cleanBundleSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/scripts/clean-bundle-artifacts.mjs"),
  "utf8"
);
assert.match(cleanBundleSource, /resolve\(desktopRoot, "src-tauri", "target"\)/);
assert.match(cleanBundleSource, /listenUpAppPattern/);
assert.doesNotMatch(
  cleanBundleSource.replace(/\/\*\*[\s\S]*?\*\//, ""),
  /rm\([^\n]*Applications/,
  "bundle cleanup must never delete an installed app"
);
const releaseGuideSource = await readFile(
  resolve(ROOT, "docs/topics/release-and-distribution.md"),
  "utf8"
);
assert.match(
  releaseGuideSource,
  /每次本地完整构建或 bundle 手工回归结束后，必须运行 `pnpm clean:desktop:bundles`/,
  "release docs must require cleanup after every local app bundle test"
);

const prepareCliSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/scripts/prepare-cli.mjs"),
  "utf8"
);
assert.match(
  prepareCliSource,
  /delete cargoEnvironment\.TAURI_CONFIG/,
  "CLI sidecar bootstrap must not inherit Tauri's externalBin overlay"
);

const desktopReleaseWorkflow = await readFile(
  resolve(ROOT, ".github/workflows/release-desktop.yml"),
  "utf8"
);
assert.match(
  desktopReleaseWorkflow,
  /xcrun notarytool submit "\$DMG_PATH"/,
  "release workflow must notarize the finished DMG, not only the app bundle"
);
assert.match(desktopReleaseWorkflow, /xcrun stapler staple "\$DMG_PATH"/);
assert.match(
  desktopReleaseWorkflow,
  /gh release upload "v\$\{VERSION\}" "\$UPLOAD_PATH" --clobber/,
  "release workflow must replace the pre-notarization draft DMG asset"
);
assert.match(
  desktopReleaseWorkflow,
  /releaseDraft: true/,
  "release workflow must keep assets private until post-build checks finish"
);
const replaceDmgIndex = desktopReleaseWorkflow.indexOf(
  'gh release upload "v${VERSION}" "$UPLOAD_PATH" --clobber'
);
const rewriteUpdaterIndex = desktopReleaseWorkflow.indexOf(
  "node scripts/rewrite-updater-json.mjs"
);
const publishReleaseIndex = desktopReleaseWorkflow.indexOf(
  'gh release edit "v${VERSION}" --draft=false'
);
assert.ok(
  rewriteUpdaterIndex > replaceDmgIndex,
  "release workflow must rewrite updater metadata after replacing the finished DMG"
);
assert.ok(
  publishReleaseIndex > rewriteUpdaterIndex,
  "release workflow must publish only after updater metadata uses a public download URL"
);

const rewriteUpdaterSource = await readFile(
  resolve(ROOT, "scripts/rewrite-updater-json.mjs"),
  "utf8"
);
assert.match(
  rewriteUpdaterSource,
  /github\.com\/\$\{repository\}\/releases\/download\/\$\{tag\}\/\$\{assetName\}/,
  "updater metadata must use the public GitHub Release download URL, not api.github.com"
);

const protocolSource = await readFile(
  resolve(
    ROOT,
    "apps/extension/src/shared/nativeSubtitleProtocol.ts"
  ),
  "utf8"
);
assert.match(protocolSource, /__LISTENUP_NATIVE_HOST__/);
assert.match(protocolSource, /__LISTENUP_DEEP_LINK__/);
assert.match(protocolSource, /NATIVE_SUBTITLE_PROTOCOL_VERSION = 5/);
assert.match(protocolSource, /playbackEpoch: number/);
assert.match(protocolSource, /vssId: string/);
assert.match(protocolSource, /isDefault: boolean/);
assert.match(
  protocolSource,
  /kind: "playbackCommand"[\s\S]*commandId: string[\s\S]*tabId: number[\s\S]*sessionId: string[\s\S]*videoId: string[\s\S]*action: NativeSubtitlePlaybackAction/,
  "ADR-0009: playback commands must retain full tab/session/video identity"
);

const selectorSource = await readFile(
  resolve(
    ROOT,
    "packages/youtube-core/src/captionTrack.ts"
  ),
  "utf8"
);
assert.doesNotMatch(
  selectorSource,
  /preferredLanguages|TrackPreference/,
  "ADR-0008: callers must not override the original audio language"
);
assert.match(
  selectorSource,
  /tracks\.find\(\(track\) => track\.isOriginalAudioLanguage\)/,
  "ADR-0008: the original audio language must win before caption defaults/order"
);

const pageBridgeSource = await readFile(
  resolve(ROOT, "apps/extension/public/scripts/inject-youtube.js"),
  "utf8"
);
assert.match(pageBridgeSource, /audioIsDefault\s*===\s*true/);
assert.match(pageBridgeSource, /originalAudioTrack/);

const websitePageSource = await readFile(
  resolve(ROOT, "apps/website/app/page.tsx"),
  "utf8"
);
assert.match(websitePageSource, /releases\/latest/);
assert.doesNotMatch(
  websitePageSource,
  /const\s+VERSION\s*=/,
  "the latest-release website must not require a handwritten Desktop version"
);
assert.doesNotMatch(
  websitePageSource,
  />\s*v\d+\.\d+\.\d+\s*</,
  "the website must not show a release version that can drift from releases/latest"
);

const rustSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/lib.rs"),
  "utf8"
);
assert.match(rustSource, /const PROTOCOL_VERSION: u8 = 5/);
assert.match(rustSource, /playback_epoch: u64/);
assert.match(
  rustSource,
  /bridge_id: u64/,
  "ADR-0009: Desktop sessions and playback results must remain bridge-bound"
);
assert.match(
  rustSource,
  /setAcceptsMouseMovedEvents: true/,
  "NSPanel must keep distributing mouse-moved events after native state changes"
);
assert.match(
  rustSource,
  /updateTrackingAreas/,
  "NSPanel must recalculate WebView tracking areas after resize/vibrancy changes"
);
assert.match(
  rustSource,
  /const CINEMA_WINDOW_LABEL: &str = "cinema"/,
  "the overlay must have a dedicated native window label"
);
assert.doesNotMatch(
  rustSource,
  /setBecomesKeyOnlyIfNeeded:\s*false/,
  "the dedicated cinema NSPanel has no text input and must stay nonactivating"
);
assert.match(
  rustSource,
  /fn configure_cinema_panel_on_main_thread[\s\S]*object_setClass[\s\S]*setBecomesKeyOnlyIfNeeded:\s*true/,
  "only the dedicated cinema window may be converted into a nonactivating NSPanel"
);
assert.match(
  rustSource,
  /fn enter_cinema_mode[\s\S]*CINEMA_WINDOW_LABEL[\s\S]*\.always_on_top\(true\)/,
  "cinema must be created as the only always-on-top runtime window"
);
assert.match(
  rustSource,
  /fn ensure_window_visible[\s\S]*has_visible_window_area[\s\S]*\.center\(\)/,
  "restored geometry must recover when it no longer intersects a connected display"
);
assert.doesNotMatch(rustSource, /activate_text_input|activateIgnoringOtherApps|makeKeyWindow/);
assert.doesNotMatch(rustSource, /mod app_mode|AppMode|Focused\(false\)/);
assert.equal(productionTauri.app.windows[0].alwaysOnTop, false);
assert.equal(developmentTauri.app.windows[0].alwaysOnTop, false);

for (const inputWrapperPath of [
  "apps/listenup-desktop/src/components/ui/DesktopTextField.tsx",
  "apps/listenup-desktop/src/components/ui/DesktopSecretArea.tsx",
]) {
  const inputWrapperSource = await readFile(resolve(ROOT, inputWrapperPath), "utf8");
  assert.doesNotMatch(inputWrapperSource, /@tauri-apps\/api\/core|activate_text_input/);
}

const desktopAppSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src/App.tsx"),
  "utf8"
);
assert.match(desktopAppSource, /CINEMA_TOOLBAR_HINT_DURATION_MS = 3_000/);
assert.match(
  desktopAppSource,
  /showCinemaToolbarHint \? "opacity-100" : "opacity-0"/,
  "cinema toolbar must remain discoverable while native hover tracking recovers"
);
assert.match(
  desktopAppSource,
  /state\.phase === "available"[\s\S]*<DesktopButton[\s\S]*onPress=\{onInstall\}[\s\S]*>\s*\{t\("update\.updateNow"\)\}\s*<\/DesktopButton>/,
  "startup update notice must require an explicit HeroUI user action"
);
assert.match(
  desktopAppSource,
  /document\.addEventListener\("paste", handlePaste, true\)/,
  "BrowserSource switching must inspect only a user-generated paste event"
);
assert.doesNotMatch(desktopAppSource, /activateDesktopKeyboard|activate_text_input/);
assert.match(desktopAppSource, /resolveWindowViewMode\(CURRENT_WINDOW\.label\)/);
const windowPresentationSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src/windowPresentation.ts"),
  "utf8"
);
assert.match(windowPresentationSource, /listenup-window-position-main-v2/);
assert.match(windowPresentationSource, /listenup-window-position-cinema-v2/);
assert.doesNotMatch(
  windowPresentationSource,
  /listenup-window-position-desktop|listenup-window-size-list|listenup-window-size-cinema"/,
  "dedicated main/cinema windows must not reuse legacy single-panel geometry"
);
assert.doesNotMatch(
  desktopAppSource,
  /readText\s*\(/,
  "Desktop source switching must not proactively read clipboard text"
);

const desktopUpdaterSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src/useDesktopUpdater.ts"),
  "utf8"
);
assert.match(desktopUpdaterSource, /launchCheckStartedRef/);
assert.match(
  desktopUpdaterSource,
  /runUpdateCheck\(\{ installWhenAvailable: false, silent: true \}\)/,
  "launch update check must stay silent and must not install automatically"
);
assert.match(desktopUpdaterSource, /phase: "available"/);

const cliSource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src-tauri/src/cli/mod.rs"),
  "utf8"
);
assert.match(cliSource, /"com\.listenup\.desktop"/);
assert.match(cliSource, /"com\.listenup\.desktop\.dev"/);
assert.match(cliSource, /conflicts_with = "commit"/);

const querySource = await readFile(
  resolve(ROOT, "apps/listenup-desktop/src/useSubtitleView.ts"),
  "utf8"
);
assert.match(querySource, /refetchOnWindowFocus: true/);
assert.doesNotMatch(querySource, /refetchInterval\s*:|PRAGMA\s+data_version|watchFile\s*\(/);

const initialMigration = await readFile(
  resolve(
    ROOT,
    "apps/listenup-desktop/src-tauri/migrations/20260801000000_subtitle_library.sql"
  )
);
assert.equal(
  createHash("sha384").update(initialMigration).digest("hex"),
  "19a225ad81360da4c6e8082f15762c47599b4bf90f92f7a9fb9331901cee7b5eaf439c600898afbc76421fb64f2bcbdc",
  "ADR-0008: published migrations are immutable; add a new migration instead"
);

console.log("✅ production/development environment identifiers are isolated");
