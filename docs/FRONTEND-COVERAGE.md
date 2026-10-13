# Frontend coverage and contract reconciliation

The deployed implementation is authoritative for frontend behavior. This frontend preserves `src/`, Foundry configuration, root configuration and all existing Solidity dependency files.

| Requested behavior | Delivered behavior |
| --- | --- |
| Playable neon-noir Pepe battlefield | Original procedural WebGL miniature terrain, two bases, crystal fields, control point, green Pepe ranks, faction neon, structures, selection rings and a local order log. Original still portrait plus text briefing; no video footage is claimed. |
| Harvest → build → produce → attack/hold | Every deployed strategic order has a keyboard/touch control; prerequisites, costs, timers, base/army/ore/points and outcomes are visible. Both factions and all three deployed difficulties are selectable. |
| Keyboard and touch | Selection, drag-box, same-rank double-click, queued waypoints, control groups, camera, minimap, order hotkeys and semantic buttons. Touch provides select/move modes and zoom buttons. |
| Pause/results | Practice timer freezes; wallet deadline keeps running. Pause explains that distinction. Results show orders, harvests, army and reward status, with replay and rewards navigation. |
| Standalone + iframe | Injected EVM wallet adapter plus locally bundled Pepe2Pepe protocol SDK. Opaque iframe uses host account/state/act/approve/claim, channel binding, pause/resume and preview handling. |
| Hosted-play link | Links to the known Pepe2Pepe game catalog. No specific listing URL exists in the handoff; none is invented. Publication/listing happen later. |
| Wallet connection | Missing-wallet recovery, injected account reads, rejection messages, wallet/chain change invalidation, exact unknown-chain add/switch parameters and code/ABI verification gates. |
| Rewards/power | Live matured claims, daily deposited budgets, recorded power/epoch, eligibility, 24h cooldown, 3-win/5-harvest daily counters and the session's rewarded flag. Claims pay only the connected player. |
| Cosmetics | All eight IDs, ownership mask, balance, exact 100-token approval and separate purchase. 75 tokens retired / 25 to tomorrow; no combat advantage. |
| Pool controls | Both trade directions using the exact pool key and network-supplied quoter/Permit2/router. Explicit approvals, expiring quote and permissions, minimum output, six-field extended tuple, simulation and receipt states. |
| Funding | Exact separate asset approvals, future UTC epoch deposits, live budget/contribution inspection, empty-day combined/individual refunds and recycling. |
| Other public Game writes | `accrue`, `expire`, forced-ETH recovery, two-step ownership transfer/acceptance and permanent renounce, each with a control and readable confirmation. `claimPrize()` and action 9 are equivalent; the player UI uses action 9 so the same IMD claim works through the host. |
| ERC20 interface | Actual implementation ABI loaded and verified. Balance/decimals/symbol and the approvals needed for cosmetics, funding and trading are connected. ERC20 `transferFrom` is the spending primitive invoked by Game/router, not a fabricated standalone game action. |
| Static delivery | Relative-base Vite export, original PNG/SVG cover, favicon, metadata, on-chain game manifest, exact runtime deployment manifest and SHA-256 inventory of every other exported file. |

## Earlier creative proposals that the deployed contract does not implement

The contract-stage README already reconciles the initial creative proposal with economy v2. The UI preserves that result explicitly:

- Solo deterministic battles replace multiplayer/FFA/seat-signed outcomes. The selectable AI pressure is the contract's deterministic retaliation, not a hidden server or a claimed machine-learning opponent.
- Fixed 1B PEPEFRONT replaces the proposed 21M `$FRONT` emission/halving model. No admin mint or autonomous emissions exist. The UI uses the deployed token's name and symbol.
- Daily sponsor/cosmetic-funded, pro-rata command-power budgets replace entry-funded top-N/season prize claims. No shared leaderboard is faked with local storage.
- Contractual cosmetic retirement leaves `totalSupply()` unchanged. No ETH office unlock, automated buyback or added transfer tax exists. All game `act` requests attach zero ETH.
- The handoff/network's actual IMD address and 1.25% pool fee replace earlier conceptual addresses and fee proposals. No alternate router, hook, treasury or token address is guessed.
- Local real-time unit movement is visual and immediate; chain outcomes are determined only by bounded, confirmed strategic orders. Local practice never submits scores for rewards.

These are preserved deployment constraints, not unfinished contract features. This task does not redeploy or rewrite contracts.
