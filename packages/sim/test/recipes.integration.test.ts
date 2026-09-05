import { describe, expect, it } from 'vitest';
import { createShift, itemAtStation, step } from '../src/sim.js';
import { DT, type Order, type SimState } from '../src/types.js';
import { RECIPES } from '../src/data/recipes.js';

/**
 * Pins a specific ticket on the rail.
 *
 * Serving requires a matching OPEN order — which is correct game behaviour (you cannot
 * serve a dish nobody ordered). The rail otherwise spawns at random, so a deterministic
 * recipe test must place the ticket it intends to fill.
 */
function withTicket(recipeId: string) {
  return (s: SimState): SimState => {
    const r = RECIPES[recipeId]!;
    const order: Order = {
      id: s.nextOrderId,
      recipeId,
      remainSec: 999,
      totalSec: 999,
      status: 'open',
      awarded: 0,
    };
    return { ...s, nextOrderId: s.nextOrderId + 1, orders: [order, ...s.orders] };
  };
}
import { Bot, frameFor } from './bot.js';

/**
 * These are the tests that matter most in Phase 1.
 *
 * Unit tests prove individual rules. These prove the rules COMPOSE: that a player can
 * actually walk a recipe from crate to pass using nothing but the three inputs the design
 * allows. If the interaction table in sim.ts has a hole, these fail.
 */

function run(
  tasks: ConstructorParameters<typeof Bot>[1],
  seconds = 200,
  seed = 21,
  mutate?: (s: SimState) => SimState,
) {
  let s = createShift({ seed, playerCount: 1 });
  if (mutate) s = mutate(s);
  const bot = new Bot(0, tasks);
  const frames = seconds * 50;
  for (let i = 0; i < frames && s.phase === 'playing' && !bot.finished; i++) {
    s = step(s, frameFor([bot], s), DT);
  }
  return { s, bot };
}

const holds = (s: SimState) => s.players[0]!.held !== null;
const empty = (s: SimState) => s.players[0]!.held === null;
const plateAt = (s: SimState, id: string) => itemAtStation(s, id);
const defAt = (s: SimState, id: string) => itemAtStation(s, id)?.def;
const cookAt = (s: SimState, id: string) => itemAtStation(s, id)?.cookState;

describe('Panic Burger — full crate-to-pass loop', () => {
  // Note: chopped/prepared items stay on the counter they were made on, so there is no
  // "pick it up" step between chopping and ferrying it to the plate.
  const { s, bot } = run([
    { station: 'crate_bun', done: holds },
    { station: 'counter_1', done: empty },
    { station: 'crate_patty', done: holds },
    { station: 'grill_1', done: empty },
    { station: 'grill_1', act: false, done: (st) => cookAt(st, 'grill_1') === 'cooked', timeoutSec: 15 },
    { station: 'grill_1', done: holds },
    { station: 'counter_2', done: empty },
    { station: 'crate_lettuce', done: holds },
    { station: 'counter_3', done: empty },
    { station: 'counter_3', done: (st) => defAt(st, 'counter_3') === 'lettuce_chopped', timeoutSec: 5 },
    { station: 'plates', done: holds },
    { station: 'plating_1', done: empty },
    { station: 'counter_1', done: holds },
    { station: 'plating_1', done: (st) => plateAt(st, 'plating_1')?.components.includes('bun') ?? false, timeoutSec: 5 },
    { station: 'counter_2', done: holds },
    { station: 'plating_1', done: (st) => plateAt(st, 'plating_1')?.components.includes('patty') ?? false, timeoutSec: 5 },
    { station: 'counter_3', done: holds },
    { station: 'plating_1', done: (st) => plateAt(st, 'plating_1')?.components.includes('lettuce') ?? false, timeoutSec: 5 },
    { station: 'plating_1', done: holds },
    { station: 'pass', done: (st) => st.served >= 1, timeoutSec: 10 },
  ], 200, 21, withTicket('panic_burger'));

  it('completes every task in the script', () => {
    expect(bot.finished).toBe(true);
  });

  it('grills the patty without burning it', () => {
    expect(s.stats[0]!.burnt).toBe(0);
  });

  it('serves exactly one order', () => {
    expect(s.served).toBe(1);
  });

  it('awards revenue and records the serve as an attributed event', () => {
    expect(s.revenue).toBeGreaterThan(0);
    expect(s.stats[0]!.revenue).toBe(s.revenue);
    const ev = s.events.find((e) => e.kind === 'serve_correct');
    expect(ev).toBeDefined();
    expect(ev!.playerId).toBe(0);
    expect(ev!.detail).toContain('panic_burger');
  });

  it('records the serve as a chaos reduction (or neutral when already calm)', () => {
    const ev = s.events.find((e) => e.kind === 'serve_correct');
    // Chaos is clamped at 0, so a serve from a calm kitchen cannot go negative.
    expect(ev!.chaos).toBeLessThanOrEqual(0);
  });

  it('dirties the pan it used', () => {
    expect(s.dirty['grill_1']).toBeGreaterThan(0);
    expect(s.pansDirty).toBeGreaterThan(0);
  });
});

