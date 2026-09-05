# CHAOS KITCHEN

> **Working title — not cleared. See [R1 / D-019](docs/DECISIONS.md#accepted-decisions).**

A 2–4 player co-op party game in which a staff of incompetent little monsters runs a
restaurant that is always 30 seconds away from catastrophe — and where **going faster is
what sets it on fire**.

Every shortcut, mistake, and panic-button press fills a shared **Chaos** meter. Chaos
spawns disasters. Chaos also **multiplies the money you earn**, up to 2.5×. So the team is
constantly arguing about how much danger it wants to be in.

Every shift ends with **The Bill**: an itemized receipt of exactly what went wrong and who
did it.

---

## Project status

| | |
|---|---|
| **Phase** | 3 — Local multiplayer built. Phase 2 greybox complete but **not yet human-playtested**. |
| **Implemented** | Headless deterministic simulation (`packages/sim`), procedural glTF pipeline (`packages/assets`), a **playable greybox shift** (`packages/client`), and **1–4 cooks on one shared screen** — keyboard cluster per player, Gamepad API, touch stick, per-player colour/ring/highlight, per-cook HUD strip, lobby cook-count picker. **No networking yet — that is Phase 7 per D-023.** |
| **Verified** | 86 tests passing (incl. full-shift soak at 1/2/4 players, headless scene-graph checks, and the local-multiplayer input wiring driven through the real `step()`), typecheck clean, production build clean, 18/18 glTF checks |
| **Not verified** | **Rasterised output.** There is no browser in this environment — I tried installing Chromium and the download is blocked — so I have never seen a single frame of this game. Scene *construction* is tested headlessly (positions, colours, geometry), but pixels, HUD legibility, camera framing, game feel and phone frame rate all need your eyes. Also unverified: the Blender authoring leg. The preview panel has repeatedly failed to reach the dev server. |
| **Next** | **Human playtest** — this is the blocker. Both Phase 2 and Phase 3 are gated on a person actually playing it, which I cannot do from here. Then Phase 4: fun + content. |

---

## Documents

| Document | Contents |
|---|---|
| **[docs/GAME_DESIGN_FOUNDATION.md](docs/GAME_DESIGN_FOUNDATION.md)** | The Phase 0 deliverable: vision, USP, audience, core loop, mechanics, fun design, MVP scope, multiplayer direction, progression, art/audio, tech stack, AI usage, phased roadmap, risks, next step. |
| **[docs/DECISIONS.md](docs/DECISIONS.md)** | Binding decision log (ADR-style, D-001…D-024). Future phases build on these and may not silently revise them. |
| **[docs/PHASE1_REPORT.md](docs/PHASE1_REPORT.md)** | What Phase 1 built, what was actually verified, what was not, and the four design defects building it uncovered. |

---

## Sign-off (resolved 2026-09-05)

| | Decision | Resolved as |
|---|---|---|
| **Q-A** | Distribution | **Browser-first, link-join** — as recommended |
| **Q-B** | Team | **1–3 people, TypeScript-comfortable** — as recommended |
| **Q-C** | Presentation | **3D stylised** — **changed** the Phase 0 recommendation (was 2D) |
| **Q-D** | Monetisation | **Free-to-play cosmetics** — **changed** the Phase 0 recommendation (was: defer) |

**Q-C and Q-D overrode the recommendations, and both are recorded as superseding decisions**
(D-021, D-022) rather than quietly edited in. Their consequences are treated as real:

- **Q-C → 3D** changes the renderer (PixiJS → Three.js, D-020), multiplies art cost
  ~3–5×, adds a mobile-browser performance risk, and weakens visual differentiation
  against the genre incumbents. Tracked as risks **R11, R12, R14**.
- **Q-D → F2P** moves the cosmetic pipeline into MVP scope (retrofitting modularity later
  is near-rebuild cost) while keeping the store at Phase 7. Tracked as risk **R13**.

The architectural core — the headless, renderer-agnostic simulation (**D-009**) — is
**unaffected by either change**. Only `packages/client` and the art plan moved, which is
the concrete justification for having decided the architecture before the presentation
layer.

**Still open: the name.** "CHAOS KITCHEN" collides with a live Roblox title and is treated
as a working title only. A trademark and marketplace search is required before Phase 1
(D-019, risk R1).

## Structure

```
packages/
  sim/        # ✅ Pure game logic. (state, input) -> state. No rendering, no I/O.
  assets/     # ✅ Procedural glTF generator + validator.
  client/     # ✅ Three.js viewer + performance harness (not yet a game client).
  server/     # — Phase 7 (authoritative tick loop, rooms, snapshots).
  shared/     # — folded into sim/data for now; extract when the protocol lands.
  bots/       # — seeded by packages/sim/test/bot.ts; promoted in Phase 7.
assets/       # Generated .glb (gitignored; regenerate with npm run build:assets).
docs/         # Design documentation.
```

The separation of `sim` from `client` is the load-bearing architectural decision
([D-009](docs/DECISIONS.md#d-009--headless-deterministic-engine-agnostic-simulation)):
it is what makes the whole game testable headlessly, and it is why the 2D→3D decision
(Q-C) could be absorbed by changing one package and no design decisions.
