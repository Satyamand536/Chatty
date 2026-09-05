/**
 * CHAOS KITCHEN — the simulation.
 *
 * CONTRACT (D-009): `step(state, inputs, dt)` is a pure function. It does not read the
 * clock, does not call Math.random(), and does not mutate its argument. Given the same
 * state, the same inputs, and the same dt, it always produces an identical next state.
 * That is what makes the game testable headlessly and shareable between server and client.
 *
 * Implementation note: we deep-clone (global structuredClone, available in Node 17+ and
 * all target browsers) at the top of `step` and mutate the clone. That is a
 * deliberate trade — it keeps the external contract pure and the code readable, at the
 * cost of a clone per tick. If profiling ever shows this dominating, the clone can be
 * replaced by structural sharing without changing any caller.
 */

import { CHAOS, tierFor, clampChaos } from './data/chaos.js';
import { ITEMS, BURN_WARNING_SEC, componentOf, isCookable, isPrepable, type StationKind } from './data/items.js';
import { RECIPES, matchRecipe } from './data/recipes.js';
import {
  KITCHEN,
  REACH,
  PLAYER_RADIUS,
  BASE_SPEED,
  type StationDef,
  type Vec2,
} from './data/kitchen.js';
import { DT, EMPTY_INPUT, type EventKind, type InputFrame, type SimState, type WorldItem, type Player, type Disaster } from './types.js';
import { createRng, nextFloat } from './rng.js';

// ---------------------------------------------------------------------------
// Balance data (kept here as a single tunable block, not scattered through logic)
// ---------------------------------------------------------------------------

export const TUNING = {
  /** Seconds of hold for each prep/interact action. */
  CHOP_SEC: 1.2,
  ASSEMBLE_SEC: 0.4,
  CLEAN_SEC: 1.0,
  EXTINGUISH_SEC: 1.2,
  RUSH_HOLD_SEC: 0.5,
  /** Ticket spawning: first ticket, then the interval shrinks as the shift progresses. */
  FIRST_ORDER_SEC: 3,
  ORDER_INTERVAL_START_SEC: 11,
  ORDER_INTERVAL_MIN_SEC: 6,
  /** Disaster scheduling. */
  DISASTER_CHECK_SEC: 4,
  /** Chance per check, by tier. */
  DISASTER_CHANCE: { CALM: 0, RATTLED: 0.18, ROWDY: 0.38, FULL: 0.6 },
  FIRE_CHAOS_PER_SEC: 1,
  FIRE_DURATION_SEC: 45,
  SLICK_DURATION_SEC: 12,
  SLICK_RADIUS: 1.1,
  SLICK_SLOW: 0.5,
  SLICK_DROP_CHANCE: 0.4,
  SLICK_SLOW_SEC: 2,
  /** Revenue target scales with player count. */
  REVENUE_TARGET_PER_PLAYER: 300,
  COMBO_STEP: 0.1,
  COMBO_CAP: 1.5,
  FRESHNESS_BONUS: 1.25,
  /**
   * Cap on the retained event log.
   *
   * Found by benchmarking, not by guessing: `step` deep-clones the whole state every tick,
   * so an unbounded event array makes each tick progressively slower across a 240 s shift.
   * The Bill does not need every event — it needs the aggregate stats (which live in
   * `stats`) plus a handful of headline moments. Keep a bounded recent window and let the
   * counters carry the totals.
   */
  MAX_EVENTS: 200,
} as const;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface CreateShiftOptions {
  playerCount?: number;
  seed?: number;
  shiftLengthSec?: number;
}

