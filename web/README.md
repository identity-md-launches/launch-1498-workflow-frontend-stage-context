# RH PEPEFRONT frontend

A static, unofficial single-player Pepe strategy game on Robinhood Chain. Vite, React, TypeScript and Three.js provide a playable miniature battlefield; viem handles read-only RPC, simulation and visitor-authorized wallet requests. No server, score signer, private key, privileged relayer or remote asset CDN is required.

## Run and rebuild

Use Node 22.12+ (worker: Node 24.21.0) and npm.

```sh
npm ci --prefix web
npm run typecheck --prefix web
npm run test --prefix web
npm run build --prefix web
npm run verify --prefix web
npm run preview --prefix web
```

`build` includes typecheck, exports to repository-root `dist/`, copies the pinned implementation ABI arrays and emits **the final** `imd-deployment.json` after hashing all other exported files. Preserve Git history containing the deployed source commit `28cdf3268e872d58954f905687d8aaf9b635168a`. This build deliberately fails if either pinned ABI differs from its handoff hash or the working `docs/abi` export.

For a gateway-style subpath preview, run `node web/scripts/serve.mjs` and open `http://127.0.0.1:4173/preview/`. Stop the process when finished. This serves static files only. For source hot reload, run `npm run dev --prefix web`; the Vite development configuration serves the built deployment and ABIs through its development middleware. Build once before using it.

The committed `dist/` is the publication artifact. The publisher does not need to rebuild. Its relative asset URLs, single page and lack of history routing support ordinary static hosting and IPFS gateway subpaths. HTTP serving is required; opening `index.html` with `file://` cannot perform browser fetches reliably.

## Deployment source of truth

The app fetches `./imd-deployment.json`, verifies each referenced ABI's recursively sorted canonical JSON Keccak-256 hash, and loads that ABI for its runtime calls. No deployed address, chain ID or public RPC URL is duplicated in application code. `web/reference/deployment.json` and `web/reference/network.json` are build inputs copied from the supplied handoff, retained because the worker's `.imd/reads` files are removed. They are compared to those pinned inputs when the latter exist.

`web/reference/platform.json` contains the supplied creator and Pepe2Pepe economy receivers for **host listing metadata only**. The build derives game/token/chain/launch fields of `pepe-game.json` from the same deployment handoff. The app neither sends funds to these receivers nor maintains an alternative runtime contract map.

`src/config.ts` loads configuration; `chain.ts` centralizes state decoding, zero-value actions, public reads, wallet switching and simulation; `swap.ts` describes only the network protocol interfaces and encodings. All router/quoter/Permit2 addresses come from the runtime manifest. The exact handoff pool key is used unchanged. Robinhood's six-field swap tuple, including `minHopPriceX36 = 0`, is selected by the supplied network flag.

Before enabling writes the app checks RPC chain ID, nonempty Game/LaunchToken code, Game's token/prize bindings, and the token's symbol and decimals. These are frontend consistency checks, not a substitute for the platform's deployment attestation. Chain reads poll every five seconds while visible and connected. Reads use the two supplied public RPCs with ordered fallback. Failed reads clear actionable state; the visible error offers a retry. There are no private RPC credentials or WalletConnect project IDs. Injected EVM browser wallets are supported; WalletConnect is not configured.

## Play and wallet flow

- **Free practice:** the deployed deterministic strategy rules run locally, with no token entitlement. The normal clock enforces 10-second scheduled turns, a five-minute victory gate, a 20-minute deadline and at most 48 orders. The explicit quick-drill checkbox speeds only this local clock by 10. Pause freezes local time. Hiding the tab pauses gameplay.
- **Wallet battle:** each meaningful order uses `Game.act(bytes)` with the exact four-word ABI encoding. Every order is confirmed separately, carries zero ETH value and is simulated before the injected wallet signs. Fresh session/turn state is read immediately before encoding. The chain's clock and state are authoritative. Pausing only freezes visuals; the on-chain deadline continues.
- **Map controls:** click select, drag-box, double-click same rank, Shift additive selection / queued waypoints, right-click move, Ctrl+1–5 groups, 1–5 recall, Q select all, WASD/arrows and edge pan, wheel zoom, minimap base jumps. On touch, select all or tap a unit, switch to `Tap to move`, then choose a destination. Buttons cover every strategic order. G/B/R/F/H/E shortcuts issue harvest/build/recruit/attack/hold/repair. Movement and returning harvesters visualize the battlefield; order rules decide the actual outcome.
- **Rewards:** on-chain state shows budgets, recorded power, cooldown, daily caps, battle eligibility and matured claims separately. PEPEFRONT uses the dedicated `claim` request; IMD uses action 9. There is no claim for local scores. Cosmetic approval is exactly 100 PEPEFRONT, followed by a separate purchase; ownership is read from the contract bitmask. Cosmetics add no combat power.
- **Exchange:** a simulated quoter call precedes exact ERC20-to-Permit2 approval and an exact, expiring Permit2 router approval, each with its own confirmation. A 30-second quote expiry, user slippage, nonzero minimum output and two-minute router deadline protect the request. The Universal Router call is simulated before signing. Both currencies are ERC20s, so no ETH value is sent. USD context is unavailable, and the UI says so.
- **Operations:** future-day funding, exact approvals for each asset, inspection of deposits/epochs, empty-day refunds (both or either asset), accrual, expiry and recycling. Current owners can recover forced ETH, nominate a successor or renounce; nominated owners can accept. Owner controls confer no gameplay or token-reward withdrawal powers. There are no missing owner service settings.