describe('Doom Fries — the two-step recipe (slice, then fry)', () => {
  const { s, bot } = run([
    { station: 'crate_potato', done: holds },
    { station: 'counter_1', done: empty },
    { station: 'counter_1', done: (st) => defAt(st, 'counter_1') === 'potato_sliced', timeoutSec: 5 },
    { station: 'counter_1', done: holds },
    { station: 'fryer_1', done: empty },
    { station: 'fryer_1', act: false, done: (st) => cookAt(st, 'fryer_1') === 'cooked', timeoutSec: 15 },
    { station: 'fryer_1', done: holds },
    { station: 'counter_2', done: empty },
    { station: 'plates', done: holds },
    { station: 'plating_1', done: empty },
    { station: 'counter_2', done: holds },
    { station: 'plating_1', done: (st) => plateAt(st, 'plating_1')?.components.includes('fries') ?? false, timeoutSec: 5 },
    { station: 'plating_1', done: holds },
    { station: 'pass', done: (st) => st.served >= 1, timeoutSec: 10 },
  ], 200, 22, withTicket('doom_fries'));

  it('slices, fries, plates and serves', () => {
    expect(bot.finished).toBe(true);
    expect(s.served).toBe(1);
    const ev = s.events.find((e) => e.kind === 'serve_correct');
    expect(ev!.detail).toContain('doom_fries');
  });
});

describe('Suspicious Soup — pot cooking and boil-over', () => {
  it('cooks chopped tomato into soup on the pot', () => {
    let s = createShift({ seed: 31, playerCount: 1 });
    // Place chopped tomato directly on pot_1 to isolate the cooking rule.
    const it = { id: s.nextItemId++, def: 'tomato_chopped', heat: 0, cookState: 'raw' as const, components: [], prep: 0, atStation: 'pot_1', placedBy: 0 };
    s = { ...s, items: [...s.items, it] };
    for (let i = 0; i < 6 * 50; i++) s = step(s, {}, DT);
    expect(s.items.find((x) => x.id === it.id)?.cookState).toBe('cooked');
  });

  it('boils over into a mess if left too long, and attributes it', () => {
    let s = createShift({ seed: 32, playerCount: 1 });
    const it = { id: s.nextItemId++, def: 'tomato_chopped', heat: 0, cookState: 'raw' as const, components: [], prep: 0, atStation: 'pot_2', placedBy: 0 };
    s = { ...s, items: [...s.items, it] };
    for (let i = 0; i < 11 * 50; i++) s = step(s, {}, DT);
    const ev = s.events.find((e) => e.kind === 'boil_over');
    expect(ev).toBeDefined();
    expect(ev!.playerId).toBe(0);
    expect(ev!.chaos).toBeGreaterThan(0);
    expect(s.dirty['pot_2']).toBeGreaterThan(0);
  });
});

describe('burning is attributed to whoever left it on the heat', () => {
  it('names the culprit and increments their stat', () => {
    let s = createShift({ seed: 33, playerCount: 2 });
    const it = { id: s.nextItemId++, def: 'patty', heat: 0, cookState: 'raw' as const, components: [], prep: 0, atStation: 'grill_2', placedBy: 1 };
    s = { ...s, items: [...s.items, it] };
    for (let i = 0; i < 7 * 50; i++) s = step(s, {}, DT);
    const ev = s.events.find((e) => e.kind === 'burn');
    expect(ev).toBeDefined();
    // "Who burned the food?" must have an answer.
    expect(ev!.playerId).toBe(1);
    expect(ev!.detail).toContain('grill_2');
    expect(s.stats[1]!.burnt).toBe(1);
    expect(s.items.find((x) => x.id === it.id)?.cookState).toBe('burnt');
  });

  it('does not re-trigger the burn every tick', () => {
    let s = createShift({ seed: 34, playerCount: 1 });
    const it = { id: s.nextItemId++, def: 'patty', heat: 0, cookState: 'raw' as const, components: [], prep: 0, atStation: 'grill_1', placedBy: 0 };
    s = { ...s, items: [...s.items, it] };
    for (let i = 0; i < 20 * 50; i++) s = step(s, {}, DT);
    expect(s.events.filter((e) => e.kind === 'burn')).toHaveLength(1);
  });
});
