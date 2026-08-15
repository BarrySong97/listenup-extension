# ListenUp Chrome Web Store concepts — design QA

- Source visual truth:
  - `/private/tmp/listenup-ref-trancy.png` — brand-first dark store image reference.
  - `/private/tmp/listenup-ref-migaku.png` — one-feature-per-frame reference.
  - `/private/tmp/listenup-ref-language-reactor.png` — authentic product-screen reference.
- Rendered implementation:
  - `/private/tmp/listenup-store-concepts-brand.png`
  - `/private/tmp/listenup-store-concepts-feature-v3.png`
  - `/private/tmp/listenup-store-concepts-desktop.png`
- Route: `/store-shot/concepts`
- Browser viewport: 1440 × 1100 CSS px, device scale factor 1.
- Source pixels: 1280 × 633 each; implementation pixels: 1440 × 1100 each. The implementation contains a responsive 1280 × 800 CSS artboard plus the design-review controls. Density normalization was unnecessary because every capture used device scale factor 1; composition was compared at full-view scale rather than for pixel-identical cloning.
- States: brand concept, AI Explain concept, Extension + Desktop concept.
- Interactions tested: all three concept tabs switch the visible artboard correctly. Browser console contained only React development/HMR informational messages and no errors.

## Full-view comparison evidence

- Brand concept preserves Trancy's immediate value statement, dark high-contrast field, short feature proof and large product composition, while replacing generic illustration with ListenUp's real product UI.
- AI Explain concept preserves Migaku's single-sentence feature framing and bright solid-color panel, while making the selected subtitle and explanation result the primary product evidence.
- Extension + Desktop concept uses Language Reactor's authentic-product principle but makes ListenUp's native macOS companion the differentiator. Both Extension and Desktop mocks are visible in the same frame.

Focused-region comparison was not required for this first-round direction board: the goal is composition and information hierarchy rather than pixel-identical cloning, and the key product text, selected subtitle, AI card and Desktop active row are legible in the full 1440 × 1100 captures.

## Required fidelity surfaces

- Fonts and typography: Geist loads through the existing Website layout. Display weights, line height and wrapping are consistent across all three directions; headlines remain inside their intended copy columns.
- Spacing and layout rhythm: every concept uses the same 1280 × 800 frame and outer safe margin. Brand, headline and proof elements align to a shared left edge; product crops are intentional and retain the key feature.
- Colors and visual tokens: solid black, blue and warm neutral backgrounds create three distinct directions without introducing a new product-wide theme. Purple is reserved for learning/AI emphasis; YouTube red and Desktop connection green retain their semantic roles.
- Image quality and asset fidelity: visible brand marks use the existing `LogoMark` and `YoutubeLogo`; the Desktop window uses the existing `SubtitlePanelMock`. The Extension and YouTube regions are HTML UI mocks because the deliverable is an HTML direction sketch, not a final raster asset. No third-party competitor artwork was copied into the concepts.
- Copy and content: all claims map to current ListenUp capabilities—subtitle replay, AI explanation, recording practice and Desktop subtitle sync. The Desktop headline expresses the unique cross-app value rather than a generic translation claim.

## Comparison history

1. Initial AI Explain capture had a P2 collision: the supporting sentence occupied the same region as the rising product mock, and the right edge hid too much of the explanation card.
2. Fix: narrowed the supporting-copy column, restored it below the headline, reduced the product mock from 66% to 62% width, and moved it inside the right safe edge.
3. Post-fix evidence: `/private/tmp/listenup-store-concepts-feature-v3.png` shows separated copy and product regions, with the selected subtitle and AI explanation heading visible.

## Findings

- No actionable P0, P1 or P2 issues remain for a first-round direction-selection prototype.
- P3: final production screenshots should replace the HTML YouTube stage with a sharp, user-owned real video/product capture after a direction is selected.
- P3: final export should capture only the 1280 × 800 artboard and remove the surrounding review controls.

## Implementation checklist

- [x] Three visibly distinct directions.
- [x] Real ListenUp brand and Desktop assets reused.
- [x] 1280 × 800 artboard ratio preserved.
- [x] Concept switching verified.
- [x] Static Website export verified.
- [x] Browser console checked.

final result: passed
