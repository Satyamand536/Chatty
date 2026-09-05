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
| **Phase** | 0 — Design Foundation (complete, signed off) |
| **Implemented** | **Nothing.** No code, no assets, no networking, no prototypes. |
| **Next** | Phase 1 — greybox solo prototype + 3D asset-pipeline proof |

This repository currently contains design documentation only. Nothing described in these
documents has been built.

---

## Documents

| Document | Contents |
|---|---|
| **[docs/GAME_DESIGN_FOUNDATION.md](docs/GAME_DESIGN_FOUNDATION.md)** | The Phase 0 deliverable: vision, USP, audience, core loop, mechanics, fun design, MVP scope, multiplayer direction, progression, art/audio, tech stack, AI usage, phased roadmap, risks, next step. |
| **[docs/DECISIONS.md](docs/DECISIONS.md)** | Binding decision log (ADR-style, D-001…D-022). Future phases build on these and may not silently revise them. |

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

## Planned structure

Target layout for Phase 1. **These directories do not exist yet** — the structure is
recorded here so the intent is explicit, not because any of it has been created.

```
packages/
  sim/        # Pure game logic. (state, input) -> state. No rendering, no I/O.
  server/     # Authoritative tick loop, rooms, snapshots.
  client/     # Three.js renderer + input. No game logic.
  shared/     # Protocol schema and balance data tables.
  bots/       # Headless scripted players for load and soak testing.
assets/       # Blender sources + exported glTF, with an automated size/poly budget check.
docs/         # Design documentation.
```

The separation of `sim` from `client` is the load-bearing architectural decision
([D-009](docs/DECISIONS.md#d-009--headless-deterministic-engine-agnostic-simulation)):
it is what makes the whole game testable headlessly, and it is why the 2D→3D decision
(Q-C) could be absorbed by changing one package and no design decisions.