export function createShift(opts: CreateShiftOptions = {}): SimState {
  const playerCount = Math.max(1, Math.min(4, opts.playerCount ?? 1));
  const seed = createRng(opts.seed ?? 1234);

  const players: Player[] = [];
  const stats: SimState['stats'] = [];
  for (let i = 0; i < playerCount; i++) {
    const spawn = KITCHEN.spawns[i] ?? KITCHEN.spawns[0]!;
    players.push({
      id: i,
      pos: { x: spawn.x, y: spawn.y },
      held: null,
      action: null,
      slipSec: 0,
      stillSec: 0,
    });
    stats.push({
      playerId: i,
      served: 0,
      dropped: 0,
      burnt: 0,
      cleaned: 0,
      extinguished: 0,
      rushes: 0,
      revenue: 0,
    });
  }

  return {
    tick: 0,
    time: 0,
    shiftLengthSec: opts.shiftLengthSec ?? 240,
    phase: 'playing',
    seed,
    rng: seed,
    players,
    items: [],
    nextItemId: 1,
    orders: [],
    nextOrderId: 1,
    disasters: [],
    nextDisasterId: 1,
    dirty: {},
    pansTotal: KITCHEN.stations.filter((s) => s.dirties).length,
    pansDirty: 0,
    chaos: 0,
    rush: { active: false, remainSec: 0, cooldownSec: 0, startedBy: null },
    revenue: 0,
    combo: 0,
    served: 0,
    expired: 0,
    nextOrderInSec: TUNING.FIRST_ORDER_SEC,
    maxOrders: 4,
    disasterClockSec: 0,
    events: [],
    stats,
    grade: null,
  };
}

// ---------------------------------------------------------------------------
// Geometry / lookup helpers (pure)
// ---------------------------------------------------------------------------

const STATION_MAP: Record<string, StationDef> = Object.fromEntries(
  KITCHEN.stations.map((s) => [s.id, s as StationDef]),
);

export function stationById(id: string): StationDef | undefined {
  return STATION_MAP[id];
}

export function itemAtStation(s: SimState, stationId: string): WorldItem | undefined {
  return s.items.find((it) => it.atStation === stationId);
}

