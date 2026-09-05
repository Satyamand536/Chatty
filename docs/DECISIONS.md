# CHAOS KITCHEN — Decision Log

An ADR-style register of binding decisions. **Future phases must build on these and may not
silently revise them.** Changing a decision requires adding a superseding entry below with
a rationale — never editing the original entry.

Status values: `ACCEPTED` (binding) · `PROPOSED` (awaiting sign-off) · `SUPERSEDED`.

---

## Gating decisions — RESOLVED 2026-09-05

All four are now binding. Q-C and Q-D **changed** the Phase 0 recommendation; the effects
are recorded as D-021 and D-022 below.

| ID | Decision | Phase 0 recommendation | **Resolved as** | Status |
|---|---|---|---|---|
| Q-A | Distribution priority | Browser-first, link-join | **Browser-first, link-join** | `ACCEPTED` (confirms D-007, D-010) |
| Q-B | Team size / technical comfort | 1–3 people, TS-comfortable | **1–3 people, TS-comfortable** | `ACCEPTED` (confirms D-010) |
| Q-C | 2D vs 3D presentation | 2D top-down | **3D stylised** — recommendation overridden | `ACCEPTED` → **D-021** |
| Q-D | Monetisation intent | Defer to Phase 7 | **Free-to-play cosmetics** — recommendation overridden | `ACCEPTED` → **D-022** |

---

## Accepted decisions

### D-001 — Genre position: co-op kitchen party game with a chaos-as-reward twist
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Enter the existing co-op cooking genre rather than invent one. Differentiate
  via a shared Chaos meter that *multiplies score*, plus an end-of-round "Bill" that
  attributes mistakes to named players.
- **Rationale:** The genre is proven and commercially validated. Player sentiment for the
  dominant titles identifies social blame and stress — not mechanics — as the core
  complaint, and players explicitly praise self-inflicted trouble. Making chaos profitable
  and blame comedic attacks that specific, documented gap.
- **Alternatives:** a new-genre original concept (higher risk, slower to communicate); a
  straightforward genre entry (no defensible position).
- **Trade-off accepted:** permanent comparison to the genre leader. Accepted deliberately —
  we use the comparison in marketing and copy none of its assets.

### D-002 — Chaos is a reward dial, not a punishment meter
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Score multiplier scales with the Chaos meter (1.0× at 0–25 up to 2.5× at
  76–100), locked at the moment of serving.
- **Rationale:** Converts the genre's central frustration into its central decision, and
  creates the verbal moment the game is built around.
- **Alternatives:** chaos as pure punishment (produces the stress the genre is criticised
  for); chaos as cosmetic only (no decision, no tension).
- **Trade-off accepted:** requires careful balancing so neither safe nor greedy play
  dominates. Verified by headless sweep at the Phase 2 gate.
- **Risk:** if players never raise Chaos voluntarily, the USP is dead. Tracked as R4 and as
  MVP success criterion 3. **This is the project's go/no-go metric.**

### D-003 — Soft failure; only one run-ending condition, and it is opt-in
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Ticket expiry, missed revenue targets, and Chaos hitting 100 never end a
  shift. Only the opt-in "Hard Shift" health inspector can end a shift early.
- **Rationale:** Directly implements the "entertaining even when players fail" requirement
  and removes the restart cliff that kills party-game momentum.
- **Alternatives:** lives system, run-ending failure, escalating difficulty. All rejected
  as punitive and anti-social.
- **Trade-off accepted:** lower stakes may reduce tension for hardcore players. Mitigated by
  the optional Hard Shift mode.

### D-004 — Three inputs total; hold-to-progress for every interaction
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Move, Act (context-sensitive), Ping. No timing minigames, no twitch inputs,
  no fourth button in the MVP.
- **Rationale:** Casual accessibility; supports mixed-skill groups; and — critically —
  makes the game inherently tolerant of network latency, since no action is frame-perfect.
- **Alternatives:** timing minigames for chopping (adds skill expression but excludes
  casual players and amplifies latency).
- **Trade-off accepted:** lower mechanical skill ceiling. Compensated by the strategic
  depth of the Chaos dial and routing.

### D-005 — Visible interaction targeting is a hard requirement
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Ambiguous Act targets are resolved by proximity and **highlighted before
  input**.
- **Rationale:** Imprecise context-sensitive interaction is a documented player complaint
  about this genre.
- **Trade-off accepted:** slightly more visual noise. Worth it.

