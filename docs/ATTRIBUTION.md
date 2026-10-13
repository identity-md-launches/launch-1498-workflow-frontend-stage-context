# Sources and asset provenance

- Game scene, original low-poly Pepe meshes, portraits, SVG icon set, favicon and 1200×630 poster were authored as code for this frontend. No commercial game assets, pretrained image output, external model downloads or stock imagery are used. The poster is rendered from `web/public/cover.svg` to `cover.png`; it honestly depicts the same opposing bases, crystal basin and squads used in gameplay.
- Three.js (MIT), React/React DOM (MIT), viem (MIT), Vite (MIT) and the TypeScript/Playwright tooling are standard package dependencies pinned in `web/package-lock.json`. Dependency folders and browser binaries are not submitted. License notices for the runtime dependencies and fonts are bundled in `web/public/THIRD-PARTY-NOTICES.txt` and copied into the export.
- Barlow and Barlow Condensed are local Fontsource fonts, designed by Jeremy Tribby and licensed under the SIL Open Font License 1.1. Only the three used Latin WOFF2 faces are exported.
- `web/src/onchain-bridge.js` is the unmodified SDK fetched from [Pepe2Pepe game template](https://github.com/adaki2004/pepe2pepe-game-template/blob/main/sdk/onchain-bridge.js). MIT, copyright 2026 Pepe2Pepe contributors. A local declaration file provides TypeScript types without changing its implementation. The license is retained in `web/reference/pepe2pepe-LICENSE` and in the runtime notices. The implementation follows the [on-chain integration interface](https://github.com/adaki2004/pepe2pepe-game-template/blob/main/ONCHAIN.md).
- Better Interface guidance: Jakub Krehel, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`, MIT, adapted by IMD. Design documentation guidance: Paul Bakaus's Impeccable, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`, Apache-2.0. The combined supplied notices/licenses are retained in `web/reference/better-interface-LICENSE`.
- Ethereum frontend UX guidance: Austin Griffith, pinned commit `06ea4efa08076ff04f6ca4945ef4a2ca881115b0`, MIT. Supplied license retained at `web/reference/eth-frontend-ux-LICENSE`.

## Art decision

Player fantasy: command a small squad of battle-worn green Pepes across a contested crystal supply line.

Visual medium: an original low-poly WebGL military miniature, with matching angular vector portraits and poster.

Memorable motif: luminous crystal shards between opposing cyan and magenta brutalist bases, with thin selection circles around ranked Pepes.

Two cover compositions were considered: a close-up commander portrait over a distant base, and an elevated battlefield showing a squad moving from a cyan base toward the crystal point and magenta base. The latter became the final cover because it shows the actual harvest/build/hold setting at thumbnail size. The portrait composition remains only a briefing component, avoiding a generic character-only game cover. `docs/evidence/cover-thumbnail.png` records the final 240px inspection.