A wallet change invalidates current state and open transaction confirmations. Unknown-chain errors trigger the exact supplied `wallet_addEthereumChain` parameters and then a second switch. Requests stay locked through receipts. Any transport failure after a returned transaction hash is treated as uncertain and requires a receipt check; it is never resent automatically. Confirmed reverts and rejected signatures remain retryable after review.

Quotes also bind the account, chain, direction, amount, slippage and asset decimals to one request snapshot. Changed inputs invalidate pending results, and both approval steps and the swap use that snapshot's token and amount. If initial deployment/ABI loading fails, **Retry checks** reloads the site; an initialized service keeps its existing verification retry.

Recruitment appends only the new rank count, preserving existing selections, number groups and queued movement until a new battle. Movement and auto-return harvesters route around buildings, rocks and barricades; terrain-blocked destinations move to the perimeter. Wallet result cards expand to contain both actions on narrow screens.

## Pepe2Pepe embedding

The unmodified MIT-licensed `src/onchain-bridge.js` is bundled locally from the template's SDK. It receives the `pepe-game/1` init/channel handshake and accepts host messages only from `window.parent` with the current channel. A handshake change rejects old pending requests. It supports host pause/resume and preview mode; preview disables writes.

```html
<iframe src="PATH_TO_THE_PUBLISHED_EXPORT/index.html"
  title="RH PEPEFRONT"
  sandbox="allow-scripts allow-pointer-lock"></iframe>
```

The host supplies account/state/balance, confirms game actions and approvals, and returns confirmed transaction hashes. The iframe never accesses a parent wallet or same-origin storage. An opaque sandbox needs the static host to serve export files with `Access-Control-Allow-Origin: *` so manifest/ABI fetches work; IPFS gateways normally support CORS, but the chosen host must be checked. The worker's browser test covers this exact opaque sandbox.

Standalone play uses the SDK's local adapter with the same configuration. Extended operations and pool swaps are shown as standalone-only because the host bridge does not authorize arbitrary contract writes. The public site's hosted-play link opens the known Pepe2Pepe game catalog. No unissued listing ID, future CID or invented game-specific hosted URL has been substituted.

## Validation

```sh
npm run test --prefix web
npx --prefix web playwright install chromium webkit
npm run test:browser --prefix web
npm run verify --prefix web
node web/scripts/live-check.mjs
```

Browser tests manage and stop their own preview server, serve the production export under `/preview/`, mock wallet/RPC writes, and write actual screenshots plus JSON outcomes to `docs/evidence/`. The live check is read-only. Never use a funded wallet merely to validate this frontend. See [validation](../docs/VALIDATION.md), [design system](../docs/DESIGN.md) and [feature coverage](../docs/FRONTEND-COVERAGE.md).

The revision regressions in `tests/revision.mjs` reuse the original mock fixture and are included in `test:browser`. Set `PEPEFRONT_TEST_GROUP=revision` to run only those cases. They inspect actual rendered unit positions using Three.js's existing devtools observation API, with no production test hook. The collision tests additionally sample complete route segments independently of the planner. See [revision evidence](../docs/REVISION.md) for the six reproduced reports and fixes.

The optional `web/scripts/render-cover.mjs` renders the authored vector cover to the committed 1200×630 PNG using Chromium. Normal builds copy that PNG and do not require a browser. All three local fonts ship as WOFF2 only.

## Scope and publication

The source, dependencies' manifests/lockfile and configuration remain in `web/`; only the explicit `web/.gitignore` path budget was used for ignore changes. Generated dependencies are ignored at every nesting depth. Root Solidity/configuration/dependencies are preserved. Design documentation is in `docs/DESIGN.md`, because the higher-priority path budget disallows the otherwise requested root `DESIGN.md`.

Source hosting, listing approval, immutable pinning, site naming, live URLs and publication checks are later control-plane steps. The current worker does not publish or redeploy. OG image paths remain relative because no public domain or immutable CID was supplied. All game art is original code-native vector/geometry; see `docs/ATTRIBUTION.md` for third-party notices.
