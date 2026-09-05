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
| **Phase** | 0 — Design Foundation |
| **Implemented** | **Nothing.** No code, no assets, no networking, no prototypes. |
| **Next** | Phase 1 — greybox solo prototype (blocked on sign-off, see below) |

This repository currently contains design documentation only. Nothing described in these
documents has been built.

---

## Documents

| Document | Contents |
|---|---|
| **[docs/GAME_DESIGN_FOUNDATION.md](docs/GAME_DESIGN_FOUNDATION.md)** | The Phase 0 deliverable: vision, USP, audience, core loop, mechanics, fun design, MVP scope, multiplayer direction, progression, art/audio, tech stack, AI usage, phased roadmap, risks, next step. |
| **[docs/DECISIONS.md](docs/DECISIONS.md)** | Binding decision log (ADR-style). Future phases build on these and may not silently revise them. |

---

## Awaiting sign-off

Four decisions gate Phase 1. Recommendations are recorded in the decision log as
`Q-A` … `Q-D`:

- **Q-A** — Distribution priority (recommended: browser-first, link-join)
- **Q-B** — Team size and technical comfort
- **Q-C** — 2D vs 3D presentation (recommended: 2D top-down)
- **Q-D** — Monetisation intent (recommended: defer to Phase 7)

## Planned structure

Target layout for Phase 1. **These directories do not exist yet** — the structure is
recorded here so the intent is explicit, not because any of it has been created.

```
packages/
  sim/        # Pure game logic. (state, input) -> state. No rendering, no I/O.
  server/     # Authoritative tick loop, rooms, snapshots.
  client/     # Renderer + input. No game logic.
  shared/     # Protocol schema and balance data tables.
  bots/       # Headless scripted players for load and soak testing.
docs/         # Design documentation.
```

The separation of `sim` from `client` is the load-bearing architectural decision
([D-009](docs/DECISIONS.md)): it is what makes the whole game testable headlessly, and
what would make a future engine port a client rewrite rather than a redesign.
