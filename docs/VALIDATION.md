# Frontend worker validation

These are checks performed by the frontend worker on the committed static export, not an independent certification or publication result. No live transaction was signed or broadcast. The contracts, deployed source commit, protected root configuration and Solidity dependencies were preserved.

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

The browser suite starts its own HTTP server, serves the actual `dist/` under `/preview/`, and stops the server afterwards. It uses mocked EIP-1193 wallets and RPC responses; its addresses and transaction-hash fixtures come from the supplied deployment/platform data. It never has a private key. The final gameplay suite uses real browser timers and the visible 10× quick-drill option, with no production test mode or injected game state. Most interaction contexts request reduced motion. A separately recorded full-motion keyboard run also reached victory and replay.

Browser executables were installed outside Git at `/tmp/pepefront-browsers`. This worker lacked WebKit system libraries, so the matching distribution libraries were extracted under `/tmp/pepefront-webkit-libs`; no browser, shared library, package cache or dependency archive is submitted. WebKit was run with software Mesa, its extracted library path and host-preflight validation skipped. This skips the system-package lookup, not browser execution: the actual WebKit engine rendered and accepted touch input. A normally provisioned Linux host can install Playwright's standard OS dependencies instead. Physical Safari/iOS was not tested.

## Automated and rendered evidence

| Check | Result / evidence |
| --- | --- |
| TypeScript | `tsc --noEmit` passed. |
| Production export | Vite production build passed, with relative `./` base and local font/art assets. The renderer and wallet libraries are separate local chunks. |
| Rules and transaction regressions | Nine tests passed: exact four-word action encoding, implementation-derived state tuples, atomic five-minute win gate, turn/deadline/cost/prerequisite bounds, both factions/all difficulties/build progression/win/loss, Robinhood extended swap tuple, rejection/stale-turn explanations, exact decimal parsing, and uncertain post-hash receipt handling. |
| Browser interaction suite | All 13 named scenarios passed on the final full run. See the individual named outcomes and timestamps in [browser-results.json](evidence/browser-results.json). Covers Chromium and WebKit, keyboard and touch, results/replay, native dialog Escape/focus return, wallet absence/rejection/chain addition, orders, approvals, claims, cosmetics, swap, funding and simulation failure. |
| Realistic embedding | Opaque `sandbox="allow-scripts allow-pointer-lock"` iframe with the supplied SDK protocol: one-shot init/ready handshake, channel binding, account/state, pause/resume, orders, rejected-claim recovery, both claims and cosmetic approval/purchase. Actual Pepe2Pepe production listing and wallet extension were not used. |
| Export integrity | `scripts/verify.mjs` compares exact handoff identity/contract set, canonical Keccak ABI hashes, network, wallet-add parameters, pool key and every exported file's SHA-256. The final manifest excludes itself and includes index, ABI arrays, cover, fonts, scripts, styles, notices and game metadata. |
| Live read-only RPC | [live-rpc.json](evidence/live-rpc.json): chain 4663, nonempty Game/LaunchToken code, expected owner and token bindings, PEPEFRONT symbol/decimals/supply, current epoch budgets. At this observation both daily reward budgets were zero. This does not prove bytecode attestation or funded claim/swap execution. |
| Full-motion gameplay | [full-motion-keyboard.json](evidence/full-motion-keyboard.json) preserves a separately completed keyboard build/harvest/recruit/groups/pause/victory/replay run. |
| Screenshots | [390px initial screen](evidence/mobile-390.png), [desktop](evidence/desktop-1440.png), [keyboard focus](evidence/keyboard-focus.png), [practice victory](evidence/practice-victory.png), [320px operations](evidence/mobile-operations-320.png), [wallet rewards](evidence/wallet-rewards.png), [sandbox host](evidence/iframe-host-flow.png), [WebKit mobile](evidence/webkit-mobile.png), [240px cover](evidence/cover-thumbnail.png). |

All live wallet transactions, funded reward settlement, actual pool liquidity/quote execution, refunds, recycling, forced-ETH recovery and ownership changes remain unbroadcast. The latter controls were reviewed against the implementation ABI and prerequisites; the browser suite does not claim to execute every administrative write. The public RPC/code check does not establish actual wallet compatibility, finality guarantees or economics.

## Better Interface review

The pinned Better Interface guide and all six core domains were read during implementation; supporting form, focus, responsive, motion and metadata guidance was used. The pinned design-critic probe was run against the production export from the repository root:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/pepefront-browsers \
IMD_PLAYWRIGHT="$PWD/web/node_modules/playwright/index.mjs" \
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

All 16 final probe checks passed. The 390px first-screen screenshot was visually inspected, including the complete Play action. The final rebuild produced the same manifest SHA-256 as the export used by the passing browser suite: `cd3d9ee7c92645dca537aa483a31a967816d00c51744fb2c2b6262501d7e3ea3`.

The pinned probe is an assignment input and is removed by the publisher; its resulting evidence is retained in `docs/evidence/taste.json`. Its temporary server/screenshots stay in the permitted scratch directory. See [DESIGN.md](DESIGN.md) for implemented tokens, type, spacing, components and responsive behavior. The design document is under `docs/` because this assignment's explicit path budget forbids creating root `DESIGN.md`.

| Domain | Coverage and findings |
| --- | --- |
| Accessibility | Native buttons, fields, progress labels, descriptive icon controls, skip link, visible perimeter focus, native modal inertness/Escape/focus return, live status/error text, semantic order controls alongside canvas, reduced motion. Keyboard and touch interaction passed. The probe's 24px-or-spacing target check passed; some compact scene controls are below the recommended 44px comfort size. No screen-reader session or physical assistive device was available. |
| Layout | Export measured at 320, 390 and 1440px by the probe and additionally 768px by the interaction suite. Product, wallet button, scene and complete Play action appear in the first 390×844 screen. All sections and large mocked balances were checked at 320px. No sideways scrolling, repeated clipping or overlap found. Browser 200% zoom and physical phone safe areas were not separately measured. |
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

Only `web/`, `dist/` and new `docs/` documentation/evidence are delivered. `web/.gitignore` is the explicitly budgeted ignore file; it excludes generated dependencies/caches at every nesting level. There is no vendored npm registry, node_modules, browser binary or submodule in the submission. [Scope and size evidence](evidence/scope-size.json) records 3,165,991 bytes of new files before the small final reports, and 5,523,785 bytes for all candidate working-tree blobs plus existing Git storage and a conservative 1 MiB packaging allowance, below the 8 MiB limit. This is not an actual commit-bundle measurement because Git is read-only.

The live host domain, IPFS CID and game-specific Pepe2Pepe listing have not been issued to this worker. The site links to the supplied platform's game catalog and includes listing metadata for the publisher. Open Graph assets therefore remain relative. The chosen gateway must support CORS for the opaque iframe's manifest/ABI requests. Publication, immutable/named fetch verification and control-plane attestation checks happen subsequently and are not reported as completed here.

## Git delivery limitation

The worker attempted `git add -- web dist docs`. Git returned `fatal: Unable to create .../.git/index.lock: Read-only file system`. The assignment environment explicitly mounts `.git` read-only. Consequently this worker could not stage, commit or emit an authoritative commit bundle; the completed source, lockfile, static export and evidence remain in the permitted working-tree paths for the publisher to collect. No Git permission bypass was attempted.