export function itemById(s: SimState, id: number): WorldItem | undefined {
  return s.items.find((it) => it.id === id);
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Nearest station within reach of a player. */
export function nearestStation(s: SimState, p: Player): StationDef | null {
  let best: StationDef | null = null;
  let bestD = REACH;
  for (const def of KITCHEN.stations) {
    const d = dist(p.pos, def.pos) - Math.max(def.half.x, def.half.y);
    if (d <= bestD) {
      bestD = d;
      best = def as StationDef;
    }
  }
  return best;
}

/** Circle-vs-AABB collision against stations and walls. */
function blocked(pos: Vec2): boolean {
  for (const def of KITCHEN.stations) {
    const dx = Math.abs(pos.x - def.pos.x);
    const dy = Math.abs(pos.y - def.pos.y);
    if (dx < def.half.x + PLAYER_RADIUS && dy < def.half.y + PLAYER_RADIUS) return true;
  }
  for (const w of KITCHEN.walls) {
    const dx = Math.abs(pos.x - w.x);
    const dy = Math.abs(pos.y - w.y);
    if (dx < w.half.x + PLAYER_RADIUS && dy < w.half.y + PLAYER_RADIUS) return true;
  }
  return false;
}

function inBounds(pos: Vec2): boolean {
  return (
    pos.x > PLAYER_RADIUS &&
    pos.x < KITCHEN.width - PLAYER_RADIUS &&
    pos.y > PLAYER_RADIUS &&
    pos.y < KITCHEN.height - PLAYER_RADIUS
  );
}

function clampInBounds(pos: Vec2): Vec2 {
  return {
    x: Math.max(PLAYER_RADIUS, Math.min(KITCHEN.width - PLAYER_RADIUS, pos.x)),
    y: Math.max(PLAYER_RADIUS, Math.min(KITCHEN.height - PLAYER_RADIUS, pos.y)),
  };
}

// ---------------------------------------------------------------------------
// Chaos bookkeeping — every delta goes through here so it is always attributed
// ---------------------------------------------------------------------------

/** Appends an event, keeping the log bounded (see TUNING.MAX_EVENTS). */
function pushEvent(s: SimState, e: SimState['events'][number]): void {
  s.events.push(e);
  if (s.events.length > TUNING.MAX_EVENTS) {
    s.events.splice(0, s.events.length - TUNING.MAX_EVENTS);
  }
}

function addChaos(
  s: SimState,
  delta: number,
  kind: EventKind,
  playerId: number | null,
  detail?: string,
): void {
  const before = s.chaos;
  s.chaos = clampChaos(s.chaos + delta);
  const applied = s.chaos - before;
  pushEvent(s, { tick: s.tick, time: s.time, kind, playerId, chaos: applied, detail });
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

export function step(prev: SimState, inputs: InputFrame, dt: number = DT): SimState {
  const s: SimState = structuredClone(prev);
  if (s.phase !== 'playing') return s;
  if (!Number.isFinite(dt) || dt <= 0) return s;

  s.tick += 1;
  s.time += dt;

  stepChaosDecay(s, dt);
  stepRush(s, dt);
  for (const p of s.players) stepPlayer(s, p, inputs[p.id] ?? EMPTY_INPUT, dt);
  resolveCollisions(s);
  stepCooking(s, dt);
  stepDirtyPans(s, dt);
  stepDisasters(s, dt);
  stepOrders(s, dt);
  maybeEndShift(s);

  return s;
}

function stepChaosDecay(s: SimState, dt: number): void {
  if (s.chaos > 0) s.chaos = clampChaos(s.chaos - CHAOS.DECAY_PER_SEC * dt);
}

function stepRush(s: SimState, dt: number): void {
  if (s.rush.cooldownSec > 0) s.rush.cooldownSec = Math.max(0, s.rush.cooldownSec - dt);
  if (!s.rush.active) return;
  s.rush.remainSec -= dt;
  addChaos(s, CHAOS.RUSH_PER_SEC * dt, 'rush_start', s.rush.startedBy, 'rush ticking');
  if (s.rush.remainSec <= 0) {
    s.rush.active = false;
    s.rush.remainSec = 0;
    s.rush.cooldownSec = CHAOS.RUSH_COOLDOWN_SEC;
  }
}

// --- movement + interaction -------------------------------------------------

function speedFor(s: SimState, p: Player): number {
  let v = BASE_SPEED;
  if (s.rush.active) v *= CHAOS.RUSH_MOVE_SPEED;
  if (p.slipSec > 0) v *= TUNING.SLICK_SLOW;
  return v;
}

function stepPlayer(s: SimState, p: Player, input: PlayerInputShim, dt: number): void {
  if (p.slipSec > 0) p.slipSec = Math.max(0, p.slipSec - dt);

  const mag = Math.hypot(input.moveX, input.moveY);
  const moving = mag > 0.01;
  if (moving) {
    const v = speedFor(s, p);
    const nx = p.pos.x + (input.moveX / mag) * v * dt;
    const ny = p.pos.y + (input.moveY / mag) * v * dt;
    // Axis-separated movement so players slide along counters instead of sticking.
    const tryX = clampInBounds({ x: nx, y: p.pos.y });
    if (inBounds(tryX) && !blocked(tryX)) p.pos = tryX;
    const tryY = clampInBounds({ x: p.pos.x, y: ny });
    if (inBounds(tryY) && !blocked(tryY)) p.pos = tryY;
    p.stillSec = 0;
  } else {
    p.stillSec += dt;
  }

  // Slick hazard: entering one slows you and may make you drop what you are carrying.
  for (const d of s.disasters) {
    if (d.kind !== 'oil_slick' || !d.active) continue;
    const st = d.stationId ? stationById(d.stationId) : undefined;
    const centre = st?.pos ?? { x: KITCHEN.width / 2, y: KITCHEN.height / 2 };
    if (dist(p.pos, centre) < TUNING.SLICK_RADIUS && p.slipSec <= 0) {
      p.slipSec = TUNING.SLICK_SLOW_SEC;
      if (p.held !== null) {
        const [r, next] = nextFloat(s.rng);
        s.rng = next;
        if (r < TUNING.SLICK_DROP_CHANCE) dropHeld(s, p, 'slipped on oil');
      }
    }
  }

  // Hold-to-progress actions.
  if (p.action) {
    const rate = s.rush.active ? CHAOS.RUSH_COOK_SPEED : 1;
    p.action.progress += (dt * rate) / p.action.durationSec;
    if (p.action.progress >= 1) completeAction(s, p);
    // Releasing the button cancels the action — the "hold" in hold-to-progress.
    if (!input.act) p.action = null;
    return;
  }

  if (input.act) beginAction(s, p);
}

type PlayerInputShim = { moveX: number; moveY: number; act: boolean; ping: boolean };

function dropHeld(s: SimState, p: Player, reason: string): void {
  if (p.held === null) return;
  const it = itemById(s, p.held);
  p.held = null;
  p.action = null;
  if (!it) return;
  it.heldBy = undefined;
  // §5.3: a dropped item splats and is destroyed, leaving a slick decal.
  s.items = s.items.filter((x) => x.id !== it.id);
  const st = s.stats[p.id];
  if (st) st.dropped += 1;
  addChaos(s, CHAOS.ADD.DROP, 'drop', p.id, `${it.def} (${reason})`);
  s.disasters.push({
    id: s.nextDisasterId++,
    kind: 'oil_slick',
    telegraphSec: 0,
    remainSec: TUNING.SLICK_DURATION_SEC,
    active: true,
  });
}

// --- interaction resolution -------------------------------------------------

function beginAction(s: SimState, p: Player): void {
  const target = nearestStation(s, p);
  if (!target) return;
  const held = p.held !== null ? itemById(s, p.held) : undefined;
  const onStation = itemAtStation(s, target.id);
  const isBurning = s.disasters.some(
    (d) => d.kind === 'grease_fire' && d.active && d.stationId === target.id,
  );

  // 1. Rush button — the designed betrayal engine (§5.10).
  if (target.kind === 'rush' && !held) {
    if (s.rush.active || s.rush.cooldownSec > 0) return;
    p.action = { kind: 'rush', stationId: target.id, progress: 0, durationSec: TUNING.RUSH_HOLD_SEC };
    return;
  }

  // 2. Extinguisher pickup.
  if (target.kind === 'extinguisher' && !held && !onStation) {
    const ex = spawnItem(s, 'extinguisher');
    ex.atStation = target.id;
    takeItem(s, p, ex);
    return;
  }

  // 3. Fire: needs the extinguisher in hand (§5.10 — firefighting is a two-job task).
  if (isBurning && held?.def === 'extinguisher') {
    p.action = { kind: 'extinguish', stationId: target.id, progress: 0, durationSec: TUNING.EXTINGUISH_SEC };
    return;
  }

  // 4. Sink: wash this station's pan.
  if (target.kind === 'sink' && s.dirty[target.id]) {
    p.action = { kind: 'clean', stationId: target.id, progress: 0, durationSec: TUNING.CLEAN_SEC };
    return;
  }

  // 5. Pass: serve a held plate.
  if (target.kind === 'pass' && held?.def === 'plate') {
    serve(s, p, held);
    return;
  }

  // 6. Bin: discard anything.
  if (target.kind === 'bin' && held) {
    s.items = s.items.filter((x) => x.id !== held.id);
    p.held = null;
    return;
  }

  // 7. Crates and the plate stack dispense instantly.
  if ((target.kind === 'crate' || target.dispenses) && !held && !onStation && target.dispenses) {
    const it = spawnItem(s, target.dispenses);
    it.atStation = target.id;
    takeItem(s, p, it);
    // Dispensers never empty — they restock immediately.
    return;
  }

  // 8. Chopping a prep ingredient sitting on a counter.
  if (
    target.kind === 'counter' &&
    onStation &&
    !held &&
    isPrepInput(onStation.def)
  ) {
    p.action = { kind: 'chop', stationId: target.id, progress: 0, durationSec: TUNING.CHOP_SEC };
    return;
  }

  // 9. Assembly: held component onto a plate at the plating station.
  if (target.kind === 'plating' && onStation?.def === 'plate' && held && isComponent(held)) {
    p.action = { kind: 'assemble', stationId: target.id, progress: 0, durationSec: TUNING.ASSEMBLE_SEC };
    return;
  }

  // 10. Placing an item onto a station.
  if (!onStation && held && canPlace(held, target.kind)) {
    place(s, p, held, target.id);
    return;
  }

  // 11. Picking up whatever is on the station.
  if (onStation && !held) {
    takeItem(s, p, onStation);
    return;
  }

  // 12. Putting down onto an empty counter.
  if (held && !onStation && target.kind === 'counter') {
    place(s, p, held, target.id);
  }
}

function isPrepInput(def: string): boolean {
  return isPrepable(def);
}

function isComponent(it: WorldItem): boolean {
  return componentOf(it.def, it.cookState) !== null;
}

function canPlace(it: WorldItem, kind: StationKind): boolean {
  const d = ITEMS[it.def];
  if (!d) return false;
  if (d.station === kind) return true;
  if (kind === 'counter') return true;
  if (kind === 'plating' && it.def === 'plate') return true;
  return false;
}

function spawnItem(s: SimState, def: string): WorldItem {
  const it: WorldItem = {
    id: s.nextItemId++,
    def,
    heat: 0,
    cookState: 'raw',
    components: [],
    prep: 0,
    placedBy: null,
  };
  s.items.push(it);
  return it;
}

function takeItem(s: SimState, p: Player, it: WorldItem): void {
  it.atStation = undefined;
  it.onFloor = undefined;
  it.heldBy = p.id;
  p.held = it.id;
}

function place(s: SimState, p: Player, it: WorldItem, stationId: string): void {
  it.atStation = stationId;
  it.heldBy = undefined;
  it.placedBy = p.id;
  p.held = null;
  p.action = null;
}

function completeAction(s: SimState, p: Player): void {
  const a = p.action;
  p.action = null;
  if (!a) return;
  const station = stationById(a.stationId);
  if (!station) return;

  switch (a.kind) {
    case 'rush': {
      s.rush.active = true;
      s.rush.remainSec = CHAOS.RUSH_DURATION_SEC;
      s.rush.startedBy = p.id;
      const st = s.stats[p.id];
      if (st) st.rushes += 1;
      addChaos(s, CHAOS.ADD.RUSH_INSTANT, 'rush_start', p.id, `${p.id} pressed RUSH`);
      return;
    }
    case 'chop': {
      const it = itemAtStation(s, a.stationId);
      if (!it) return;
      const d = ITEMS[it.def];
      if (!d?.prepsInto) return;
      const out = d.prepsInto;
      s.items = s.items.filter((x) => x.id !== it.id);
      const nu = spawnItem(s, out);
      nu.atStation = a.stationId;
      return;
    }
    case 'assemble': {
      const plate = itemAtStation(s, a.stationId);
      const held = p.held !== null ? itemById(s, p.held) : undefined;
      if (!plate || plate.def !== 'plate' || !held) return;
      const comp = componentOf(held.def, held.cookState);
      if (!comp) return;
      plate.components.push(comp);
      s.items = s.items.filter((x) => x.id !== held.id);
      p.held = null;
      return;
    }
    case 'clean': {
      if (!s.dirty[a.stationId]) return;
      delete s.dirty[a.stationId];
      s.pansDirty = Math.max(0, s.pansDirty - 1);
      const st = s.stats[p.id];
      if (st) st.cleaned += 1;
      addChaos(s, -CHAOS.SUB.CLEAN, 'clean', p.id, a.stationId);
      return;
    }
    case 'extinguish': {
      const idx = s.disasters.findIndex(
        (d) => d.kind === 'grease_fire' && d.stationId === a.stationId,
      );
      if (idx >= 0) s.disasters.splice(idx, 1);
      const st = s.stats[p.id];
      if (st) st.extinguished += 1;
      addChaos(s, -CHAOS.SUB.EXTINGUISH, 'extinguish', p.id, a.stationId);
      return;
    }
    case 'cook':
      // Cooking is continuous, not hold-driven (§5.4); nothing to complete here.
      return;
  }
}

// --- cooking ----------------------------------------------------------------

function stepCooking(s: SimState, dt: number): void {
  const cookRate = s.rush.active ? CHAOS.RUSH_COOK_SPEED : 1;

  for (const st of KITCHEN.stations) {
    const kind = st.kind as StationKind;
    if (kind !== 'grill' && kind !== 'pot' && kind !== 'fryer') continue;
    const it = itemAtStation(s, st.id);
    if (!it || it.cookState === 'burnt') continue;
    const d = ITEMS[it.def];
    if (!d || !isCookable(it.def)) continue;
    // Only the correct heat source cooks a given item.
    if (d.station !== kind) continue;

    it.heat += dt * cookRate;
    const cookedAt = d.cookedAtSec as number;
    const burntAt = d.burntAtSec as number;

    if (it.cookState === 'raw' && it.heat >= cookedAt) {
      it.cookState = 'cooked';
      // A finished pan is now a pan that needs washing (S5.7).
      if (st.dirties && !s.dirty[st.id]) {
        s.dirty[st.id] = 0.001;
        s.pansDirty += 1;
      }
    }

    if (it.heat >= burntAt) {
      it.cookState = 'burnt';
      it.components = [];
      it.heat = burntAt; // freeze, so a burnt item does not re-trigger every tick
      const culprit = typeof it.placedBy === 'number' ? it.placedBy : null;
      const ps = culprit !== null ? s.stats[culprit] : undefined;
      if (ps) ps.burnt += 1;
      addChaos(s, CHAOS.ADD.BURN, 'burn', culprit, `${it.def} on ${st.id}`);
      continue;
    }

    // Boil-over: an ignored pot makes a mess rather than simply failing (S5.4).
    if (typeof d.boilOverAtSec === 'number' && it.heat >= d.boilOverAtSec) {
      it.heat = cookedAt; // settle back so it does not spam
      if (!s.dirty[st.id]) {
        s.dirty[st.id] = 0.001;
        s.pansDirty += 1;
      }
      const culprit = typeof it.placedBy === 'number' ? it.placedBy : null;
      addChaos(s, CHAOS.ADD.BOIL_OVER, 'boil_over', culprit, st.id);
    }
  }
}

// --- dirty pans -------------------------------------------------------------

function stepDirtyPans(s: SimState, dt: number): void {
  for (const [id, age] of Object.entries(s.dirty)) {
    const next = age + dt;
    s.dirty[id] = next;
    if (next >= CHAOS.DIRTY_PAN_GRACE_SEC && age < CHAOS.DIRTY_PAN_GRACE_SEC) {
      addChaos(s, CHAOS.ADD.DIRTY_PAN_TIMEOUT, 'dirty_pan', null, id);
    }
  }
}

// --- disasters --------------------------------------------------------------

function stepDisasters(s: SimState, dt: number): void {
  // Advance telegraphs and lifetimes.
  for (const d of s.disasters) {
    if (!d.active) {
      d.telegraphSec -= dt;
      if (d.telegraphSec <= 0) {
        d.active = true;
        pushEvent(s, {
          tick: s.tick,
          time: s.time,
          kind: 'disaster_start',
          playerId: null,
          chaos: 0,
          detail: `${d.kind}${d.stationId ? `@${d.stationId}` : ''}`,
        });
      }
      continue;
    }
    d.remainSec -= dt;
    if (d.kind === 'grease_fire') {
      addChaos(s, TUNING.FIRE_CHAOS_PER_SEC * dt, 'disaster_start', null, `fire@${d.stationId}`);
    }
    if (d.kind === 'mouse_thief' && !d.resolved) {
      d.resolved = true;
      const candidates = s.items.filter(
        (it) => it.atStation && (stationById(it.atStation)?.kind === 'counter'),
      );
      if (candidates.length > 0) {
        const idx = Math.min(
          candidates.length - 1,
          Math.floor(nextFloat(s.rng)[0] * candidates.length),
        );
        const victim = candidates[idx]!;
        s.rng = nextFloat(s.rng)[1];
        s.items = s.items.filter((x) => x.id !== victim.id);
        addChaos(s, 2, 'mouse_steal', null, victim.def);
      }
    }
  }
  s.disasters = s.disasters.filter((d) => !d.active || d.remainSec > 0);

  // Spawn check on a fixed cadence, scaled by the tier the players chose to be in.
  s.disasterClockSec += dt;
  if (s.disasterClockSec < TUNING.DISASTER_CHECK_SEC) return;
  s.disasterClockSec = 0;

  const tier = tierFor(s.chaos);
  const chance = TUNING.DISASTER_CHANCE[tier.tier];
  if (chance <= 0) return;
  const [r, next] = nextFloat(s.rng);
  s.rng = next;
  if (r >= chance) return;
  spawnDisaster(s);
}

function spawnDisaster(s: SimState): void {
  const [r, next] = nextFloat(s.rng);
  s.rng = next;
  const roll = r;
  const heat = KITCHEN.stations.filter(
    (st) => (st.kind === 'grill' || st.kind === 'pot' || st.kind === 'fryer'),
  );
  const alreadyOnFire = new Set(
    s.disasters.filter((d) => d.kind === 'grease_fire').map((d) => d.stationId),
  );
  const freeHeat = heat.filter((h) => !alreadyOnFire.has(h.id));

  let kind: Disaster['kind'] = 'oil_slick';
  if (roll < 0.4 && freeHeat.length > 0) kind = 'grease_fire';
  else if (roll < 0.75) kind = 'oil_slick';
  else kind = 'mouse_thief';

  const d: Disaster = {
    id: s.nextDisasterId++,
    kind,
    telegraphSec: kind === 'grease_fire' ? 0.8 : kind === 'oil_slick' ? 0.5 : 0.7,
    remainSec:
      kind === 'grease_fire' ? TUNING.FIRE_DURATION_SEC : kind === 'oil_slick' ? TUNING.SLICK_DURATION_SEC : 3,
    active: false,
  };
  if (kind === 'grease_fire' && freeHeat.length > 0) {
    const [t, n2] = nextFloat(s.rng);
    s.rng = n2;
    d.stationId = freeHeat[Math.min(freeHeat.length - 1, Math.floor(t * freeHeat.length))]!.id;
  }
  s.disasters.push(d);
}

// --- orders -----------------------------------------------------------------

function stepOrders(s: SimState, dt: number): void {
  // Existing tickets tick down.
  for (const o of s.orders) {
    if (o.status !== 'open') continue;
    o.remainSec -= dt;
    if (o.remainSec <= 0) {
      o.status = 'expired';
      s.expired += 1;
      s.combo = 0;
      addChaos(s, CHAOS.ADD.TICKET_EXPIRE, 'ticket_expire', null, o.recipeId);
    }
  }
  s.orders = s.orders.filter((o) => o.status === 'open');

  // Spawn new tickets.
  s.nextOrderInSec -= dt;
  if (s.nextOrderInSec > 0) return;
  const open = s.orders.length;
  const interval = Math.max(
    TUNING.ORDER_INTERVAL_MIN_SEC,
    TUNING.ORDER_INTERVAL_START_SEC - (s.time / s.shiftLengthSec) * 5,
  );
  s.nextOrderInSec = interval;
  if (open >= s.maxOrders) return;

  const ids = Object.keys(RECIPES);
  const [r, next] = nextFloat(s.rng);
  s.rng = next;
  const recipeId = ids[Math.min(ids.length - 1, Math.floor(r * ids.length))] ?? ids[0]!;
  const recipe = RECIPES[recipeId]!;
  s.orders.push({
    id: s.nextOrderId++,
    recipeId: recipe.id,
    remainSec: recipe.ticketSec,
    totalSec: recipe.ticketSec,
    status: 'open',
    awarded: 0,
  });
}

// --- serving ----------------------------------------------------------------

function serve(s: SimState, p: Player, plate: WorldItem): void {
  const recipe = matchRecipe(plate.components);
  const open = s.orders.filter((o) => o.status === 'open');
  const order = recipe ? open.find((o) => o.recipeId === recipe.id) : undefined;

  // The plate leaves play either way (§5.6: a wrong plate is binned).
  s.items = s.items.filter((x) => x.id !== plate.id);
  p.held = null;

  if (!recipe || !order) {
    s.combo = 0;
    addChaos(s, CHAOS.ADD.WRONG_ORDER, 'serve_wrong', p.id, `[${plate.components.join(',')}]`);
    pushEvent(s, { tick: s.tick, time: s.time, kind: 'wrong_order', playerId: p.id, chaos: 0 });
    return;
  }

  order.status = 'served';
  const tier = tierFor(s.chaos);
  const freshness =
    order.remainSec / order.totalSec > 0.5 ? TUNING.FRESHNESS_BONUS : 1.0;
  const comboMul = Math.min(TUNING.COMBO_CAP, 1 + s.combo * TUNING.COMBO_STEP);
  const awarded = Math.round(recipe.basePrice * tier.multiplier * freshness * comboMul);

  order.awarded = awarded;
  s.revenue += awarded;
  s.served += 1;
  s.combo += 1;
  const st = s.stats[p.id];
  if (st) {
    st.served += 1;
    st.revenue += awarded;
  }
  addChaos(s, -CHAOS.SUB.CORRECT_SERVE, 'serve_correct', p.id, `${recipe.id} +${awarded}`);
  s.orders = s.orders.filter((o) => o.id !== order.id);
}

// --- player-vs-player collision ---------------------------------------------

function resolveCollisions(s: SimState): void {
  for (let i = 0; i < s.players.length; i++) {
    for (let j = i + 1; j < s.players.length; j++) {
      const a = s.players[i]!;
      const b = s.players[j]!;
      const d = dist(a.pos, b.pos);
      const min = PLAYER_RADIUS * 2;
      if (d >= min || d === 0) continue;
      // Soft push apart — no stun (§5.1).
      const push = (min - d) / 2;
      const ux = (b.pos.x - a.pos.x) / d;
      const uy = (b.pos.y - a.pos.y) / d;
      const na = clampInBounds({ x: a.pos.x - ux * push, y: a.pos.y - uy * push });
      const nb = clampInBounds({ x: b.pos.x + ux * push, y: b.pos.y + uy * push });
      if (!blocked(na)) a.pos = na;
      if (!blocked(nb)) b.pos = nb;
      // Bumping is cheap; constant bumping is not (§5.1).
      if (a.stillSec < 0.1 && b.stillSec < 0.1) {
        addChaos(s, CHAOS.ADD.COLLISION, 'collision', a.id, `bumped ${b.id}`);
      }
    }
  }
}

// --- end of shift -----------------------------------------------------------

function maybeEndShift(s: SimState): void {
  if (s.time < s.shiftLengthSec) return;
  s.phase = 'ended';
  s.grade = gradeFor(s.revenue, s.players.length);
  pushEvent(s, {
    tick: s.tick,
    time: s.time,
    kind: 'shift_end',
    playerId: null,
    chaos: 0,
    detail: `revenue=${s.revenue} grade=${s.grade}`,
  });
}

export function gradeFor(revenue: number, playerCount: number): string {
  const target = TUNING.REVENUE_TARGET_PER_PLAYER * playerCount;
  const r = revenue / target;
  if (r >= 1.5) return 'S';
  if (r >= 1.0) return 'A';
  if (r >= 0.75) return 'B';
  if (r >= 0.5) return 'C';
  return 'D';
}

/** Convenience: run a whole shift with a scripted input provider. */
export function runShift(
  opts: CreateShiftOptions & {
    frames: number;
    inputFor?: (s: SimState, tick: number) => InputFrame;
  },
): SimState {
  let s = createShift(opts);
  for (let i = 0; i < opts.frames && s.phase === 'playing'; i++) {
    s = step(s, opts.inputFor ? opts.inputFor(s, i) : {}, DT);
  }
  return s;
}

export { BURN_WARNING_SEC };
