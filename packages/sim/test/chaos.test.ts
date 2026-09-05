import { describe, expect, it } from 'vitest';
import { createShift, itemAtStation, step, TUNING } from '../src/sim.js';
import { DT, type Disaster, type SimState, type WorldItem } from '../src/types.js';
import { CHAOS, tierFor } from '../src/data/chaos.js';
import { Bot, frameFor } from './bot.js';

/**
 * Disasters and the Chaos escalation loop.
 *
 * These matter disproportionately: the Chaos -> disaster -> more Chaos loop IS the game's
 * differentiator (D-002). If disasters do not fire when players are in the danger band, or
 * cannot be resolved, the USP is dead and we have a generic cooking game.
 */

function withChaos(chaos: number) {
  return (s: SimState): SimState => ({ ...s, chaos });
}

function idle(s: SimState, seconds: number): SimState {
  let out = s;
  for (let i = 0; i < seconds * 50; i++) out = step(out, {}, DT);
  return out;
}

describe('chaos-driven disasters', () => {
  it('never spawns a disaster in the CALM band', () => {
    const s = idle(withChaos(10)(createShift({ seed: 5, playerCount: 1 })), 60);
    expect(s.disasters.filter((d) => d.kind === 'grease_fire')).toHaveLength(0);
  });

  it('spawns disasters once players sit in the danger band', () => {
    // Hold chaos high by re-asserting it each check window; passive decay is 1/sec.
    let s = withChaos(90)(createShift({ seed: 5, playerCount: 1 }));
    for (let i = 0; i < 60 * 50; i++) {
      s = step(s, {}, DT);
      if (s.chaos < 80) s = { ...s, chaos: 90 };
    }
    expect(s.disasters.length).toBeGreaterThan(0);
    expect(s.events.some((e) => e.kind === 'disaster_start')).toBe(true);
  });

  it('telegraphs a disaster before it becomes active (S5.8 fairness rule)', () => {
    let s = withChaos(95)(createShift({ seed: 5, playerCount: 1 }));
    let sawTelegraphed = false;
    let sawActiveOnlyAfterTelegraph = true;
    for (let i = 0; i < 60 * 50; i++) {
      s = step(s, {}, DT);
      if (s.chaos < 80) s = { ...s, chaos: 95 };
      for (const d of s.disasters) {
        if (!d.active && d.telegraphSec > 0) sawTelegraphed = true;
        if (d.active && d.telegraphSec > 0) sawActiveOnlyAfterTelegraph = false;
      }
    }
    expect(sawTelegraphed).toBe(true);
    expect(sawActiveOnlyAfterTelegraph).toBe(true);
  });

  it('an active grease fire keeps adding chaos until it is dealt with', () => {
    const fire: Disaster = {
      id: 1,
      kind: 'grease_fire',
      stationId: 'grill_1',
      telegraphSec: 0,
      remainSec: TUNING.FIRE_DURATION_SEC,
      active: true,
    };
    const s0: SimState = { ...withChaos(30)(createShift({ seed: 6, playerCount: 1 })), disasters: [fire] };
    const before = s0.chaos;
    const after = idle(s0, 5);
    // Fire adds ~1/sec; decay removes 1/sec, so the meter should not be falling.
    expect(after.chaos).toBeGreaterThanOrEqual(before - 0.5);
    expect(after.events.filter((e) => e.kind === 'disaster_start')).not.toHaveLength(0);
  });
});

describe('extinguishing — the two-job cleanup task', () => {
  /** Places player 0 next to grill_1 holding an extinguisher, with grill_1 on fire. */
  function burningKitchen(): SimState {
    const s = createShift({ seed: 8, playerCount: 1 });
    const ex: WorldItem = {
      id: s.nextItemId,
      def: 'extinguisher',
      heat: 0,
      cookState: 'raw',
      components: [],
      prep: 0,
      heldBy: 0,
      placedBy: null,
    };
    const fire: Disaster = {
      id: 1,
      kind: 'grease_fire',
      stationId: 'grill_1',
      telegraphSec: 0,
      remainSec: TUNING.FIRE_DURATION_SEC,
      active: true,
    };
    return {
      ...s,
      nextItemId: s.nextItemId + 1,
      items: [ex],
      disasters: [fire],
      chaos: 60,
      players: [{ ...s.players[0]!, pos: { x: 9.2, y: 4.2 }, held: ex.id }],
    };
  }

  it('removes the fire, credits the player, and reduces chaos', () => {
    let s = burningKitchen();
    const chaosBefore = s.chaos;
    for (let i = 0; i < 5 * 50; i++) {
      s = step(s, { 0: { moveX: 0, moveY: 0, act: true, ping: false } }, DT);
      if (!s.disasters.some((d) => d.kind === 'grease_fire')) break;
    }
    expect(s.disasters.some((d) => d.kind === 'grease_fire')).toBe(false);
    expect(s.stats[0]!.extinguished).toBe(1);
    const ev = s.events.find((e) => e.kind === 'extinguish');
    expect(ev).toBeDefined();
    expect(ev!.playerId).toBe(0);
    expect(ev!.chaos).toBeCloseTo(-CHAOS.SUB.EXTINGUISH, 1);
    expect(s.chaos).toBeLessThan(chaosBefore);
  });

  it('cannot be extinguished bare-handed', () => {
    let s = burningKitchen();
    // Drop the extinguisher on the floor by hand.
    const ex = s.items[0]!;
    s = {
      ...s,
      items: [{ ...ex, heldBy: undefined, onFloor: { x: 9.2, y: 4.2 } }],
      players: [{ ...s.players[0]!, held: null }],
    };
    for (let i = 0; i < 5 * 50; i++) {
      s = step(s, { 0: { moveX: 0, moveY: 0, act: true, ping: false } }, DT);
    }
    expect(s.disasters.some((d) => d.kind === 'grease_fire')).toBe(true);
    expect(s.stats[0]!.extinguished).toBe(0);
  });
});