### D-006 — Colourblind-safe encoding from day one
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** No meaning is ever encoded by colour alone. Every state also carries a
  distinct glyph and silhouette. Verified against all three deficiency types in Phase 5.
- **Rationale:** A game about fire and burnt food cannot depend on red-vs-green.
  Retrofitting this onto a colour-coded art direction is effectively a full art redo.
- **Trade-off accepted:** more constrained art direction and slightly busier icons.

### D-007 — Multiplayer: online browser co-op by room code, local shared-screen first
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Local shared-screen in Phases 1–2; online 2–4 player co-op by room code in
  Phase 3. No accounts, no friends list, no matchmaking service.
- **Rationale:** A link is the invite, which is the entire acquisition model. Local-first
  sequencing proves the fun before paying for infrastructure.
- **Alternatives:** local-only (caps reach); native mobile (slow iteration); Steam-first
  (a purchase wall in front of a link-join game).
- **Trade-off accepted:** no console path in v1; requires hosting.

### D-008 — No fake or stubbed networking before Phase 3
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Zero networking code, interfaces, or mocked transports until Phase 3.
- **Rationale:** Project rule 3. Stubbed multiplayer creates false confidence and an
  interface that must be redesigned anyway.
- **Trade-off accepted:** Phase 3 carries more integration risk. Mitigated by D-009, which
  keeps the simulation network-shaped from the start.

### D-009 — Headless, deterministic, engine-agnostic simulation
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** The game logic is a pure `(state, input) -> state` module with no
  rendering, I/O, or global dependencies. Server and client share it. Authoritative server
  at 20 Hz; client prediction for the local player, interpolation for remote players.
- **Rationale:** The single biggest quality lever available to a small team — it makes the
  whole game unit-testable, fuzzable, and balance-sweepable in CI. It also means a future
  engine port is a client rewrite, not a redesign.
- **Alternatives:** engine-resident game logic (Unity/Godot/Unreal). Rejected primarily
  because headless testing is far more expensive there.
- **Trade-off accepted:** some upfront architectural cost; a 20 Hz tick rate is an
  unvalidated assumption until Phase 3 latency testing.

### D-010 — Technology stack: TypeScript monorepo, Node server, Three.js renderer
- **Status:** ACCEPTED (confirmed by Q-A and Q-B; renderer amended by D-020)
- **Phase:** 0
- **Decision:** `sim` / `server` / `client` / `shared` / `bots` packages. Node + `ws`
  transport, renderer per D-020, Vite build, Vitest tests.
- **Rationale:** One language across sim/server/client eliminates protocol translation
  bugs; the sim is directly testable; a URL is the invite; and it is the only option that
  builds, tests, and serves in the current development environment.
- **Alternatives:** Unity (best for Steam/console, wrong fit for a link-join game with a
  systems-and-data differentiator); Godot 4 (**the recommended switch if Q-A resolves to
  native-first** — free, MIT, excellent 2D); Unreal (rejected, overkill and weak at 2D).
- **Trade-off accepted:** no console path, no asset store, browser performance ceiling,
  wrappers required for desktop/mobile.
- **Conditional:** if Q-A resolves to Steam/console-first, supersede this with Godot 4 and
  keep every design decision D-001…D-009 intact.

### D-011 — MVP scope locked
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** One kitchen, 4 recipes, 3 disasters, all 4 Chaos tiers, 240 s shift, local
  1–4 players (verified at 2), cosmetics-only progression, and The Bill with a share card.
- **Rationale:** Smallest complete build that can prove the USP. Every exclusion is listed
  with a reason in §6.2.
- **Trade-off accepted:** 4-player local support is present but only verified at 2 players
  until Phase 3. Flagged as a deliberate deviation from the brief.
- **Change rule:** any addition to the MVP requires a corresponding removal.

### D-012 — The Bill and its share card ship in the MVP
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** The end-of-shift recap, including an exportable 1080×1080 share image with
  a join link, is MVP scope — not a late polish item.
- **Rationale:** The share card *is* the acquisition channel. Built from the start it is
  the growth loop; bolted on at the end it is a marketing feature.
- **Trade-off accepted:** MVP scope grows slightly.

### D-013 — Recap text is templated, not LLM-generated
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** ~40 hand-written verdict templates selected by shift profile and
  interpolated with real event data. No runtime LLM calls in v1.
