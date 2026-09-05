# Phase 1 Report — Simulation + Art Pipeline Proof

**Date:** 2026-09-05 · **Branch:** `arena/01a07132-chatty` · **Status:** Workstream A complete and verified; Workstream B partially verified (see §4)

Phase 1 had two workstreams and two gates. This report states what was built, what was
actually verified by running it, what was **not** verified and why, and the four design
defects the work uncovered.

---

## 1. What was built

### Workstream A — the simulation (complete)

```
packages/sim/
  src/
    types.ts          # SimState, PlayerInput. Plain serializable data, no functions.
    sim.ts            # step(state, inputs, dt) -> state. The game.
    rng.ts            # mulberry32. No Math.random() anywhere in the sim.
    data/
      chaos.ts        # Chaos constants + tier table (S5.8)
      items.ts        # Item defs with cook/prep timings
      recipes.ts      # 3 recipes + exact-set matching
      kitchen.ts      # "The Diner" layout
  test/
    sim.test.ts                 # determinism, purity, replay, timer, grades, chaos, rush
    recipes.integration.test.ts # bot plays burger + fries crate-to-pass
    chaos.test.ts               # disasters, extinguishing, cleaning, soup loop
    layout.test.ts              # kitchen geometry invariants
    bot.ts                      # scripted player (seed of packages/bots)
  bench.ts            # headless performance benchmark
```

Implements: player state and movement, collision, context-sensitive Act, pickup/drop,
cooking with three states, prep/chopping, assembly, serving at the pass, dirty pans and
cleaning, the Chaos meter with all four tiers, the Rush button, three disasters, order
lifecycle, scoring with the chaos multiplier, and the 240 s shift timer with grades.

### Workstream B — art pipeline (partial, see §4)

```
packages/assets/
  src/glb.ts       # dependency-free glTF 2.0 binary writer (skinning + animation)
  src/gremlin.ts   # procedural low-poly rigged gremlin
  build.ts         # emits assets/gremlin.glb AND validates it
packages/client/
  src/main.ts      # Three.js viewer + on-device performance harness
```

---

## 2. Verification — what was actually run

| Check | Command | Result |
|---|---|---|
| Typecheck (sim, assets, client) | `npm run typecheck` | clean, 0 errors |
| Unit + integration tests | `npx vitest run` | **41 passed, 41 total, 0 failed** |
| Simulation benchmark | `npm run bench:sim` | 0.099 ms/tick (1p) → 0.182 ms/tick (4p) |
| Asset build + glTF validation | `npm run build:assets` | **18/18 checks passed** |
| Client serves | `npm run dev` | `/` 200, `/gremlin.glb` 200 (38,684 bytes, `model/gltf-binary`) |

### Phase 1 gate 1 — determinism ✅ MET

The contract in D-009 is tested directly, not assumed:

- **Identical seed + inputs → byte-identical state** after 3,000 ticks (JSON comparison).
- **`step` does not mutate its argument** — state is JSON-compared before and after.
- **Recorded input replay** — 1,500 ticks of recorded 2-player input reproduce exactly.
- **Different seeds → different states**, proving randomness actually flows from the seed.
- No `Math.random()`, no `Date.now()`, and no module-level mutable state anywhere in the
  sim. (One existed — see §3.4 — and was moved into state.)

### Phase 1 gate 1 — three recipes ✅ MET

Not just unit-tested: a **scripted bot walks each recipe from crate to pass** using only the
three inputs the design allows. This is the test that matters, because it proves the
interaction rules *compose*.

| Recipe | Result |
|---|---|
| Panic Burger (3 components, 3 stations) | served, `+revenue`, attributed to player 0 |
| Doom Fries (slice → fry, 2 steps) | served in **15.9 s** of sim time |
| Suspicious Soup (chop → boil) | served, and did **not** boil over because it was attended |

### Phase 1 gate 1 — Chaos + Rush ✅ MET

Rush costs exactly +25 Chaos, is attributed to the pressing player, runs 10 s, then enters a
30 s cooldown during which it cannot be re-triggered. Disasters spawn in the danger band and
never in the CALM band. Every disaster telegraphs before activating (the §5.8 fairness rule,
asserted as a test). Grease fire cannot be extinguished bare-handed. Cleaning drops Chaos by
exactly 8 and credits the player.

---

## 3. Four design defects found by building it

These are the real value of the phase. None would have been found by writing more documents.

### 3.1 The kitchen layout contained a trap — **fixed**

The original L-shaped wall blocked `x ∈ [4,11]`, which made the three right-hand ingredient
crates reachable **only** through a corridor at `x ≤ 3.65`. A player holding "up" got pinned
against an invisible edge with no visible reason. The trace showed a bot wedged at (7.7, 3.4)
for 30 seconds.