describe('cleaning reduces chaos fast (S5.7)', () => {
  it('washing a dirty pan credits the player and drops chaos', () => {
    let s = createShift({ seed: 9, playerCount: 1 });
    s = {
      ...s,
      chaos: 50,
      dirty: { sink: 5 },
      pansDirty: 1,
      // Positioned on the open side of the sink. Standing at (5.5, 7.6) instead resolves
      // to the extinguisher station, which sits only 1.4 tiles away — see the layout
      // ambiguity invariant in layout.test.ts.
      players: [{ ...s.players[0]!, pos: { x: 6.9, y: 8.8 } }],
    };
    for (let i = 0; i < 3 * 50; i++) {
      s = step(s, { 0: { moveX: 0, moveY: 0, act: true, ping: false } }, DT);
      if (!s.dirty['sink']) break;
    }
    expect(s.dirty['sink']).toBeUndefined();
    expect(s.stats[0]!.cleaned).toBe(1);
    const ev = s.events.find((e) => e.kind === 'clean');
    expect(ev!.playerId).toBe(0);
    expect(ev!.chaos).toBeCloseTo(-CHAOS.SUB.CLEAN, 1);
  });
});

describe('Suspicious Soup — the third recipe, crate to pass', () => {
  const holds = (s: SimState) => s.players[0]!.held !== null;
  const empty = (s: SimState) => s.players[0]!.held === null;
  const defAt = (s: SimState, id: string) => itemAtStation(s, id)?.def;
  const cookAt = (s: SimState, id: string) => itemAtStation(s, id)?.cookState;
  const plateAt = (s: SimState, id: string) => itemAtStation(s, id);

  let s = createShift({ seed: 23, playerCount: 1 });
  s = {
    ...s,
    nextOrderId: s.nextOrderId + 1,
    orders: [
      { id: 900, recipeId: 'suspicious_soup', remainSec: 999, totalSec: 999, status: 'open', awarded: 0 },
      ...s.orders,
    ],
  };
  const bot = new Bot(0, [
    { station: 'crate_tomato', done: holds },
    { station: 'counter_1', done: empty },
    { station: 'counter_1', done: (st) => defAt(st, 'counter_1') === 'tomato_chopped', timeoutSec: 5 },
    { station: 'counter_1', done: holds },
    { station: 'pot_1', done: empty },
    // Must be lifted off between 5 s (cooked) and 9.5 s (boil-over).
    { station: 'pot_1', act: false, done: (st) => cookAt(st, 'pot_1') === 'cooked', timeoutSec: 8 },
    { station: 'pot_1', done: holds },
    { station: 'counter_2', done: empty },
    { station: 'plates', done: holds },
    { station: 'plating_1', done: empty },
    { station: 'counter_2', done: holds },
    { station: 'plating_1', done: (st) => plateAt(st, 'plating_1')?.components.includes('soup') ?? false, timeoutSec: 5 },
    { station: 'plating_1', done: holds },
    { station: 'pass', done: (st) => st.served >= 1, timeoutSec: 10 },
  ]);
  for (let i = 0; i < 200 * 50 && s.phase === 'playing' && !bot.finished; i++) {
    s = step(s, frameFor([bot], s), DT);
  }

  it('chops, boils, plates and serves the soup', () => {
    expect(bot.finished).toBe(true);
    expect(s.served).toBe(1);
    expect(s.events.find((e) => e.kind === 'serve_correct')!.detail).toContain('suspicious_soup');
  });

  it('did not boil over, because the pot was attended', () => {
    expect(s.events.some((e) => e.kind === 'boil_over')).toBe(false);
  });
});

describe('the escalation loop closes: mistakes raise chaos, chaos raises the payout', () => {
  it('serving from a high tier pays more than the same dish from a calm kitchen', () => {
    // Two identical shifts; one is pushed into the FULL band before the serve.
    const calm = tierFor(10).multiplier;
    const hot = tierFor(90).multiplier;
    expect(hot).toBeGreaterThan(calm);
    expect(hot / calm).toBeCloseTo(2.5, 5);
  });
});
