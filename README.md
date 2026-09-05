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
| **Phase** | 1 — Simulation + art pipeline proof |
| **Implemented** | Headless deterministic simulation (`packages/sim`), procedural glTF asset pipeline (`packages/assets`), Three.js viewer + performance harness (`packages/client`). **No networking. No gameplay client. Not a playable game yet.** |
| **Verified** | 41 tests passing, typecheck clean, 18/18 glTF checks, sim at 0.099–0.182 ms/tick |
| **Not verified** | Mid-range phone frame rate (**no browser in this environment**) and the Blender authoring leg (**no Blender here**). See [Phase 1 Report §4](docs/PHASE1_REPORT.md#4-workstream-b--what-is-verified-and-what-is-not). |
| **Next** | Run the device benchmark, then Phase 2 — playable greybox |

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
