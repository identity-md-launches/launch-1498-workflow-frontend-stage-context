# RH PEPEFRONT design system

This file lives in `docs/` because the assignment's explicit write budget prohibits a repository-root `DESIGN.md`.

## Overview

An unofficial solo strategy game for players who want an immediately playable battlefield and clear wallet boundaries. The visual direction is a neon-noir military miniature: angular green Pepes, compact brutalist structures, crystal deposits and thin cyan/magenta faction accents. The scene is original procedural Three.js geometry, not a still presented as gameplay. The poster is original SVG, rendered to a PNG for social previews.

The battlefield and its primary action lead the page. Desktop uses a scene beside a command/briefing column; mobile places the scene and Play action before faction details. Rewards, exchange and operational controls are separate navigation views with the same wallet header. There are no invented leaderboard entries or live counters.

## Colors

The canonical definitions are `web/src/styles.css`, `:root`. Reuse semantic tokens rather than recoloring individual controls.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#0b1214` | Page and outer chrome |
| `--surface` | `#131e20` | Panels and native dialogs |
| `--raised` | `#1b2a2c` | Secondary controls |
| `--text` | `#e5eae2` | Main text |
| `--muted` | `#a4b4ac` | Supporting text; never the only error cue |
| `--line` | `#344844` | Structural separators |
| `--accent` | `#c6ee91` | Primary action and selected mode |
| `--accent-ink` | `#162615` | Text on the primary action |
| `--cyan` | `#67ddd2` | Initiative, links and friendly state |
| `--pink` | `#f1a3bd` | Cult faction |
| `--danger` | `#ffafa7` | Error text and destructive action |
| `--focus` | `#f4d889` | 2px keyboard outline, 4px offset |

This is deliberately dark-only; there is no nonfunctional theme switch. Faction selection also uses a check icon and `aria-pressed`, never color alone. The scene uses its own material colors in `Scene.tsx`; those are art materials, not UI color alternatives. The probe's measured solid-background text pairs passed. Text over the 3D scene, gradients and translucent overlays needs visual inspection; it is not covered by the probe's computed contrast result.

## Typography

Two locally bundled WOFF2 families: Barlow for text (400 and 600), Barlow Condensed for headings (700). Files are resolved from pinned Fontsource dependencies by the production build. Fallbacks are Arial and Arial Narrow/sans-serif. No runtime font service is used.

The six CSS sizes are `--small` 13px, `--body` 15px, `--base` 16px, `--medium` 20px, `--large` 32px, and `--display` 48px at the 16px root size. The main heading uses 48px on wide screens and 32px at narrow widths. Inputs remain 16px to avoid mobile focus zoom. Body line-height is 1.5; heading line-height is 1.08. Main headings use -0.015em tracking; the logo uses +0.02em. Heading text balances, prose uses `text-wrap: pretty`, and long-form text has a 72ch maximum. Numeric displays use tabular numerals. Contract addresses and large values wrap instead of silently clipping.

## Layout

`styles.css` defines the shared primitives. Desktop maximum width is 1600px with 40px side padding. Below 1180px the padding is 24px; below 650px it is 16px, and below 360px 12px. The main scene grid is `minmax(0, 1fr) 292px` with a 24px gap. The command column narrows at 1180px and moves below the scene at 900px. Mobile faction cards share two columns; order controls use two columns. Operational panels collapse to one column at 650px.

The common spacing steps are 4, 8, 12, 16, 20, 24 and 32px. Related controls use compact gaps; sections receive more space. Form fields and address rows are allowed to shrink and wrap. Horizontal page scrolling is not used as a layout technique.

The scene height is 500px on typical desktop, 560px above 1500px, 470px below 1180px, 460px below 900px, 320px below 650px and 300px below 360px. At 390×844, the product, connect control and complete Play action were visible in the first screen. Reflow was also checked at 320, 768 and 1440px. The site does not use fixed headers or fixed bottom wallet overlays.

## Elevation & depth

Borders establish structure. The battlefield has a low-radius frame, panels have flat tonal backgrounds, and the primary action is the strongest color. Only the native transaction/help dialogs and scene pause/result overlays use substantial shadows. The scene's caption uses a text shadow; its top controls have a darker local surface. A scanline-style military character is conveyed by the condensed heading face, clipped-looking geometry, rank pips and muted field colors without an animated full-page scanline effect.

Native dialogs use the top layer and an opaque dark backdrop with a small blur. Scene pause/result overlays have local z-index 4; the scene minimap has local z-index 1. Decorative scene layers do not intercept controls.

## Shapes

Buttons and inputs use a 4px radius; panel/battle frames use 5px; native dialogs use 8px. The game world is intentionally angular, with low-polygon crystal shards, rectangular bases and miniature frog faces. Selection rings are thin and circular, distinguishing selectable units from buildings and ore. Icons come from the small original inline SVG set in `ui.tsx`, with a consistent 1.7px stroke and inherited color.

## Components

- `Icon`, `PepePortrait`, `Modal`, `AddressLink` in `web/src/ui.tsx`: original SVG marks, faction portrait, native modal focus management, and full checksummed/copyable explorer links. `Modal` uses `showModal()`, native background inertness, Escape handling and focus return. Irreversible owner actions receive explicit consequence text.
- `.primary`, `.icon-button`, `.text-button`, `.danger-button`: shared button treatments. Defaults are 44px; some in-scene and navigation controls use smaller, spaced targets. Disabled controls are native-disabled, with explanations nearby. Focus uses the shared perimeter token.
- `.segmented`: two-state mode/direction selectors with `aria-pressed`; no hidden scroll strip.
- `Scene` in `web/src/Scene.tsx`: GPU scene, original geometry, drag selection, same-rank double-click, control groups, waypoints, camera and minimap API. The animation layer never authorizes rewards. A WebGL failure displays the original cover with a clear notice and retains the semantic order controls.
- The battlefield and `OrderButton` pattern in `web/src/App.tsx`: synchronized ore/army/point/turn display, explicit disabled reasons, faction/difficulty setup, pause/results and a local order log. The same strategic order labels apply in practice and wallet modes.
- `Exchange` and `Operations`: forms reuse `.panel`, `.data-list`, `.field-pair`, `.button-row`, `.notice` and `.error`. The single visible next step reflects live allowances. Quote errors and wallet errors persist with recovery controls.
- `.transaction-status`: persistent, labeled simulation/signature/pending/success/error/uncertain feedback with the available explorer transaction link. It never disappears on a timer.

Hover styling is limited to hover-capable devices. CSS transitions are 120ms and apply only when reduced motion is not requested. Press feedback is `scale(.96)`. Reduced motion removes decorative unit bobbing and crystal pulsing; essential user-directed movement remains. Idle/paused scenes redraw only when their state or camera changes. The page pauses local practice when hidden; the on-chain deadline never pauses.

## Do and do not

Use existing semantic tokens, the six-size scale and native controls. Keep new contract controls in the corresponding section, explain required state next to them, and give every signature a readable consequence. Add one new utility view by reusing `.section-intro` plus `.utility-grid`/`.panel`, with 320px reflow checks and the common wallet status.

Do not reuse art-material colors as arbitrary text colors, add decorative uppercase kickers, imply local scores are rewards, show estimated shares as matured claims, truncate contract addresses without an accessible full value, or add a second deployment configuration. Preserve the mobile ordering that puts the battlefield and Play action above the briefing.
