# Frontend revision evidence

This revision starts from accepted frontend commit `86e11716feb0d540771c1eef23eed66f652adf4b`. The deployed source remains `28cdf3268e872d58954f905687d8aaf9b635168a`. All six reports reproduced against the unchanged accepted export before fixes. No real transaction was signed or broadcast.

The original browser fixture was reused for wallet/RPC responses. The reproduction record is [revision-before.json](evidence/revision-before.json); final browser measurements are in [revision-results.json](evidence/revision-results.json). The root `.imd-responses.json` answers each report by its full finding ID.

## Findings and changes

| Finding ID prefix | Reproduction | Targeted fix |
| --- | --- | --- |
| `08641e2d` — wallet results | At 320×844, the victory card was 334.05px tall inside a 300px scene. View rewards extended to 333.05px below the scene top; its center was intercepted. Surrender also exceeded the scene. | `web/src/styles.css:393`: results use automatic scene height, a relative overlay and a 300px minimum. The entire card and both actions determine the height. |
| `08491c9b` — recruitment | Save three selected Pepes to Ctrl+1, recruit another, then recall 1: the accepted export selected no Pepes. | `web/src/Scene.tsx:644`: reconcile rank counts in place. Existing meshes, IDs, selection and waypoint queues survive; number groups reset for a new battle. |
| `2fc58fe9` — Retry checks | Return 503 for only the first manifest request. Retry made no second request and left verification unavailable. | `web/src/useChain.ts:287`: reload when deployment loading never created a service. Existing services retain their verification retry. Both manifest and ABI recovery are exercised. |
| `88b3f10c` — stale quote | Delay a 1 IMD buy quote, switch to a 100 PEPEFRONT sell, then release it. The old quote appeared with an IMD confirmation while the mocked approval targeted PEPEFRONT for 1 token. | `web/src/Exchange.tsx:45`: key and generation checks invalidate stale responses, including changes away and back to the same inputs. Quotes retain the account, token, amount, symbols, decimals and slippage. Display, both approvals and swap review use that snapshot and recheck it before writing. |
| `82249663` — scenery collision | Move the two support Pepes to world position (-15, 7), the friendly headquarters center. The original render hid/intersected the Pepes with the building. | `web/src/Scene.tsx:469`, `web/src/pathing.ts:15`: project blocked destinations to walkable space and route around mesh-derived bases, buildings, rocks and barricades. Intermediate route points remain separate from the eight-order queue. New construction reroutes the queue; auto-return harvesters use the same planner. |
| `cf1b0381` — briefing treatment | The initial portraits rendered as solid vector fills; the shared active portrait component also had no grain filter or scanline pattern. Display lettering was plain. | `web/src/ui.tsx:119`, `web/src/styles.css:135`: retain the art and fonts, add static seeded portrait grain and scanlines, and narrow vertical stencil cuts to existing display headings. Body text and controls stay solid; increased contrast removes the cuts. |

At 320px the repaired victory scene is 366.05px high and the surrender scene is 346.55px high. Both 44px actions fit and pass center hit-testing; View rewards opens Rewards, and Play again starts a reviewed wallet battle. The 390px result state also fits. Measurements scroll only the document, since `scrollIntoView` can otherwise hide this bug by scrolling an overflow-hidden ancestor.

The recruitment test observes real Three.js mesh identities through the library's existing devtools event API. It confirms that the three original meshes remain selected without teleporting, reach their queued destination, and keep group membership after a fourth unit is recruited. A new battle clears the group. No production test hook or injected game state was added.

The quote regressions cover direction/amount changes, slippage, disconnect, wrong chain, tab unmount, returning to the same inputs, and an old response arriving after a newer quote. A fresh sell quote produces a mocked approval for exactly 100 PEPEFRONT on the PEPEFRONT contract; stale requests produce no approval or swap.

## Validation and scope

The production build/typecheck, independent collision tests, original rules/transaction tests, browser suite, pinned design probe, and manifest verifier are recorded in [build-checks.json](evidence/build-checks.json) and [browser-results.json](evidence/browser-results.json). The app is served from `dist/` at `/preview/` during browser tests. The final manifest inventories 15 assets and verifies the pinned ABI hashes, unchanged network, pool key, contract set and every exported SHA-256. The export is 1,319,246 bytes. All 12 unit tests, 18 browser scenarios (Chromium and WebKit), and 16 design-probe checks passed against the final source/export. The pathing browser check completed the headquarters order across 59 observed frames and 30 scenery footprints, with zero collisions. The final manifest SHA-256 is `6739ab0f13a4c3d7e5f13827843252a6a4af4187079fb247fb4c8f74e6056c8c`.

The read-only live check was rerun; [live-rpc.json](evidence/live-rpc.json) records chain ID, code and asset bindings. This is not proof of funded settlement, live swaps, production hosting or attestation checks performed later by the control plane.

The browser installation lives outside Git at `/tmp/imd-revision-browsers-998b`. WebKit's downloaded launcher needed to preserve the inherited library path; its EGL vendor and Mesa driver paths were supplied explicitly from the existing extracted system libraries. This affects only the worker's browser installation. Ordinary hosts with Playwright system dependencies installed do not need that workaround. The software-rendered worker can advance visual movement slowly; regression timeouts allow complete routes without changing the game's clock or movement implementation.

## Better Interface review

| Domain | Revision coverage |
| --- | --- |
| Accessibility | Both result actions are visible, 44px tall, hit-testable and usable. Existing keyboard, focus restoration, pause, touch and host flows are rerun. Portrait layers are decorative and cannot intercept input. Native-device and screen-reader sessions remain unperformed. |
| Layout | Initial views are checked at 320, 390, 768 and 1440px; wallet victory/surrender specifically cover 320 and 390. The 390px first screen retains the product, wallet button and complete Play action. Results grow with content rather than clipping controls. |
| Writing | Retry performs the recovery it promises. Quote descriptions and transaction assets/amounts agree. Reward maturity and practice explanations remain intact. |
| Typography | Existing two font families, three weights and six-size source scale are preserved. Display-only stencil cuts retain accessible text and turn off for increased contrast. |
| Color | Existing semantic colors are unchanged. The probe checks solid text/background pairs; grain, scanlines and canvas/gradient contrast are visually inspected, not claimed as measured ratios. |
| UI | Static briefing texture stays within portraits. New requests invalidate stale quotes; rendering retains unit selection and order continuity. The review uses the existing layout and components throughout. |

The final design system is [DESIGN.md](DESIGN.md). It remains under `docs/` because the explicit path budget disallows a root `DESIGN.md`. Apart from the explicitly required root response file, all delivered changes are within `web/`, `dist/` and `docs/`; protected Solidity and root configuration remain untouched. Generated dependencies, downloaded browsers and temporary validation files are excluded from the submission. [scope-size.json](evidence/scope-size.json) records an actual full-history candidate bundle check in an isolated scratch clone; the main `.git` remains untouched.

Unperformed checks remain: actual wallet extensions, physical touch devices, screen readers, live funded claims/swaps, real Pepe2Pepe listing/relayer behavior, IPFS publication and named-site resolution. Mocked transactions establish frontend request behavior only.
