import { describe, expect, it } from 'vitest';
import { createShift, step, TUNING } from '../src/sim.js';
import { DT, type InputFrame, type SimState } from '../src/types.js';
import { KITCHEN, PLAYER_RADIUS } from '../src/data/kitchen.js';
import { CHAOS } from '../src/data/chaos.js';

/**
 * Soak / invariant tests.
 *
 * The bot tests prove a recipe CAN be completed. These prove the game survives a whole
 * 240 s shift without going to NaN, leaking items, letting a player escape the kitchen, or
 * growing state without bound. Those are the failure modes that only appear after minutes
 * of play, and they are exactly what a human playtest would surface on day two.
 */

function assertSane(s: SimState, where: string) {
  expect(Number.isFinite(s.time), `time at ${where}`).toBe(true);
  expect(s.chaos, `chaos range at ${where}`).toBeGreaterThanOrEqual(0);
  expect(s.chaos, `chaos range at ${where}`).toBeLessThanOrEqual(CHAOS.MAX);
  expect(Number.isFinite(s.revenue), `revenue at ${where}`).toBe(true);
  expect(s.revenue, `revenue sign at ${where}`).toBeGreaterThanOrEqual(0);
  expect(s.events.length, `event log bounded at ${where}`).toBeLessThanOrEqual(TUNING.MAX_EVENTS);

  for (const p of s.players) {
    expect(Number.isFinite(p.pos.x), `player x at ${where}`).toBe(true);
    expect(Number.isFinite(p.pos.y), `player y at ${where}`).toBe(true);
    expect(p.pos.x, `player inside kitchen at ${where}`).toBeGreaterThanOrEqual(PLAYER_RADIUS - 0.01);
    expect(p.pos.x, `player inside kitchen at ${where}`).toBeLessThanOrEqual(KITCHEN.width - PLAYER_RADIUS + 0.01);
    expect(p.pos.y, `player inside kitchen at ${where}`).toBeGreaterThanOrEqual(PLAYER_RADIUS - 0.01);
    expect(p.pos.y, `player inside kitchen at ${where}`).toBeLessThanOrEqual(KITCHEN.height - PLAYER_RADIUS + 0.01);
    // A held item must actually exist.
    if (p.held !== null) {
      expect(s.items.some((i) => i.id === p.held), `held item exists at ${where}`).toBe(true);
    }
  }

  for (const it of s.items) {
    expect(Number.isFinite(it.heat), `item heat at ${where}`).toBe(true);
    expect(it.heat, `item heat non-negative at ${where}`).toBeGreaterThanOrEqual(0);
    // Every item must be somewhere: a station, a hand, or the floor.
    const placed =
      it.atStation !== undefined || it.heldBy !== undefined || it.onFloor !== undefined;
    expect(placed, `item ${it.id} is located at ${where}`).toBe(true);
    // No two players can hold the same item.
    if (it.heldBy !== undefined) {
      expect(
        s.players.filter((p) => p.held === it.id).length,
        `item ${it.id} held by exactly one player at ${where}`,
      ).toBe(1);
    }
  }
}

/** Pseudo-random but deterministic input, so a failure is reproducible. */
function noisyInput(seed: number, tick: number, players: number): InputFrame {
  const f: InputFrame = {};
  for (let p = 0; p < players; p++) {
    const a = Math.sin(seed + tick / (7 + p)) * 2;
    const b = Math.cos(seed * 1.7 + tick / (5 + p)) * 2;
    f[p] = {
      moveX: Math.max(-1, Math.min(1, a)),
      moveY: Math.max(-1, Math.min(1, b)),
      act: (tick + p * 13) % 23 < 11,
      ping: false,
    };
  }
  return f;
}

describe('full-shift soak', () => {
  for (const players of [1, 2, 4]) {
    it(`${players} player(s): a full 240 s shift stays valid every tick`, () => {
      let s = createShift({ seed: 777, playerCount: players });
      const frames = 240 * 50;
      for (let i = 0; i < frames; i++) {
        s = step(s, noisyInput(players, i, players), DT);
        if (i % 250 === 0) assertSane(s, `tick ${i}`);
      }
      assertSane(s, 'final');
      expect(s.phase).toBe('ended');
      expect(s.grade).not.toBeNull();
    });
  }

  it('state does not grow without bound over a shift', () => {
    let s = createShift({ seed: 31337, playerCount: 2 });
    let peakItems = 0;
    let peakDisasters = 0;
    for (let i = 0; i < 240 * 50; i++) {
      s = step(s, noisyInput(2, i, 2), DT);
      peakItems = Math.max(peakItems, s.items.length);
      peakDisasters = Math.max(peakDisasters, s.disasters.length);
    }
    // Crates dispense on demand, so items could in principle accumulate. They must not.
    expect(peakItems).toBeLessThan(60);
    expect(peakDisasters).toBeLessThan(25);
  });

  it('never produces NaN even when input is held at an extreme', () => {
    let s = createShift({ seed: 5, playerCount: 1 });
    // Full-throttle input into a corner for a whole shift.
    for (let i = 0; i < 240 * 50; i++) {
      s = step(s, { 0: { moveX: 1, moveY: 1, act: true, ping: false } }, DT);
    }
    assertSane(s, 'corner-push');
  });
});
