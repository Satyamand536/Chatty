# CHAOS KITCHEN — Game Design Foundation (Phase 0)

> **STATUS: DESIGN ONLY. NOTHING IN THIS DOCUMENT IS IMPLEMENTED.**
> This is the Phase 0 deliverable. It contains decisions, not features. No code, no
> assets, no networking, and no prototypes exist yet. Any statement below describing
> behaviour describes *intent*, to be built and verified in a later phase.
>
> Every decision made here is binding for later phases unless it is formally revised in
> [`DECISIONS.md`](./DECISIONS.md). See rule 8 and rule 9 of the project brief.

| | |
|---|---|
| **Document** | Phase 0 — Product & Design Foundation |
| **Version** | 0.1 (draft for review) |
| **Date** | 2026-09-05 |
| **Repo state at time of writing** | Greenfield: one `README.md`, one commit (`b2277b3`) |
| **Next phase** | Phase 1 — Greybox solo prototype (blocked on sign-off, see §14) |

---

## Where each requested item lives

| Requested output | Section |
|---|---|
| 1. Game vision | [§1](#1-game-vision) |
| 2. Unique selling point | [§2](#2-unique-selling-point) |
| 3. Target audience | [§3](#3-target-audience) |
| 4. Core gameplay loop | [§4](#4-core-gameplay-loop) |
| — Gameplay mechanics (requested in body) | [§5](#5-gameplay-mechanics) |
| 5. MVP feature list | [§6](#6-mvp-definition) |
| 6. Fun and replayability design | [§7](#7-fun-and-replayability-design) |
| 7. Multiplayer direction | [§8](#8-multiplayer-design-direction) |
| 8. Progression design | [§9](#9-progression-design) |
| 9. Art and audio direction | [§10](#10-art-and-audio-direction) |
| 10. Recommended technology stack | [§11](#11-technical-direction) |
| 11. AI/GenAI opportunities | [§12](#12-ai--genai-usage) |
| 12. Complete phased roadmap | [§13](#13-development-roadmap) |
| 13. Major risks | [§14](#14-major-risks) |
| 14. Recommended next step | [§15](#15-recommended-next-step) |

---

## 1. Game Vision

**CHAOS KITCHEN is a 2–4 player co-op party game in which a staff of incompetent little
monsters runs a restaurant that is always 30 seconds away from catastrophe — and where
going faster is what sets it on fire.**

Three sentences of intent:

1. Players cooperate to fill orders in short, loud, four-minute "shifts."
2. Every shortcut, mistake, and panic-button press fills a shared **Chaos** meter — and a
   high Chaos meter **multiplies the money you earn**, so the team is constantly arguing
   about how much danger it wants to be in.
3. Every shift ends with **The Bill**: an itemized, brutally funny receipt of exactly what
   went wrong and who did it.

**Fiction.** The staff are gremlins — small, chaotic, entirely unqualified monsters hired
by a restaurant franchise one health inspection away from closure. This is not set
dressing; it is load-bearing. It explains why the kitchen burns, it makes failure
diegetically *correct*, and it removes the sting of losing: you were never supposed to be
good at this.

**Tone.** Saturday-morning cartoon crossed with a failing fast-food franchise. Loud, warm,
slapstick, never mean. The game laughs *with* the players, and it always has a receipt.

**Elevator pitch.** *"Overcooked's panic, but the panic is the point — and the game keeps
score of who caused it."*

---

## 2. Unique Selling Point

### Primary USP

> **The only co-op cooking game where chaos is a *reward* you choose to take on — and
> every round ends with an itemized bill proving who caused it.**

Two mechanisms carry this, and both are cheap to build:

**A. Chaos is currency, not punishment.** In every other game in the genre, mistakes are
pure loss. Here, the team's shared Chaos meter drives a **score multiplier** (1.0× at
calm, up to 2.5× at near-meltdown). Serving a plate at 90% Chaos pays dramatically more.
This converts the genre's central frustration into the genre's central *decision*. "We're
at 88, do we push it?" becomes the sentence players actually say out loud.

**B. Failure is attributed and celebrated, not hidden.** The Bill names names:
*"Rita dropped the soup. Three times."* Because the game frames mistakes as achievements
rather than faults, blame turns into a bit. This is a deliberate attack on the single
best-documented weakness of the genre — see the evidence note below.

### Evidence for the gap being attacked

This is not a guess about what the genre needs. Published player sentiment and developer
interviews for the two dominant titles in the space repeatedly identify the same failure
mode, and it is social rather than mechanical:

- Overcooked is described by players as "fun but too stressful most of the time," and the
  most-praised quality of the leading alternative is that it "found a way to dial down the
  personal experience of overwhelming panic while remaining faithful to the chaotic drama"
  ([Steam reviews, PlateUp!](https://steamcommunity.com/app/1599600/reviews/?browsefilter=toprated)).
- Press coverage of PlateUp!'s design specifically frames co-op cooking games as producing
  "blame and conflict with your friends," with the developer's stated aim being that no
  player should feel like a burden ([Nintendo Life feature](https://www.nintendolife.com/features/avoiding-co-op-frictions-and-frustrations-in-roguelite-restaurateur-plateup)).
- Notably, players *praise* self-inflicted trouble — "Overcooked, but you create your own
  problems" appears as a top-rated positive framing ([Steam reviews](https://steamcommunity.com/app/1599600/reviews/?browsefilter=toprated)).

**Read-through:** the audience wants the chaos and resents the blame. Our answer is to
make chaos *profitable* and blame *comedic*. The second USP is not a feature bolted on to
a cooking game; it is the correction to a documented problem.

### Secondary differentiators

| Differentiator | Why it's not generic |
|---|---|
| **The Rush button** | Any player can unilaterally trigger a 10-second kitchen-wide speed boost at the cost of +25 Chaos. It is a physical button in the world, not a menu. It manufactures the "don't you dare press that" moment by construction. |
| **The Bill / shift recap** | A generated, shareable receipt card. Cheap to build, high perceived value, and the actual reason a session extends by one more round. |
| **Hold-to-progress interactions** | No twitch inputs, no frame-perfect timing. Everything is "stand and hold." This is simultaneously an accessibility win, a casual-player win, and — critically — what makes the game tolerant of network latency (§8). |
| **Soft failure** | Missing the revenue target does not end the run or delete progress. You get a "CLOSED EARLY" stamp and a scathing review. Losing is content. |
| **Gremlin staff** | An original, funny, IP-safe identity that justifies incompetence (see the IP caution in §14, R1). |

### What we are deliberately *not* claiming

We are not inventing the co-op kitchen genre, and we should not pretend to in marketing.
We are entering an existing, proven genre with a specific, defensible twist. Claiming
otherwise would be dishonest and would set the wrong expectations for players and for
ourselves.

---

## 3. Target Audience

### Primary: "Couch-and-Discord co-op friends" (18–35)

Groups of 2–4 who play together weekly, own at least one party game, and choose games by
**"will this make us laugh"** rather than by depth. They will not tolerate a tutorial
longer than 90 seconds. They buy games because a friend sent a link.

- **Why they return:** sessions are 4 minutes, so "one more" is nearly free.
- **Why they invite:** the invite *is* the product — a room code or link, no install, no
  account wall.
- **Retention hook:** The Bill is designed to be screenshotted and posted. The marketing
  loop and the social loop are the same loop.

### Secondary: casual/family co-op (all ages, mixed skill)

Mixed-skill groups — a parent and kids, or one gamer and three non-gamers. This is the
group the genre most often loses, because skill gaps produce resentment.

- **Design obligation this creates:** a low-skill player must always have something
  genuinely useful to do. Hence: washing, binning, and carrying are real, scoring
  contributions (§5.6), not busywork. A player who only ever washes dishes still moves the
  team's score. This is a hard requirement, not a nice-to-have.

### Tertiary: solo players

Solo play is a *practice and chill* mode, not a co-equal pillar. This is a deliberate
scope decision — see the risk in §14, R3. Documented coverage of the genre notes a
substantial solo difficulty gap
([Spawning Point review](https://spawningpoint.com/article/plateup-review-2026)); we accept
that gap rather than paying to close it, because our core value is social.

### Explicitly not targeting

Competitive/esports players, simulation-realism fans, single-player narrative players, and
speedrunners. Designing for them would pull the game toward precision and punishment —
exactly the tone we are avoiding.

### Platform recommendation

**Browser-first, mobile-browser-friendly, online co-op by room code**, with local
shared-screen supported from the start and desktop packaging deferred. Full trade-off
analysis in §8; technical consequences in §11.

---

## 4. Core Gameplay Loop

### 4.1 The loop, step by step

| # | Step | What happens | Why it's fun |
|---|---|---|---|
| 1 | **Enter a room** | A player creates a shift and gets a 5-letter code. Others join by code or link. Lobby is the kitchen itself — walk around, honk at each other, try the Rush button harmlessly. | No menu screen between friends and the game. The lobby is a toy, not a waiting room. |
| 2 | **Prepare for the round** | ~20 seconds. See tonight's menu (4 recipes) and the shift modifier ("Greasy Floors Tonight"). Gremlins can grab a hat. | Sets expectation and gives a plan to argue about. "Okay, you fry, I plate" is the first teamwork beat. |
| 3 | **Receive orders** | Tickets slide onto a 4-slot rail. Each has a customer face, a mood, a timer bar, and a coin value. | A visible, finite queue creates shared priorities and immediate negotiation. |
| 4 | **Perform kitchen tasks** | Chop, grill, boil, fry, plate. Hold-to-progress on everything. | Simple inputs, satisfying feedback, and a rhythm. The pleasure of a working assembly line. |
| 5 | **Coordinate with teammates** | Ping a ticket or item; a speech bubble marks it and the first responder claims it. Two-person carries for heavy items. | Gives non-voice players a real coordination channel, and creates "I pinged the soup!" moments. |
| 6 | **Handle disasters** | Chaos tier drives what goes wrong: a grease fire, a mouse stealing ingredients, a wobbly cart, then at high Chaos a sprinkler flood or a health inspector visit. | The kitchen becomes an opponent that reacts to *your* play rather than to a random table. |
| 7 | **Complete or fail orders** | Correct plate at the pass → the satisfying **ding**, the ticket stamps and flies off, coins into the tip jar. Expired ticket → customer storms out, +Chaos, no run-ending penalty. | Win is loud and immediate. Lose is funny and survivable. |
| 8 | **Receive score and rewards** | The shift ends on the timer. The Bill appears: revenue, grade, chaos peak, biggest mistake, most valuable cook, a chaos sparkline, and a one-line verdict. | The emotional peak of the session is *after* play ends. This is the beat that makes people screenshot. |
| 9 | **Unlock something meaningful** | A new Special recipe, a cosmetic, or a new kitchen — surfaced as a single line on The Bill, never a grind bar. | Progress is a surprise attached to a memory, not a percentage. |
| 10 | **Start another round** | One button: "NEXT SHIFT," pre-filled with the same room. Always shows one near-miss ("40 coins short of an A"). | Removes every point of friction between the laugh and the retry. |

**Target loop timings:** lobby 15–30 s → shift 240 s → Bill 20–30 s → next shift < 5 s.
Total cycle under 5 minutes. This is the single most important number in the document: if
the cycle exceeds ~6 minutes, "one more round" dies.

### 4.2 The loop's shape

```
        ┌──────────────────────────────────────────────┐
        │                                              │
   ┌────▼────┐    ┌────────┐    ┌──────────┐    ┌──────┴────┐
   │  Serve   │───▶│ +Coins │───▶│ -Chaos   │───▶│  Calmer   │
   │ correctly│    │ ×mult  │    │ (decay)  │    │  kitchen  │
   └────▲────┘    └────────┘    └──────────┘    └──────┬────┘
        │                                              │
        │                                        safe, slow, 1.0×
        │                                              │
   ┌────┴────┐    ┌────────┐    ┌──────────┐    ┌──────▼────┐
   │  More   │◀───│Disasters│◀───│  +Chaos  │◀───│  Mistakes │
   │  money  │    │  spawn  │    │          │    │  / RUSH   │
   └─────────┘    └────────┘    └──────────┘    └───────────┘
             risky, loud, up to 2.5×
```

The loop is a **dial the players turn**, not a linear track. The same four minutes can be
played safe-and-boring or greedy-and-catastrophic, and both are valid. That single
property is what makes the loop replayable without new content.

---

## 5. Gameplay Mechanics

Design constraint above all others: **three inputs total.** Move, Act, Ping. Anything that
needs a fourth input does not ship in the MVP.

### 5.1 Movement

- 8-directional analog movement; top-down; no jumping, no crouching, no camera control.
- Walk speed is deliberately brisk but not twitchy. No sprint. Speed comes from the Rush
  modifier, not from player skill.
- Players collide and gently push each other. Collisions are soft (no stun) but add +1
  Chaos — bumping is free, *constant* bumping is not.
- No falling off the map. Counters are obstacles, not hazards.

**Why:** movement in this genre should never be the skill test. The skill is *routing and
prioritisation*.

### 5.2 Interaction — one context-sensitive button

A single **Act** button does the obvious thing to whatever you are facing:

| Facing | Act does |
|---|---|
| Empty counter + holding item | Put item down |
| Counter with item + hands empty | Pick item up |
| Ingredient on a prep station | **Hold** to chop (progress ring) |
| Pot / grill / fryer | Hold to cook, or place/remove item |
| The Pass | Serve held plate |
| Dirty pan / spill | Hold to clean |
| Burning object | Hold extinguisher to put out |
| Trash bin | Discard held item |
| Rush button | Hold to trigger Rush |

**Ambiguity rule:** when two valid targets exist, the game picks the nearest and shows a
highlight before you press. Imprecise context-sensitivity is a documented complaint about
this genre
([PlateUp! review](https://www.geekyhobbies.com/plateup-indie-video-game-review/)), so
**visible target highlighting is a hard requirement**, not polish.

### 5.3 Picking up and dropping

- **One item per player**, held visibly overhead. No inventory. This is a core constraint:
  it is what forces coordination.
- **Dropping is physical.** A dropped item splats, is destroyed, and leaves a slippery
  decal for ~10 s. Dropping costs +4 Chaos.
- Dropped food becomes a *prop* — it can be slipped on, kicked, and it visually accumulates.
  A floor covered in your own failures is a comedy asset.
- **Two-person carry:** the stock pot and the delivery crate require two players, both of
  whom are immobilised in their other hand. Committing to a carry is a real team decision.

### 5.4 Cooking

Every heat source is a **three-state timer with a visible state change**:

`RAW → COOKED (3s perfect window) → BURNT`

- A progress ring wraps the station; colour shifts pale → golden → black.
- Cooked items emit steam and a soft glow. Burnt items emit smoke and a hiss.
- Leaving a station unattended past the perfect window does not instantly burn — you get a
  ~1.5 s audible and visual warning. **Every punishment is telegraphed.** This is the
  difference between chaotic and unfair.
- Boiling pots can **boil over** into a mess (+Chaos, +cleaning job) rather than simply
  failing, so an ignored pot creates *work*, not just loss.

### 5.5 Preparing ingredients

Chopping is a hold with a progress ring (~1.2 s). Some ingredients need two chops
(potato → fries), some one (tomato). No minigames, no timing windows. **The MVP has zero
skill-based inputs.** Precision mechanics are an accessibility and latency liability here,
and this genre is already criticised for imprecise controls.

### 5.6 Serving orders

- Assembling happens at the **Plating station**: hold to add each component; the ticket
  shows which components are present and which are missing.
- Serving at **The Pass** — only one plate fits the pass slot at a time. This creates a
  natural queue and a genuine negotiation point, and it stops four players from all
  serving at once.
- Correct serve: **ding**, ticket stamps and flies off, coins animate into the tip jar,
  Chaos −6, and the score multiplier applies.
- Wrong serve: the customer's face falls, a sad trombone plays, the plate is binned,
  +10 Chaos. The customer stays — they are annoyed, not gone.
- **Low-skill contribution:** washing dirty pans and binning burnt food both grant score
  and reduce Chaos. A player who never cooks is still essential. (See §3, secondary
  audience.)

### 5.7 Cleaning

- Cooking generates dirty pans; spills generate slippery decals; burnt food generates mess.
- Cleaning is a hold (~1 s) at a Sink or with a mop.
- Cleaning reduces Chaos **fast** (−8 per clean). This makes cleaning a strategic act, not
  a chore: cleaning is how you *bank* calm before a push.
- Dirty pans are finite — if all pans are dirty, you cannot cook. Running out of clean pans
  is a self-inflicted, highly readable disaster.

### 5.8 Fire and disasters — the Chaos system

This is the spine of the game. Full specification:

**The Chaos meter** is team-wide, 0–100, always visible at the top of the screen as a
thermometer with a grease-splatter fill.

**Sources of Chaos**

| Cause | Chaos |
|---|---|
| Food burns | +8 |
| Item dropped | +4 |
| Pot boils over | +6 |
| Player collision | +1 |
| Wrong order served | +10 |
| Ticket expires | +15 |
| Dirty pan left > 20 s | +2 |
| **Rush triggered** | **+25, then +2/s for 10 s** |

**Chaos reduction:** correct serve −6, cleaning −8, extinguishing −10, natural decay −1/s.

**Tiers and consequences**

| Chaos | State | What happens | Score multiplier |
|---|---|---|---|
| 0–25 | **CALM** | Nothing. Boring. | 1.0× |
| 26–50 | **RATTLED** | Lights flicker, shelves rattle, one mouse steals an ingredient | 1.2× |
| 51–75 | **ROWDY** | Grease fire on a specific burner, oil slick, wobbly cart, rogue delivery crate | 1.7× |
| 76–100 | **FULL CHAOS** | A kitchen-wide event: sprinkler flood, health inspector, power cut, or VIP food critic | 2.5× |

**Design intent of each tier.** Low tiers are *ambient comedy* (free laughs, low cost).
Mid tiers are *active problems* (things to solve). High tiers are *set pieces* (the thing
you'll tell the story about). Escalation is tiered so that a round has a shape rather than
a flat noise level.

**Fairness rule (non-negotiable):** every disaster has a 0.6–1.0 s anticipation tell — a
sound, a shadow, a shake — before it becomes active. Ambush punishment is the fastest way
to make chaos feel unfair instead of funny.

### 5.9 Time pressure

- A **240-second shift timer**, always visible, with the last 30 s pulsing and the music
  gaining a layer.
- **No order ever expires the run.** Ticket expiry costs coins and Chaos only.
- The shift ends when the clock does — never early, never by failure. This removes the
  "we lost and now we have to restart the whole thing" cliff that kills party-game
  momentum.

### 5.10 Team coordination

| Tool | Purpose |
|---|---|
| **Ping (3rd input)** | Marks a ticket or world object with a bubble. First responder visually claims it. Replaces voice chat for players without it. |
| **The Pass bottleneck** | One plate at a time → forces turn-taking and communication. |
| **Two-person carries** | Explicit commitment decisions. |
| **Shared Chaos meter** | Everyone owns the risk. No individual scoreboard during play. |
| **Rush button** | A unilateral action with team-wide consequences — the engine of friendly betrayal. |
| **No leader in the UI** | No host crown, no "party leader" label in the lobby. Documented as a deliberate design choice by a successful competitor ([Nintendo Life](https://www.nintendolife.com/features/avoiding-co-op-frictions-and-frustrations-in-roguelite-restaurateur-plateup)) and adopted here for the same reason. |

### 5.11 Scoring

```
Order value = base_price × chaos_multiplier_at_serve × freshness_bonus
```

- `base_price`: 40–140 depending on recipe complexity.
- `chaos_multiplier_at_serve`: from the tier table above. **Locked at the moment of
  serving** — this is what makes timing a push meaningful.
- `freshness_bonus`: 1.0–1.25× for serving with > 50% of the ticket timer remaining.
  Rewards good routing without punishing slow play.
- **Tips:** consecutive correct serves build a combo (×1.1 per streak, cap ×1.5). A wrong
  serve or expiry resets it.
- **Grade thresholds** at shift end: D / C / B / A / S against a revenue target that
  scales with player count.

### 5.12 Failure conditions

| Failure | Consequence | Run-ending? |
|---|---|---|
| Ticket expires | Lost coins, +15 Chaos | No |
| Revenue target missed | "CLOSED EARLY" stamp, scathing review on The Bill, lower grade | No |
| Chaos hits 100 | A Full Chaos event fires and Chaos resets to 70 | No |
| **Health inspector (opt-in Hard Shift)** | Contraband found → shift ends early | **Yes** |

**Only one thing can end a shift early, and it is opt-in.** Everything else is friction,
not failure. This is the direct implementation of the "entertaining even when players
fail" requirement.

### 5.13 Round completion

The timer hits zero → kitchen freezes → camera pans across the mess you made → The Bill
prints, line by line, with a typewriter effect and a cash-register sting → grade stamp
slams down → one unlock line → "NEXT SHIFT."

The pan across the mess is not decoration. It is the game showing you the physical
evidence of the story you just created, and it is the setup for the joke in the next beat.

---

## 6. MVP Definition

**Goal of the MVP:** prove that four minutes in this kitchen is funny with other people,
using the least possible content. Nothing else matters.

### 6.1 Included

| Area | MVP scope |
|---|---|
| **Map** | One kitchen: "The Diner" — a single-screen L-shaped layout, ~11×13 tiles, no scrolling camera. |
| **Players** | 2–4 local shared-screen players. Solo practice mode (1 player). **Primary validated configuration: 2 players.** |
| **Recipes** | **4.** Panic Burger, Suspicious Soup, Doom Fries, Emergency Salad. (The salad is deliberately cook-free: it is the low-skill, low-risk order that keeps mixed-skill groups playing.) |
| **Stations** | 3 counters, 2 grills, 2 pots, 1 fryer, 1 plating station, 1 pass, 1 sink, 1 bin, 1 extinguisher, 1 Rush button. |
| **Cooking** | Hold-to-progress; three-state timers; chop/grill/boil/fry; assembly at plating. |
| **Orders** | 4-slot ticket rail, per-ticket timer, customer mood face, escalating spawn rate. |
| **Chaos** | Full meter with all four tiers, but only **3 disasters** implemented: grease fire, slippery spill, mouse thief. |
| **Scoring** | Base price × chaos multiplier × freshness, combo tips, revenue total, D–S grade. |
| **Timer** | 240 s, fixed. |
| **Round end** | The Bill (templated text — see §12) + grade + one unlock line + replay button. |
| **Progression** | Cosmetics only: 6 hats and 4 aprons earned from 5 achievements. |
| **Input** | Keyboard + up to 4 gamepads (same device). Three actions. |
| **Audio** | 2 music layers (calm/chaos), ~20 SFX, gibberish gremlin vocalisations. |
| **Art** | Functional placeholder art with **correct silhouettes and correct colour coding** (§10). Placeholder ≠ ugly; it must already be readable. |

### 6.2 Explicitly NOT in the MVP

| Excluded | Why |
|---|---|
| **Any networking whatsoever** | No sockets, no lobby service, no room codes. The MVP is same-device only. This is a hard exclusion — we will not stub or fake it (§8, and project rule 3). |
| Online multiplayer, matchmaking, accounts | Phase 3. |
| Kitchens 2 and 3 | Phase 4. |
| Recipes 5+ and the Mystery Special | Phase 4. |
| Full Chaos tier-4 events (sprinklers, health inspector, power cut, critic) | Phase 2/4 — these are the most expensive content in the game. |
| Two-person carries | Phase 2 (needs the interaction system to settle first). |
| Recipe unlocks, kitchen unlocks, challenges, leaderboards | Phase 4. |
| Character customisation beyond hats/aprons | Phase 4. |
| Voice chat, text chat, emotes | Phase 5 at the earliest; the ping system is the MVP substitute. |
| Mobile touch controls | Phase 5. |
| Localisation | Phase 6. |
| Monetisation of any kind | Phase 7 decision, and likely never in the MVP sense. |
| Difficulty settings | Rejected outright — the Chaos dial *is* the difficulty setting. |
| Tutorial level | Replaced by a 45-second interactive overlay in the lobby. |

### 6.3 Recommended scope adjustment (flagged per brief rule 10)

The brief lists "2–4 players" in the MVP. I am keeping it, with one honest caveat:
**validating 4 local players on a single keyboard is not practical.** The MVP therefore
*supports* 1–4 local players, but the *verified* configuration is 2 (one keyboard + one
gamepad). 3- and 4-player configurations are verified headlessly with bot clients in
Phase 3, when networking exists. This is the smallest honest deviation from the brief.

### 6.4 MVP success criteria — measurable, decided now

The MVP is a **success** only if, in 10 recorded 2-player playtests with people who have
not seen the design doc:

1. ≥ 7/10 say they would play another round unprompted.
2. ≥ 6/10 laugh out loud at least once per session (observed, not self-reported).
3. ≥ 5/10 spontaneously trigger Rush at least twice — i.e. the risk dial is *used*, not
   ignored. This is the single most important test: if players never push Chaos, the USP
   is not working and must be redesigned before any further spend.
4. Average session length ≥ 3 consecutive shifts (~15 min).
5. No player asks "what am I supposed to do?" after their second shift.

Criterion 3 is the go/no-go. A cooking game is not a business; a cooking game where
players voluntarily choose danger is.

---

## 7. Fun and Replayability Design

This is the section that determines whether the project is worth building. The governing
principle: **every funny moment must have a named cause and a visible consequence.** Random
events produce shrugs. Attributed, physical, escalating consequences produce stories.

### 7.1 Funny failures

The rule set:

1. **Failure leaves an object.** Burnt food is pickable, throwable, and stains. A dropped
   egg is a decal you can slip on. Your mistakes accumulate *visibly* in the world, so by
   minute three the kitchen is a portrait of your incompetence.
2. **Failure is attributed.** Every Chaos-generating event records the acting player. The
   Bill reports it. "Diego burnt the soup. Twice." is funnier than "the soup burnt"
   because it has a victim and a witness.
3. **Failure is tiered, not binary.** An ignored pot boils over → makes a mess → the mess
   is slippery → someone slips → they drop the plate → +Chaos → tier rises → new disaster.
   One small mistake becomes a four-beat comedy sequence. **This causal chain is the
   single most important design asset in the game** and it costs almost nothing to build,
   because each link already exists as a mechanic.
4. **Failure is framed as achievement.** The Bill's "Biggest Mistake" is presented with a
   trophy icon and applause. The game's attitude toward your error is delight.

### 7.2 Unexpected situations — layered, not random

Three distinct sources, in escalating rarity:

| Layer | Source | Example | Why it works |
|---|---|---|---|
| **Tier 1 — Causal** | Directly caused by a player action | Left the fryer → grease fire | Fully predictable. Feels fair. Teaches the systems. |
| **Tier 2 — Reactive** | Triggered by the Chaos tier you chose to be in | At 51+ a mouse steals ingredients | Consequence of a *decision*, so it reads as earned. |
| **Tier 3 — Set piece** | Once per shift, telegraphed 3 s in advance | Health inspector / food critic / crate of live lobsters | The story you retell. Announced, never ambushed. |

**Crucially, none of this needs an RNG table.** Tier 1 is deterministic. Tier 2 is a
lookup on a number the players control. Only Tier 3 rolls, and it rolls rarely and loudly.
This is how we avoid "random events as a substitute for design."

### 7.3 Teamwork moments — designed, not hoped for

Emergent teamwork is unreliable. These are *engineered*:

- **The Pass bottleneck** — one slot, so someone must always be ready to receive.
- **Two-person carries** — the stock pot needs two pairs of hands, which removes two
  players from the line for 8 seconds. A real, felt commitment.
- **Panic-only tasks** — extinguishing needs the extinguisher *and* someone to bin the
  ruined food. Cleanup is inherently two-person at high Chaos.
- **Ping claiming** — a pinged ticket shows who took it, so "you get the burgers, I've got
  soup" is a one-button negotiation.
- **The Rush button's social weight** — anyone can press it, everyone pays for it. This is
  the game's designed betrayal engine, and it produces more laughter per line of code than
  anything else in the document.

### 7.4 Friendly chaos

Because Chaos pays, **the team argues about risk.** That argument is the game. Safe teams
earn ~1.0–1.2× and finish calm with a boring Bill. Greedy teams earn up to 2.5×, set the
kitchen on fire, and get an unforgettable Bill. Both are winning. No strategy is
dominant, because the reward is not only points — it is the quality of the story.

### 7.5 Satisfying success

Ranked by importance, because these are cheap and disproportionate:

1. **The ding.** One sound, pitched up with each combo step. It must be Pavlovian — the
   most important single asset in the game. Budget real time for it.
2. **Ticket stamp-and-fly.** The ticket physically stamps "PAID" and rockets off the rail.
3. **Tip jar coins.** Coins arc across the screen into a jar that visibly fills.
4. **Combo counter** with escalating pitch.
5. **A 0.5 s slow-mo beat on a triple serve** — rare enough to feel earned.
6. **The grade stamp** slamming onto The Bill at the end.

### 7.6 Replayability — three independent axes

| Axis | Varies by | Content cost |
|---|---|---|
| **Playstyle** | How much Chaos the team chooses to run | **Zero.** Free, permanent, and the deepest axis. |
| **Modifiers** | Per-shift rules ("Greasy Floors", "No Fryer", "Everything Burns 30% Faster") | Very low — data only, no new art. |
| **Layouts** | Different kitchens with different routing problems | High — the expensive axis, used sparingly. |

The deliberate strategy: **invest in axes 1 and 2, spend as little as possible on axis 3.**
Modifiers give dozens of distinct experiences for the cost of a data table. This is how a
small team stays off the content treadmill.

### 7.7 "One more round" motivation

Five specific, implementable mechanisms:

1. **End on the peak.** The Bill is the funniest thing in the round, and it comes last.
2. **Always show exactly one near-miss.** "40 coins short of an A." Not three, not zero —
   one specific, achievable gap.
3. **Zero-friction restart.** Same room, same players, one button, under 5 seconds.
4. **An unlock teased but not granted.** "Serve 3 Suspicious Soups to unlock Lobster
   Panic. (2/3)" — visible progress toward a *funny* reward.
5. **4-minute shifts.** A retry costs less than the conversation about whether to retry.

### 7.8 Shareable moments

**The Bill is a designed shareable artifact**, not a stats screen:

```
╔══════════════════════════════════════╗
║   THE GREASY SPOON — SHIFT #14        ║
║   GRADE: B     REVENUE: 1,240        ║
║                                       ║
║   CHAOS PEAK  ▁▂▃▅▇█▇▅▃▂▁   (94%)    ║
║                                       ║
║   BIGGEST MISTAKE                     ║
║   🏆 Rita dropped the soup. 3 times.  ║
║                                       ║
║   MOST VALUABLE COOK                  ║
║   ⭐ Diego — 6 plates, 0 fires         ║
║                                       ║
║   "Technically a restaurant."         ║
╚══════════════════════════════════════╝
```

Requirements: exportable as a 1080×1080 image, includes a room/link code so a viewer can
join the next session. **The share card is our acquisition channel.** It must be built in
the MVP, not deferred — a shareable artifact added at the end is a marketing feature;
built from the start, it is the growth loop.

---

## 8. Multiplayer Design Direction

### 8.1 Recommendation

**Online co-op, browser-first, join-by-room-code, authoritative server — with local
shared-screen supported from Phase 1.**

Sequencing matters as much as the choice: **local first (Phase 1–2), online in Phase 3.**
Never the reverse. Networking is a multiplier on existing fun, not a source of it.

### 8.2 Trade-off analysis

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Local shared-screen** | Cheapest to build and test; purest party experience; zero latency; no servers to run | Requires everyone on one couch — a hard social constraint; cannot be playtested remotely; caps audience | **Include, but not sufficient alone** |
| **Online browser (recommended)** | Zero install; a link *is* the invite; instant remote playtesting; works on phones (where invitations actually get clicked); same codebase across client/server/sim; trivial CI | No console path without porting; browser perf ceiling; needs hosting; no storefront discovery | **Primary target** |
| **Native mobile** | Best retention and store presence; huge casual audience | Slowest iteration; store review friction; input constraints; 4-player co-op on 4 phones is socially awkward | Defer; revisit as a port |
| **PC/Steam native** | Real storefront, wishlist economics, better monetisation | Heavier build; a purchase wall in front of a game whose growth loop is "click this link" | Defer as a packaging target |
| **Console** | Where party games sell well | Certification cost, platform fees, porting a browser stack | Out of scope for v1 |

### 8.3 The key architectural decision

**The simulation is a headless, deterministic, engine-agnostic module with no rendering or
input dependencies. The server runs it authoritatively. Clients render it.**

Consequences, all of which are deliberate:

- The *same* simulation code runs on the server and in every client — no logic divergence,
  no double implementation.
- The simulation is a pure function of (state, input) → next state, so it can be **unit
  tested and run thousands of rounds headlessly in CI**. This is the single biggest quality
  lever available to a small team, and it is only available because of this decision.
- Balancing is done in data tables the headless sim can be swept over automatically.
- If we later port to a native engine, we port the *client* and re-use the simulation.

### 8.4 Latency strategy — and how it shapes the mechanics

Party co-op with shared world state is latency-sensitive. Rather than fight this, the
mechanics were designed around it. **This is why every interaction is hold-to-progress
(§5.2–5.5) and there are zero twitch or timing inputs.** A game with no frame-perfect
actions tolerates 150 ms without feeling wrong.

Planned approach for Phase 3:

- Authoritative server at 20 Hz simulation ticks.
- Client-side prediction for the local player; snapshot interpolation for remote players.
- Input buffering for the Act button so a press is never silently dropped.
- Graceful disconnect: a dropped player's gremlin stands still and can be taken over.
- Target: fully playable at 150 ms; degraded-but-fair at 250 ms.

**Honest uncertainty:** 20 Hz and these tolerances are reasonable starting assumptions for
this genre, not measured facts. They must be validated with real remote players in
Phase 3 before we commit to them in the design.

### 8.5 Room model

- 5-character room code, no accounts, no friends list, no invites infrastructure.
- Join by link: `chaos.kitchen/join/ABCDE` — the link works on a phone.
- Host migration if the host leaves. Lobby allows join/leave at any time.
- Mid-shift join: allowed in Phase 4+, spawning as a new gremlin. **Not** in the MVP or
  Phase 3.

---

## 9. Progression Design

**Governing rule: no grinding.** Every unlock should be reachable in a normal session, and
nothing gameplay-affecting should ever be locked behind time spent.

| System | Design | Anti-grind guarantee |
|---|---|---|
| **Shift grade** | D–S per shift, based on revenue vs. a player-count-scaled target | No XP, no levels, no XP bars anywhere in the UI |
| **Recipe unlocks** | A new "Special" appears as a one-off ticket. Serve it successfully 3 times *across any shifts* and it joins the permanent menu | ~2–3 shifts per recipe, and you earn it by playing normally |
| **Kitchen unlocks** | 3 kitchens total: The Diner (default), The Fish Market, The Space Galley | ~3 hours of play unlocks all three. No kitchen is gated behind a paywall or a skill wall |
| **Cosmetics** | Hats, aprons, pan skins, floor decals, kitchen signage | Earned from achievements only. Never sold in a way that affects play |
| **Challenges** | Weekly modifier sets with a shared global goal and personal bests | Optional. Never required for any unlock |
| **Achievements** | ~30, all joke-framed ("Arsonist: extinguish 10 fires", "Health Code? Never heard of her") | Pure cosmetic reward |
| **The Bill history** | Your last 20 shifts kept locally, scrollable | Creates a personal story log at zero design cost |

### Explicitly rejected

- **Pay-to-win** — rejected absolutely.
- **Loot boxes / random cosmetics** — rejected. Randomness in reward punishes exactly the
  casual audience we are targeting.
- **Energy systems / timers** — rejected. Antithetical to "one more round."
- **Battle passes / seasons** — rejected for v1. They require a content treadmill we
  cannot feed (§7.6).
- **Progression-gated core mechanics** — rejected. Every station and every recipe must be
  usable by a brand-new player. Unlocking *mechanics* is how co-op games create the
  "new player can't join" problem documented in this genre
  ([Nintendo Life](https://www.nintendolife.com/features/avoiding-co-op-frictions-and-frustrations-in-roguelite-restaurateur-plateup)).

**Monetisation direction (if any, decided in Phase 7):** a single one-time purchase
covering up to 4 players, or free-with-cosmetics. Both keep the game non-predatory. This
decision is deliberately deferred — it must not influence MVP design.

---

## 10. Art and Audio Direction

### 10.1 Art direction — "Diner Cartoon"

**Flat-vector, thick-outline, top-down 2D.** Saturday-morning cartoon by way of roadside
diner signage. Bold shapes, no gradients, no realistic lighting, no 3D.

Why this and not alternatives:

| Alternative | Why rejected |
|---|---|
| 3D stylised (the genre default) | Expensive, slow to iterate, harder to keep readable, and puts us visually adjacent to the incumbent titles. 2D is cheaper, faster, and *more* distinct here. |
| Pixel art | Cheap, but reads as retro rather than cartoon, and struggles with the exaggerated squash-and-stretch this game needs. |
| Realistic | Antithetical to tone. |

**Originality constraint (project rule 5):** all characters, props, UI, and branding are
original designs. We are working in an established genre, so similarity of *concept* is
unavoidable and legitimate — but no asset, character design, UI layout, name, or brand
element may be derived from an existing title. Concrete guardrails: our cooks are gremlins
rather than human chefs; our UI is a paper receipt/diner-ticket motif rather than a wooden
board; our camera is fixed top-down with no tilt.

### 10.2 Character style

Small, round, big-eyed gremlin line cooks, roughly 1:1 head-to-body. Exaggerated limbs for
readable animation at small scale. Each is distinguished by **silhouette and one accent
colour**, never by face detail (faces are unreadable at game scale). Distinctive ears,
horns, or antennae per character so player identification works at a glance and in
colourblind conditions.

*Note:* "gremlin" as a general folklore monster is fine to use; the specific 1984 film
creature designs are not. Original designs only — this is a legal guardrail, not a style
preference.

### 10.3 Kitchen style

Chunky, oversized equipment (readable at a glance), checkered diner floors, warm pendant
lighting, and clutter that is *decorative only* — no gameplay-relevant object may be
visually ambiguous with a prop. As Chaos rises, the kitchen's presentation degrades:
lights flicker, saturation shifts warm, smoke accumulates, and floor decals layer up.

### 10.4 Colour and readability principles

Non-negotiable rules, ordered by priority:

1. **Silhouette first.** Every interactable must be identifiable from its outline alone.
2. **One hue per station type, constant across all kitchens.** Grill = warm orange,
   cold prep = teal, fryer = yellow, sink = blue, pass = green. Players learn the kitchen
   vocabulary once and it transfers.
3. **Never encode meaning by colour alone.** Every state also has a distinct glyph and
   silhouette. ~8% of men have red-green colour vision deficiency; a game about fire and
   burnt food cannot rely on red vs. green. **This is a hard requirement from day one**,
   because retrofitting colourblind support onto a colour-coded art style is a full art
   redo.
4. **Three food states must read from across a room:** raw = pale/dull, cooked = golden +
   steam, burnt = black + smoke + particles.
5. **Chaos is communicated globally, never by obscuring gameplay.** Vignette, flicker,
   saturation shift. Never screen shake that impairs aim, never smoke that hides items.
6. **Player characters are the highest-contrast elements on screen, always.** A player must
   be able to find themselves in under a second in a full-chaos kitchen.

### 10.5 Animation priorities

In build order — this is where the budget goes:

1. **Walk/carry/turn** with squash-and-stretch and lean into movement. The most-seen
   animation in the game; it carries the whole tone.
2. **Chop loop** — snappy, 3–4 frames, with a particle burst.
3. **Fire, smoke, steam** — the comedy of the game lives here.
4. **Food state transitions** with a scale "pop" on state change.
5. **Disaster anticipation frames** — the 0.6–1.0 s tell (§5.8). Fairness depends on this.
6. **Customer enter/exit + mood faces** — 3 moods, big and readable.
7. **Idle gremlin behaviour** — cheap personality; fidgets, glances at the camera.

### 10.6 Sound effects

- **The ding** (correct serve) is the highest-priority sound in the project. Pitch rises
  with combo. It should be instantly recognisable out of context.
- Sad trombone on a wrong serve. Cash register on grade reveal. Exaggerated cartoon foley
  throughout — no realistic kitchen sounds.
- Gibberish gremlin vocalisations, pitch-shifted per character. **No full voice acting** —
  gibberish is funnier, infinitely cheaper, and needs no localisation.
- Every Chaos source needs a distinct sound, because **players must be able to diagnose the
  kitchen by ear** while looking at the other side of the screen. Audio is a gameplay
  system here, not decoration.

### 10.7 Music direction

**Energetic surf-rock/ska kitchen band, vertically layered against the Chaos meter.** One
track, four stems:

| Chaos | Music |
|---|---|
| 0–25 | Bass + drums + clean guitar. Laid back. |
| 26–50 | Add percussion and hand claps. |
| 51–75 | Add horns. Tempo +10%. |
| 76–100 | Add a theremin. Distortion on the master. It should sound like the band is also panicking. |

This is a well-understood, cheap technique (vertical stem layering) with a disproportionate
effect: **the music tells players the state of the game without them looking at the UI.**
It is also the strongest argument for making Chaos the central mechanic — no other cooking
game's soundtrack responds to how badly you are doing.

---

## 11. Technical Direction

### 11.1 Environment facts (verified in this workspace)

Recorded because they are real constraints on iteration, not opinions:

- Node.js **v22.22.3**, npm **10.9.8** — present.
- Python **3.11.2** — present.
- **Unity: not installed.** No editor, no CLI.
- **Godot: not installed.**
- **.NET SDK: not installed.**
- Git 2.39.5 and GitHub CLI 2.23.0 — present.

This is a headless environment with no GUI editor. It can build, test, and *serve* a web
game, and it can run a live in-browser playtest — but it cannot drive a Unity or Godot
editor. That asymmetry is worth stating plainly when choosing a stack.

### 11.2 Option evaluation

| Criterion | Unity | Godot 4 | Unreal | **Web / TS (recommended)** |
|---|---|---|---|---|
| 2D party-game fit | Good | **Excellent** | Poor | **Excellent** |
| Multiplayer maturity for 4p authoritative | **Strong (NGO/Mirror)** | Adequate, less battle-tested | Strong but heavy | Strong — well-understood WebSocket + custom authoritative sim |
| Iteration speed for systems work | Medium (editor round-trip, C#) | Fast | Slow | **Fastest** (HMR, plain text, no editor) |
| Headless CI / automated testing | Hard | Possible | Hard | **Trivial** — the sim is pure TS, testable directly |
| Instant remote playtesting via link | No | No (export needed) | No | **Yes — this is decisive** |
| Cross-platform reach | **Best** | Very good | Good | Good (browser + wrappers) |
| Console path | **Best** | Via third-party vendors | Best | None without a port |
| Asset store / ready-made content | **Best** | Good | Best | Weak |
| Licensing / cost friction | Some | **None (MIT)** | Royalty terms | **None** |
| Team hiring pool | **Largest** | Smaller | Large | Large (web devs) |
| Fits this environment today | **No** | No (installable, but headless) | No | **Yes** |

### 11.3 Recommendation

**TypeScript monorepo, headless deterministic simulation package, Node authoritative
server, PixiJS renderer, WebSocket transport, Vite build, Vitest test runner.**

```
chaos-kitchen/
  packages/
    sim/        # THE GAME. Pure TS. No rendering, no I/O, no globals.
                # (state, input) -> state. Deterministic. Fully unit-testable.
    server/     # Node + ws. Room management, authoritative tick loop, snapshots.
    client/     # PixiJS renderer + input. Renders sim state. No game logic.
    shared/     # Types, protocol schema, data tables (recipes, chaos, balance).
    bots/       # Headless scripted players for load and soak testing.
  docs/         # This document and the decision log.
```

**Why this stack, in priority order:**

1. **It makes the simulation testable, and that is the whole ballgame.** A pure-function
   sim can be run 10,000 rounds in CI, fuzzed for crashes, and swept for balance
   automatically. No editor-based engine gives us this as cheaply. For a small team, this
   is the difference between shipping and not.
2. **One language across sim, server, and client** eliminates protocol translation bugs —
   a leading cause of netcode defects.
3. **The invite is a URL.** Our entire acquisition model (§7.8) depends on frictionless
   join. No native engine can do that without a wrapper.
4. **It is the only option that runs, builds, tests, and serves in this environment today**,
   which means every future phase is immediately verifiable rather than theoretically
   verifiable.

**Why not Unity, despite it being the safer commercial default:** Unity is genuinely the
right answer if the primary goal is a Steam/console release with an experienced C# team. It
is not the right answer here because our multiplayer requirement is small-scale (2–4
players, low entity count, no physics authority needs), our differentiator is systems and
data rather than rendering, and our distribution model is link-based. We would pay Unity's
costs and use none of its strengths.

**Why not Godot:** Godot is the strongest *native* alternative and I would choose it over
Unity for this game if native were required. It is free, fast, and superb at 2D. It loses
here on two points only: instant link-based playtesting, and headless testability of the
simulation. If the platform decision in §15 changes to "native first," **Godot 4 is the
recommended switch**, and this document's design sections carry over unchanged.

### 11.4 Accepted trade-offs — stated honestly

| We accept | Because |
|---|---|
| No console release in v1 | Console is not where a link-join party game grows first |
| Browser performance ceiling | Irrelevant at 2D top-down, 4 players, < 200 entities |
| No asset store; all content made in-house | Our asset volume is deliberately tiny |
| Desktop/mobile require wrappers (Tauri / Capacitor) | Deferred to Phase 7; wrappers are cheap once the web build exists |
| Self-hosted infrastructure cost | Room-based servers scale to zero when idle; cost is negligible below ~10k DAU |

### 11.5 Migration path (the hedge)

Because the simulation is engine-agnostic and all content is data (§11.3), a move to
Godot or Unity later is a **client rewrite, not a redesign**. Recipes, timings, chaos
tables, and balance data are portable as-is. This is the reason to invest in the
sim/client separation even though it costs some upfront effort — it is the cheapest
insurance available against the platform risk in §14, R2.

---

## 12. AI / GenAI Usage

Applied rule: **AI is used where it removes human toil, never where it replaces a design
decision.** A joke that only lands 80% of the time is worse than no joke, which puts a hard
ceiling on generative use in the core game.

### 12.1 Development-time — high value, adopt

| Use | Value | Risk |
|---|---|---|
| **Headless bot players for testing** | Runs 4-player soak tests and load tests without humans. Catches deadlocks and edge cases no playtest finds | Low. **Note: this is scripted behaviour, not GenAI** — it is the highest-value "AI" in the project and costs almost nothing |
| **Playtest transcript analysis** | Cluster free-text feedback into themes; surface the top 5 complaints per build | Low |
| **Bug triage from logs/stack traces** | Cluster crashes, dedupe, suggest owners | Low |
| **Test-case generation from the data schema** | Every recipe row generates validation tests | Low |
| **Balance sweeps** | Simulate thousands of shifts to find dominant strategies and dead recipes | Low, and uniquely enabled by the headless sim (§11.3) |
| **Placeholder art and scratch SFX** | Unblocks engineering before real assets exist | Must never ship without a human pass |
| **Content drafting** (disaster names, achievement text, customer barks) | Fast first drafts into a curated data table | Medium — a human must approve every line that ships |

### 12.2 Runtime — deliberately minimal

**The Bill's verdict line: templates, not an LLM. This is a real decision with reasons.**

The obvious temptation is to generate the recap line with an LLM. I recommend against it
for v1:

- **Latency.** The Bill appears at the emotional peak. A 1–3 s network round-trip to a
  model kills the beat.
- **Cost at scale.** One call per shift per room is a real bill for a game whose entire
  session is 4 minutes.
- **Offline and reliability.** A party game must never fail to show its punchline because
  an API is down.
- **Quality floor.** A templated line built from real event data is *always* coherent. A
  generated line occasionally isn't, and the failure is maximally visible.
- **It isn't needed.** The funny part is the *data* — "Rita dropped the soup. Three
  times." That is already true, specific, and attributable. The template only has to
  present it well.

Recommended implementation: ~40 hand-written verdict templates selected by shift profile
(grade × chaos peak × dominant failure type), interpolated with real player names and
counts. Deterministic, free, instant, offline. **An optional LLM "extra spicy verdict" can
be layered on later** if players ask for more variety, behind a toggle.

**Customer dialogue:** same answer — weighted random from a curated bank. No runtime LLM.

**Procedural disasters:** a seeded rule system driven by the Chaos tier, **not** machine
learning. Deterministic, debuggable, and testable (§7.2).

### 12.3 Explicitly not using AI for

Core simulation, game balance decisions, matchmaking, anti-cheat, real-time dialogue,
difficulty adjustment, and any player-facing generative content in v1. None of these have
a value case that beats the risk.

---

## 13. Development Roadmap

Each phase has an explicit **"must NOT change yet"** gate. These exist to prevent the most
common failure mode of small-team game development: rebuilding the foundation every phase.
Changing something behind a gate requires a written entry in `DECISIONS.md`.

---

### Phase 0 — Design Foundation ✅ *this document*

- **Objective:** lock product direction, scope, and technical approach before any code.
- **Deliverables:** this document; `DECISIONS.md`; updated `README.md`.
- **Dependencies:** none.
- **Verification:** written sign-off on the four open questions in §15.
- **Must NOT change yet:** everything — nothing exists to change.

---

### Phase 1 — Greybox Solo Prototype

- **Objective:** prove the loop is fun with **one** human, before spending anything on
  networking or art.
- **Features:** The Diner layout (greybox); 3 recipes; the Chaos meter with tiers 1–2;
  hold-to-progress interactions; 4-slot ticket rail; 240 s timer; scoring and grade; a
  stub Bill; keyboard input.
- **Deliverables:** a playable browser build; the `sim` package with unit tests; balance
  data tables.
- **Dependencies:** Phase 0 sign-off.
- **Verification:** `sim` unit tests green in CI; a human can complete a full shift;
  10 solo playtests, ≥ 6/10 rate the core cooking loop ≥ 7/10.
- **Must NOT change yet:** no networking code of any kind, no art beyond readable
  placeholders, no progression, no online anything. **No second kitchen, no fourth recipe.**

---

### Phase 2 — Core Fun

- **Objective:** make it funny. This is the highest-risk phase and the one worth spending
  the most time on.
- **Features:** 4th recipe; Full Chaos tier with 3 disasters; the Rush button;
  anticipation telegraphs; two-person carries; ping system; dirty pans and cleaning loop;
  The Bill v1 with real event attribution; the share card; juice pass (ding, stamp, coins,
  combo).
- **Deliverables:** a build that produces laughs reliably; a balance report from headless
  sweeps.
- **Dependencies:** Phase 1.
- **Verification:** **the §6.4 MVP criteria**, in particular criterion 3 (players
  voluntarily trigger Rush ≥ twice). Headless sweep confirms no dominant safe strategy and
  no dominant greedy strategy.
- **Must NOT change yet:** still no networking, no progression beyond the 5 MVP
  achievements, no second kitchen.

---

### Phase 3 — Multiplayer

- **Objective:** get 2–4 real players into the same kitchen over the internet without
  breaking the feel established in Phase 2.
- **Features:** authoritative server at 20 Hz; room codes and link join; client
  prediction and snapshot interpolation; input buffering; disconnect handling and host
  migration; 2–4 players verified.
- **Deliverables:** a publicly joinable build; a latency test report; a headless parity
  test (server sim vs. client sim produce identical state).
- **Dependencies:** Phase 2 — **the fun must be proven before this**.
- **Verification:** 4 players complete a full shift on a 150 ms link with no visible
  desync; parity test passes over 200 simulated rounds; a dropped host does not destroy
  the room; a bot-driven soak test of 50 concurrent rooms runs clean.
- **Must NOT change yet:** no progression systems, no new kitchens, no new recipes.
  **Gameplay feel is frozen except for network-induced fixes.**

---

### Phase 4 — Progression and Content

- **Objective:** give players a reason to come back tomorrow, without a content treadmill.
- **Features:** recipes 5+ and the Mystery Special; kitchens 2 and 3; cosmetics; weekly
  challenge modifiers; achievements; The Bill history; mid-shift join.
- **Deliverables:** a content-complete v1.0 feature set; an unlock-pacing report.
- **Dependencies:** Phase 3.
- **Verification:** first kitchen unlock within ~3 hours of play, measured; headless
  balance sweep across all kitchens and recipes; no recipe is strictly dominated.
- **Must NOT change yet:** core Chaos values, scoring formula, and shift length are
  locked. Content may be added; the systems may not be retuned without a decision entry.

---

### Phase 5 — Art and Audio Identity

- **Objective:** replace placeholders with the real "Diner Cartoon" identity.
- **Features:** full character and kitchen art; all animation priorities from §10.5;
  layered music system; full SFX set; the ding, properly produced.
- **Deliverables:** a shippable-looking build; an art bible; an audio asset list.
- **Dependencies:** Phase 4 (content complete, so art is made once).
- **Verification:** readability test at 720p and on a 6" phone; **colourblind simulation
  pass across all three deficiency types**; a blind test where a new player can identify
  every station and food state without instruction.
- **Must NOT change yet:** no gameplay or balance changes. Art serves the design, not the
  reverse.

---

### Phase 6 — Testing, Balance, Accessibility

- **Objective:** make it robust and playable by everyone in the target audience.
- **Features:** input remapping; screen-reader-friendly menus; subtitles for audio cues;
  motion-reduction option; localisation; full bug burn-down; balance telemetry.
- **Deliverables:** an accessibility statement; a release candidate.
- **Dependencies:** Phase 5.
- **Verification:** accessibility checklist signed off; crash-free session rate > 99.5% in
  a closed beta; a 50-player beta with telemetry showing median session ≥ 3 shifts.
- **Must NOT change yet:** no new content. Freeze and fix.

---

### Phase 7 — Deployment

- **Objective:** put it in front of real players and keep it up.
- **Features:** hosting and autoscaling; analytics; the share-card pipeline; soft launch;
  storefront or portal listing; desktop wrapper if warranted.
- **Deliverables:** a live public build; an ops runbook; a launch plan.
- **Dependencies:** Phase 6.
- **Verification:** 100 concurrent rooms stable; p95 join time < 10 s; cost per 1,000
  sessions within budget; D1 and D7 retention measured against a pre-registered target.
- **Must NOT change yet:** no feature work during launch window.

---

### Sequencing rationale

The order is deliberate and each dependency is a risk-reduction step:

1. **Playable prototype before fun tuning** — don't tune what isn't proven.
2. **Fun before multiplayer** — networking is a multiplier on fun; it multiplies zero.
3. **Multiplayer before progression** — retention systems are pointless if the core loop
   doesn't hold.
4. **Progression before art** — so art is made once, for final content.
5. **Polish and testing after content freeze** — so the work isn't thrown away.

---

## 14. Major Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **Name collision.** "Chaos Kitchen" is already a live Roblox title ([published March 2026](https://www.reddit.com/r/roblox/comments/1ro4x4r/my_first_roblox_game_chaos_kitchen/)), and the name is generic enough that others likely use it. | **High** | Medium | **Action required before Phase 1.** Run a trademark search in target territories and an app/store name search. Options: keep the name with a distinctive subtitle and mark, or rename. **This document deliberately does not treat the name as clear**, because it is not verified to be. |
| **R2** | **Platform bet.** Web-first forecloses a cheap console/Steam path. | Medium | High | Engine-agnostic sim and data-driven content make a Godot/Unity port a client rewrite, not a redesign (§11.5). Revisit the decision at the Phase 4 gate with real playtest data. |
| **R3** | **Fun depends on the group.** Solo and mismatched-skill groups may find it flat — a documented weakness across the genre. | Medium | High | Solo is explicitly a practice mode (§3); low-skill players always have scoring work (§5.6); bots fill empty slots from Phase 3. |
| **R4** | **The Chaos dial is ignored.** If players never voluntarily raise Chaos, the USP is dead and we have a generic cooking game. | Medium | **Critical** | This is MVP criterion 3 (§6.4) and a hard go/no-go at the Phase 2 gate. If it fails, the fix is to raise the multiplier and lower the punishment — not to add features. |
| **R5** | **Chaos reads as punishment, not reward.** The genre's documented complaint is stress and blame. | Medium | High | Generous decay, soft failure (§5.12), telegraphed disasters (§5.8), and comedic framing of mistakes (§7.1). Test with mixed-skill groups specifically. |
| **R6** | **Latency ruins co-op feel.** | Medium | High | Hold-to-progress design is inherently latency-tolerant (§8.4); validate at 150 ms in Phase 3 before locking the tick rate. |
| **R7** | **Content treadmill.** Players expect new kitchens forever; a small team cannot supply them. | High | Medium | Invest in modifiers and playstyle variation, which cost almost nothing (§7.6). Set the expectation of 3 kitchens, not 30. |
| **R8** | **Scope creep.** The genre invites "just one more station." | High | High | The MVP list (§6) and the per-phase "must NOT change yet" gates. Every addition requires a removal. |
| **R9** | **Genre comparison.** Players will say "it's Overcooked." | High | Medium | Accept it and use it. Marketing leans on the twist: chaos pays, and the game keeps score of who caused it. Do not fight the comparison; do not copy the assets. |
| **R10** | **Solo play feels like a compromise.** | High | Low | Accepted deliberately (§3, tertiary audience). Do not spend against it. |

---

## 15. Recommended Next Step

### Immediate action, before any code

**1. Resolve the name (blocking, ~1 day).**
Run a trademark and marketplace search for "Chaos Kitchen" in the target territories. A
collision already exists on Roblox (R1). Decide: keep with a distinctive subtitle/mark, or
rename. This is cheap now and expensive after art, audio, and a storefront exist.

**2. Get sign-off on four gating decisions.**
These change the shape of Phase 1 and are the only genuinely uncertain items in this
document. They are put to you in the accompanying questions:

| # | Decision | My recommendation | Why it's uncertain |
|---|---|---|---|
| A | **Distribution priority** | Browser-first, link-join | If Steam/console is the real commercial goal, Godot or Unity is the better long-term bet (§11.3) and we should switch *now*, not at Phase 4 |
| B | **Team size and technical comfort** | Assumed 1–3 people, TypeScript-comfortable | A C#-only or artist-led team changes the stack recommendation entirely |
| C | **2D vs. 3D** | 2D top-down | 3D is the genre norm and some audiences expect it; 2D is cheaper and more distinct, but it is a real audience-expectation bet |
| D | **Monetisation intent** | One-time purchase or free + cosmetics, decided at Phase 7 | Only matters that it must not leak into MVP design |

**3. Then start Phase 1 — greybox solo prototype.**
Concretely, the first deliverable is the `sim` package: the game state model, the Chaos
meter, three recipes, and a headless test suite — with a minimal renderer attached so a
human can actually play it. Nothing else. No art, no networking, no progression.

**The Phase 1 gate is a single question: is standing in this kitchen fun for four minutes
with no art, no sound, and no other players?** If it isn't, nothing downstream will save
it, and we find that out in weeks rather than months.

---

## Appendix A — Design principles (the tie-breakers)

When a later phase presents a choice this document didn't anticipate, resolve it with
these, in order:

1. **Is it funny?** A mechanic that isn't funny doesn't ship, even if it's deep.
2. **Can a non-gamer do it in 30 seconds?** If not, simplify it.
3. **Does failure produce a story?** If failure is invisible, it's wasted.
4. **Does it create a conversation between players?** Solo-optimal mechanics are suspect.
5. **Is it cheap?** Prefer modifiers and data over new art and new systems.
6. **Is it fair?** Every punishment must be telegraphed.
7. **Is it readable?** Silhouette first, colour second, never colour alone.

## Appendix B — Glossary

| Term | Meaning |
|---|---|
| **Shift** | One 240-second round of play |
| **Chaos** | Team-wide 0–100 meter driving disasters and the score multiplier |
| **Rush** | The player-triggered 10 s speed boost costing +25 Chaos |
| **The Bill** | The end-of-shift recap receipt and share card |
| **The Pass** | The single-slot serving window |
| **Tier 1/2/3 events** | Causal / reactive / set-piece disasters (§7.2) |
| **Special** | A one-off guest recipe that can be permanently unlocked |
| **Full Chaos** | The 76–100 tier, where kitchen-wide set pieces fire |