- **Rationale:** Latency at the emotional peak, per-shift cost at scale, offline
  reliability, and a quality floor that generation cannot guarantee. The humour is in the
  real data; the template only presents it.
- **Alternatives:** runtime LLM generation.
- **Trade-off accepted:** less variety. An optional "extra spicy verdict" toggle can be
  layered on later if players ask.

### D-014 — No pay-to-win, no loot boxes, no energy systems, no seasons
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Progression is cosmetic and play-earned. Monetisation, if any, is a
  one-time purchase covering up to 4 players or free-with-cosmetics, decided in Phase 7.
- **Rationale:** Antithetical to the casual social audience, and to a design built on
  "one more round."
- **Trade-off accepted:** lower revenue ceiling per player.

### D-015 — Progression never gates core mechanics
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** Every station and every base recipe is available to a brand-new player.
  Unlocks are cosmetics, guest "Special" recipes, and kitchens.
- **Rationale:** Mechanic gating creates the "new player can't join their friends" problem
  documented as a core flaw in this genre.
- **Trade-off accepted:** weaker long-tail unlock motivation. Compensated by modifiers.

### D-016 — Difficulty is the Chaos dial, not a difficulty setting
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** No difficulty sliders. Risk is self-selected via Chaos and Rush. An opt-in
  "Hard Shift" mode adds the only run-ending condition.
- **Rationale:** A difficulty menu asks players to self-assess; a live dial lets them
  negotiate in the moment, which is more social and more fun.
- **Trade-off accepted:** less explicit accessibility control. Partially offset by the
  accessibility options in Phase 6.

### D-017 — Art direction: 2D flat-vector "Diner Cartoon" with original gremlin staff
- **Status:** **SUPERSEDED BY D-021** (2026-09-05, sign-off Q-C selected 3D). Retained for
  the audit trail per the change procedure — do not delete.
- **Phase:** 0
- **Decision:** Top-down 2D, thick outlines, flat colour, squash-and-stretch. Original
  gremlin designs. No asset, character, UI layout, or brand element derived from any
  existing title.
- **Rationale:** Cheaper and faster than 3D, better suited to exaggerated comedy, and
  visually distinct from the 3D incumbents.
- **Alternatives:** 3D stylised (genre default, expensive, adjacent to incumbents); pixel
  art (reads retro, weaker squash-and-stretch).
- **Trade-off accepted:** diverges from audience expectations set by 3D genre leaders.

### D-018 — Audio reacts vertically to the Chaos meter
- **Status:** ACCEPTED
- **Phase:** 0
- **Decision:** One surf/ska track in four stems, layered and distorted as Chaos rises.
  Every Chaos source has a distinct sound.
- **Rationale:** Cheap, well-understood technique. Lets players diagnose the kitchen by
  ear while looking elsewhere — audio is a gameplay system here, not decoration.

### D-019 — Name is NOT cleared
- **Status:** ACCEPTED (as a known open risk)
- **Phase:** 0
- **Decision:** "CHAOS KITCHEN" is treated as a **working title only**. A collision with a
  live Roblox title of the same name was identified during Phase 0. A trademark and
  marketplace search is required before Phase 1.
- **Rationale:** Cheap to resolve now; expensive after art, audio, and a storefront exist.
- **Trade-off accepted:** naming work may reopen. Deliberately preferred over discovering
  it at launch.

### D-020 — Renderer is Three.js (amends the renderer portion of D-010)
- **Status:** ACCEPTED
- **Phase:** 0 (sign-off revision)
- **Supersedes:** the renderer named in D-010 (PixiJS). The rest of D-010 is unchanged.
- **Decision:** `packages/client` renders with **Three.js**. Chosen over Babylon.js for
  ecosystem size, glTF tooling, and hireable familiarity — decisive for a 1–3 person team
  (Q-B). Babylon's built-in engine features are ones we deliberately do not want, since the
  simulation owns all game state and we want no engine-side physics authority.
- **Trigger:** Q-C selected 3D; a 2D renderer cannot serve it.
- **Evidence the architecture held:** this change touched **one package and zero design
  decisions**. The simulation (D-009) has no rendering dependency, so a 2D→3D switch is a
  client concern only. This is the concrete payoff of D-009 and the reason it was decided
  before the presentation layer.
- **Trade-off accepted:** Three.js is a library, not an engine — no built-in editor,
  inspector, or asset browser. Accepted, because the greybox-to-glTF pipeline is scripted
  and testable, which an editor would not give us.

