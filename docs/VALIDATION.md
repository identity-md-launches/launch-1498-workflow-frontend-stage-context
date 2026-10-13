# Frontend worker validation

These are checks performed by the frontend worker on the committed static export, not an independent certification or publication result. No live transaction was signed or broadcast. The contracts, deployed source commit, protected root configuration and Solidity dependencies were preserved.

The reopened frontend review is documented in [REVISION.md](REVISION.md). All six reports reproduced against the accepted export and received targeted fixes. The current build/browser/probe evidence supersedes earlier-round measurements; `full-motion-keyboard.json` remains a separately labeled earlier-round record.

## Reproduce

From the repository root, using Node 24 and npm 11 on this worker:

```sh
npm ci --prefix web
npm run typecheck --prefix web
npm run test --prefix web
npm run build --prefix web
npm run verify --prefix web
npx --prefix web playwright install chromium webkit
npm run test:browser --prefix web
node web/scripts/live-check.mjs
```

The browser suite starts its own HTTP server, serves the actual `dist/` under `/preview/`, and stops the server afterwards. It uses mocked EIP-1193 wallets and RPC responses; its addresses and transaction-hash fixtures come from the supplied deployment/platform data. It never has a private key. The final gameplay suite uses real browser timers and the visible 10× quick-drill option, with no production test mode or injected game state. Most interaction contexts request reduced motion. The accepted earlier-round full-motion keyboard record also reached victory and replay; it was not rerun as part of this revision.

Browser executables for this revision were installed outside Git at `/tmp/imd-revision-browsers-998b`. WebKit uses the matching distribution libraries under `/tmp/pepefront-webkit-libs`; no browser, shared library, package cache or dependency archive is submitted. Its downloaded launcher was adjusted to preserve the inherited library path, with the extracted Mesa driver and EGL vendor paths supplied explicitly. WebKit runs with software Mesa and host-preflight validation skipped. This skips the system-package lookup, not browser execution. A normally provisioned Linux host can install Playwright's standard OS dependencies instead. Physical Safari/iOS was not tested. The worker sets `PEPEFRONT_BROWSER_TIMEOUT=45000` for slow software-rendered interactions; the default remains 15000ms.

## Automated and rendered evidence

| Check | Result / evidence |
| --- | --- |
| TypeScript | `tsc --noEmit` passed. |
| Production export | Vite production build passed, with relative `./` base and local font/art assets. The renderer and wallet libraries are separate local chunks. |
| Rules, pathing and transaction regressions | Twelve tests: the original nine rules/transaction checks plus headquarters projection/detours, overlapping footprints with ordered waypoints/new construction, and unreachable destinations. Route tests independently sample body clearance along every segment. See [build-checks.json](evidence/build-checks.json) for the final result. |
| Browser interaction suite | All 18 scenarios passed: the original 13 plus five revision scenarios. See the individual final outcomes and timestamps in [browser-results.json](evidence/browser-results.json). Covers keyboard and touch, results/replay, native dialog Escape/focus return, wallet absence/rejection/chain addition, orders, approvals, claims, cosmetics, swap, funding, simulation failure, narrow wallet results, configuration recovery, retained units/orders, scenery paths and quote races. |
| Realistic embedding | Opaque `sandbox="allow-scripts allow-pointer-lock"` iframe with the supplied SDK protocol: one-shot init/ready handshake, channel binding, account/state, pause/resume, orders, rejected-claim recovery, both claims and cosmetic approval/purchase. Actual Pepe2Pepe production listing and wallet extension were not used. |
| Export integrity | `scripts/verify.mjs` compares exact handoff identity/contract set, canonical Keccak ABI hashes, network, wallet-add parameters, pool key and every exported file's SHA-256. The final manifest excludes itself and includes index, ABI arrays, cover, fonts, scripts, styles, notices and game metadata. |
| Live read-only RPC | [live-rpc.json](evidence/live-rpc.json): chain 4663, nonempty Game/LaunchToken code, expected owner and token bindings, PEPEFRONT symbol/decimals/supply, current epoch budgets. At this observation both daily reward budgets were zero. This does not prove bytecode attestation or funded claim/swap execution. |
| Earlier full-motion gameplay | [full-motion-keyboard.json](evidence/full-motion-keyboard.json) preserves the accepted earlier-round keyboard build/harvest/recruit/groups/pause/victory/replay run. It is not represented as a fresh revision check. |
| Screenshots | [390px initial screen](evidence/mobile-390.png), [desktop](evidence/desktop-1440.png), [keyboard focus](evidence/keyboard-focus.png), [practice victory](evidence/practice-victory.png), [320px operations](evidence/mobile-operations-320.png), [wallet rewards](evidence/wallet-rewards.png), [sandbox host](evidence/iframe-host-flow.png), [WebKit mobile](evidence/webkit-mobile.png), [240px cover](evidence/cover-thumbnail.png). |

All live wallet transactions, funded reward settlement, actual pool liquidity/quote execution, refunds, recycling, forced-ETH recovery and ownership changes remain unbroadcast. The latter controls were reviewed against the implementation ABI and prerequisites; the browser suite does not claim to execute every administrative write. The public RPC/code check does not establish actual wallet compatibility, finality guarantees or economics.

## Better Interface review

The pinned Better Interface guide and all six core domains were read during implementation; supporting form, focus, responsive, motion and metadata guidance was used. The pinned design-critic probe was run against the production export from the repository root:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/imd-revision-browsers-998b \
IMD_PLAYWRIGHT="$PWD/web/node_modules/playwright/index.mjs" \
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