**Fix:** the wall now blocks only the far corner (`x ∈ [8,11]`), so every crate is
approachable from directly below. Encoded as a permanent invariant test — every station must
be standable at, and must be the unique nearest target from at least one standing point.

**Rule recorded in the layout data:** *walls must force routing, never create a trap.*

### 3.2 Cooking timings were on the wrong item — **fixed**

Timings lived on the *cooked* item defs (`patty_cooked`), so a raw patty on the grill never
cooked at all. Separately, transforming `item.def` on completion meant the cooked item lost
its source timings and could no longer burn — the pan would sit there forever.

**Fix:** timings live on the input item, and the component key is derived from
`(def, cookState)` rather than by swapping the def. One stable def per item; one timing table
drives cook → burn.

### 3.3 Boil-over was unreachable — **fixed**

Soup had `burntAtSec: 8.0` and `boilOverAtSec: 9.5`, so it always burned before it could boil
over. The pot's signature failure mode could never fire.

**Fix:** burn moved to 12.0 s, so boil-over at 9.5 s happens first. **Rule: a mechanic's
failure state must be ordered before any earlier failure state, or it is dead code.**

### 3.4 An unbounded event log made the sim 30× slower over a shift — **fixed**

`step` deep-clones the whole state each tick, and `events` grew without limit across a
240 s shift, so every tick got progressively more expensive. Measured before: **~2.6 ms/tick**
(the test suite took 65 s). After bounding the log to the most recent 200 events:
**0.099–0.182 ms/tick** and a **4.2 s** test suite.

**~14–30× faster from one line of policy.** The Bill does not need every event — it needs the
aggregate `stats` plus a few headline moments.

---

## 4. Workstream B — what is verified and what is not

Stated plainly, because this is the part that is easy to overclaim.

### Verified

- **The glTF pipeline produces a valid rigged character.** `assets/gremlin.glb`: 856
  triangles (under the 1,500 budget in §10.2), 648 vertices, 8 bones, 5 animation channels,
  37.78 KiB, single primitive / single draw call.
- **18 structural checks pass** on the written file: container magic and version, chunk
  sizes, bufferView bounds, accessor validity, presence of `POSITION/NORMAL/JOINTS_0/WEIGHTS_0`,
  POSITION min/max for culling, joint indices in range, **skin weights summing to 1.0 for all
  648 vertices**, and animation channels targeting real nodes with legal paths.
- **It reaches the browser.** The dev server serves it with the correct MIME type and the
  Three.js viewer loads and renders it with a greybox kitchen built from the *same*
  `KITCHEN` data the simulation uses — which incidentally proves the cross-package
  data-sharing idea behind D-009.

### NOT verified — and why

- **The Blender → glTF leg.** **Blender is not installed in this environment** (verified:
  no `blender` binary). The mesh is generated procedurally instead. This proves the
  *export-and-load* half of the pipeline, not the DCC authoring half.
  *Note:* for a 1–3 person team a procedural generator may be the better pipeline anyway —
  versionable, diffable, and a cosmetic variant costs milliseconds rather than an artist's
  afternoon. That directly attacks R11. **But it is a different pipeline than the one D-021
  assumed, and it should be a conscious decision, not an accident.** See §5.
- **The mid-range phone frame rate.** There is **no browser in this environment** (verified:
  no Chromium binary), so no FPS number was produced here. Fabricating one would be worse
  than having none.
  **What was built instead:** a real on-device harness. Open the live preview on the target
  phone and it reports FPS, frame time, glb load time, draw calls, triangles, DPR and
  viewport, with 1 / 4 / 8 / 16-gremlin stress buttons. **R12 stays open until someone runs
  it on a real device.**

---

## 5. Open items before Phase 2

1. **Run the phone benchmark.** R12 cannot be closed any other way. If a mid-range phone
   cannot hold 60 fps with 4 gremlins and a full-chaos kitchen, the art budget shrinks or the
   platform plan reopens — per D-021, decided at this gate, not later.
2. **Decide the asset pipeline deliberately.** Procedural generation, Blender authoring, or
   both? Phase 1 proved the first is viable. This deserves a decision entry, because it
   determines the cosmetic supply rate that F2P (D-022) depends on.
3. **Interaction ambiguity: 13 station pairs sit closer than the reach radius.** Reported by
   `layout.test.ts` as a measured baseline. The design answer is already in §5.2 — the client
   must highlight the resolved target before input. **That highlight is now a Phase 2
   requirement, not polish.**
4. **Resolve the name** (R1 / D-019). Still outstanding.

---

## 6. Reproduce

```bash
npm install
npm run typecheck     # 0 errors across sim, assets, client
npx vitest run        # 41 passed
npm run build:assets  # emits + validates assets/gremlin.glb (18/18 checks)
npm run bench:sim     # ms/tick and rooms-per-core
npm run dev           # Three.js viewer + on-device performance harness
```