### D-021 — Art direction is 3D stylised low-poly, not 2D
- **Status:** ACCEPTED
- **Phase:** 0 (sign-off revision)
- **Supersedes:** D-017
- **Decision:** Low-poly stylised 3D with a fixed ¾ overhead camera, flat-ish shading, no
  PBR, no dynamic shadows on dynamic objects, capped dynamic lights, no post-processing
  chains. Original gremlin designs retained from D-017.
- **Trigger:** Q-C.
- **Why the sub-style is a hard constraint:** low-poly/flat-shaded is what keeps 3D
  affordable for a 1–3 person team (Q-B) and performant in desktop *and mobile* browsers
  (Q-A). A realistic or PBR-stylised direction breaks both and is out of scope.
- **Alternatives:** 2D flat-vector (D-017 — cheaper, more visually distinct, rejected at
  sign-off); realistic 3D (unaffordable); voxel (too rigid for the comedy).
- **Trade-offs accepted, recorded as risks:**
  - **R11** — 3D art costs roughly 3–5× 2D, against a 1–3 person team that must also feed a
    continuous F2P cosmetic supply (D-022). **The most likely cause of schedule failure.**
  - **R12** — 3D in mobile browsers is the weakest link in a link-join, mobile-friendly,
    free-to-play platform plan. This risk did not exist under D-017.
  - **R14** — 3D moves us visually closer to the genre incumbents, weakening visual
    differentiation.
- **Containment (requirements, not aspirations):** shared rig and swappable modular parts;
  procedural material variants; a hard asset budget fixed before Phase 1 (4 characters,
  ~14 props, ~10 food items, 6 cosmetics); **a glTF pipeline proof in Phase 1**; **a
  mobile-browser frame-rate checkpoint in Phase 1**. Both proofs exist to retire R11/R12
  in week 2 rather than in Phase 5.
- **New requirement introduced by this decision:** the no-occlusion rule
  (§10.4 rule 7). In 2D nothing hides behind anything; in 3D, props and characters can
  occlude food, stations, and players. Fixed camera angle and a validated layout are
  mandatory. This is the most common way a 3D top-down game quietly becomes unreadable.

### D-022 — Monetisation is free-to-play with cosmetics; the store is still Phase 7
- **Status:** ACCEPTED
- **Phase:** 0 (sign-off revision)
- **Supersedes:** the "deferred, decide in Phase 7" position in D-014. D-014's prohibitions
  (no pay-to-win, no loot boxes, no energy systems, no seasons) all remain in force.
- **Decision:** Free-to-play with cosmetic purchases. Two currencies (earned **Tips**,
  purchased **Coins**); every item buyable with Coins must also be buyable with Tips.
  **Nothing purchasable touches gameplay** — not the Chaos meter, score multiplier, timers,
  recipes, or station speed. The **store itself is deferred to Phase 7**, but the **cosmetic
  pipeline is MVP scope**.
- **Trigger:** Q-D.
- **Why the pipeline is MVP scope while the store is not:** cosmetics require modular,
  socket-based attachments on a shared rig. Retrofitting modularity onto finished characters
  is close to a rebuild, so the pipeline must be built in from the start. The store, by
  contrast, is a leaf feature that can be added at any time.
- **Why the hard line on gameplay:** the Chaos dial *is* the game (D-002). Any purchasable
  influence over it destroys the one thing that makes the game worth playing. This is a
  design constraint before it is an ethical one.
- **Alternatives:** one-time purchase covering 4 players (simpler business for a small
  team, but adds a purchase wall in front of a link-join growth loop); ads (rejected — a
  4-minute session has no non-hostile ad break).
- **Trade-off accepted, recorded as R13:** F2P cosmetics is a harder business than a
  one-time purchase for a 1–3 person team, because it needs volume, conversion, and a
  steady supply of new 3D items — and D-021 limits that supply. Mitigation: hold the store
  until Phase 7 with real D1/D7 retention data. Weak retention cannot be fixed by store
  design, so waiting costs nothing and keeps the option open.

---

## Decision-change procedure

1. Open an entry with the next `D-xxx` number and status `SUPERSEDES D-xxx`.
2. State what changed, why, what evidence supports it, and which phases are affected.
3. Do not edit or delete the superseded entry. The history is the audit trail.
4. If the change affects a phase gate, the gate's verification requirements must be
   restated.