All 16 final probe checks passed. The 390px first-screen screenshot was visually inspected, including the complete Play action, and the 1440px view was inspected. The rebuilt export's manifest SHA-256 is `6739ab0f13a4c3d7e5f13827843252a6a4af4187079fb247fb4c8f74e6056c8c`. The browser suite uses this export; the manifest is verified again before delivery.

The pinned probe is an assignment input and is removed by the publisher; its resulting evidence is retained in `docs/evidence/taste.json`. Its temporary server/screenshots stay in the permitted scratch directory. See [DESIGN.md](DESIGN.md) for implemented tokens, type, spacing, components and responsive behavior. The design document is under `docs/` because this assignment's explicit path budget forbids creating root `DESIGN.md`.

| Domain | Coverage and findings |
| --- | --- |
| Accessibility | Native buttons, fields, progress labels, descriptive icon controls, skip link, visible perimeter focus, native modal inertness/Escape/focus return, live status/error text, semantic order controls alongside canvas, reduced motion. Keyboard and touch interaction passed. The probe's 24px-or-spacing target check passed; some compact scene controls are below the recommended 44px comfort size. No screen-reader session or physical assistive device was available. |
| Layout | Export measured at 320, 390 and 1440px by the probe and additionally 768px by the interaction suite. Product, wallet button, scene and complete Play action appear in the first 390×844 screen. The review exposed wallet-result clipping missed in the original coverage; explicit 320/390 result-card bounds and hit-testing now cover it. Browser 200% zoom and physical phone safe areas were not separately measured. |
| Writing | Short headline, one-line game description and directions adjacent to controls. Practice has explicit zero rewards; wallet orders explain signatures/gas, pause deadlines and eligibility. No invented prices, leaderboard, multiplayer, claims or emissions. Hosted-play catalog limitation and the unofficial status are stated. |
| Typography | Local Barlow/Barlow Condensed, six source sizes and three weights. Condensed headline is heaviest; no decorative uppercase kicker. Probe checks passed. Long values and addresses wrap. |
| Color | Shared semantic tokens; text contrast checked by the probe for measurable solid backgrounds, passing its 4.5:1/3:1 criteria. Status/faction also use text/icons. Canvas, gradient and translucent pairs are visually inspected, not claimed as measured contrast. |
| UI | Clear primary action, logical tabs, explicit disabled reasons, confirmations, visible transaction phases and explorer links, separated approvals, expiring quotes, wallet change checks and actionable read errors. Thumbnail and primary screens inspected. The original art remains legible at RTS and 240px cover scale. |

## Findings fixed during validation

| Source location | Finding and repair |
| --- | --- |
| `web/src/App.tsx:37` | The order-button component originally remounted on timer ticks, disturbing keyboard focus. It is now a stable top-level component. |
| `web/src/App.tsx:144` | Local elapsed time now uses monotonic elapsed milliseconds rather than assuming each interval fired on schedule. Pausing/hidden tabs stop local progress; chain deadlines remain independent. |
| `web/src/App.tsx:164` | Keyboard callbacks could retain an earlier victory-gate time. A stable listener calls the current handler ref; the keyboard victory regression now exercises that gate. |
| `web/src/useChain.ts:98` | An in-flight background read could skip the post-transaction refresh and leave an old claim briefly enabled. Forced reads now wait for the current poll and then read fresh state before completing the action. Claim retry/disable is exercised in the browser suite. |
| `web/src/bridge.ts:9` | React mount timing could miss the host's one-shot iframe init. The bridge now starts during module evaluation and retains initialization state for the mounted hook. The opaque-iframe test uses that one-shot handshake. |
| `web/src/chain.ts:118` | Token input parsing now rejects excess fractional precision instead of allowing a decimal helper to round a financial amount. Unit regression covers it. |
| `web/src/chain.ts:338` | Transport failure after a returned hash must not invite a second send. The service locks in an uncertain state until the receipt is checked; unit regression confirms no duplicate write. Malformed/timeout host confirmations are also uncertain. |
| `web/src/Scene.tsx:669` | Software GPU rendering made continuous idle/paused draws unnecessarily expensive. Idle/paused scenes redraw only when dirty; reduced-motion scenes draw essential changes/movement. The full-motion keyboard run and reduced-motion Chromium/WebKit interactions are recorded separately. Physical mobile frame rate and battery consumption remain unmeasured. |

## Scope and publication limits

This revision changes only `web/`, `dist/`, `docs/` and the explicitly required root `.imd-responses.json`. Protected root configuration, deployed contract sources, ABI exports, package manifests/lockfiles and ignore rules remain unchanged. The existing `web/.gitignore` excludes generated dependencies/caches at every nesting level. There is no vendored registry, dependency directory, browser binary or submodule in the candidate submission. [Scope and size evidence](evidence/scope-size.json) records the actual full-history candidate Git bundle measurement, performed in an isolated scratch clone because the main repository's `.git` is read-only. The measured bundle, including original history, replacement assets and all required evidence, is below the 8 MiB limit. The scratch bundle is validation scaffolding and is not itself a deliverable.

The live host domain, IPFS CID and game-specific Pepe2Pepe listing have not been issued to this worker. The site links to the supplied platform's game catalog and includes listing metadata for the publisher. Open Graph assets therefore remain relative. The chosen gateway must support CORS for the opaque iframe's manifest/ABI requests. Publication, immutable/named fetch verification and control-plane attestation checks happen subsequently and are not reported as completed here.

## Git delivery limitation

The assignment environment mounts the main repository's `.git` read-only. The accepted earlier round recorded an unsuccessful staging attempt; this revision does not retry or bypass that restriction. Source, lockfile, static export and evidence are ready in the allowed working-tree paths for the publisher to collect. Only an isolated `test/scratch/` clone receives a temporary validation commit to measure the complete candidate bundle; the main repository is not staged or committed by this revision.
