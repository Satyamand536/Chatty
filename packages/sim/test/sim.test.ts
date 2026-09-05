import { describe, expect, it } from 'vitest';
import {
  createShift,
  step,
  runShift,
  gradeFor,
  TUNING,
} from '../src/sim.js';
import { DT, type InputFrame } from '../src/types.js';
import { CHAOS, TIERS, tierFor } from '../src/data/chaos.js';

/** Runs `n` ticks with no input at all. */
function idle(state: ReturnType<typeof createShift>, n: number) {
  let s = state;
  for (let i = 0; i < n; i++) s = step(s, {}, DT);
  return s;
}

describe('determinism (D-009)', () => {
  it('produces identical state for identical seed and inputs', () => {
    const inputFor = (_s: unknown, tick: number): InputFrame => ({
      0: { moveX: Math.sin(tick / 7), moveY: Math.cos(tick / 11), act: tick % 13 < 6, ping: false },
    });
    const a = runShift({ seed: 99, playerCount: 2, frames: 3000, inputFor: inputFor as never });
    const b = runShift({ seed: 99, playerCount: 2, frames: 3000, inputFor: inputFor as never });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different state for different seeds', () => {
    const a = runShift({ seed: 1, playerCount: 1, frames: 3000 });
    const b = runShift({ seed: 2, playerCount: 1, frames: 3000 });
    // Chaos and item/order ids diverge once randomness is consumed differently.
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('does not mutate the state it was given (purity)', () => {
    const s0 = createShift({ seed: 7, playerCount: 2 });
    const before = JSON.stringify(s0);
    const s1 = step(s0, { 0: { moveX: 1, moveY: 0, act: true, ping: false } }, DT);
    expect(JSON.stringify(s0)).toBe(before);
    expect(s1.tick).toBe(s0.tick + 1);
  });

  it('createShift is reproducible', () => {
    expect(JSON.stringify(createShift({ seed: 5, playerCount: 3 }))).toBe(
      JSON.stringify(createShift({ seed: 5, playerCount: 3 })),
    );
  });

  it('replaying a recorded input sequence reproduces the outcome exactly', () => {
    const inputs: InputFrame[] = [];
    let s = createShift({ seed: 42, playerCount: 2 });
    for (let i = 0; i < 1500; i++) {
      const f: InputFrame = {
        0: { moveX: (i % 5) - 2, moveY: (i % 3) - 1, act: i % 9 < 4, ping: false },
        1: { moveX: -((i % 4) - 1), moveY: (i % 7) - 3, act: i % 11 < 5, ping: false },
      };
      inputs.push(f);
      s = step(s, f, DT);
    }
    let r = createShift({ seed: 42, playerCount: 2 });
    for (const f of inputs) r = step(r, f, DT);
    expect(JSON.stringify(r)).toBe(JSON.stringify(s));
  });
});

describe('round timer and grades', () => {
  it('ends the shift at the configured length and assigns a grade', () => {
    const s = runShift({ seed: 3, playerCount: 1, frames: 240 * 50 + 10 });
    expect(s.phase).toBe('ended');
    expect(s.grade).not.toBeNull();
    expect(s.time).toBeGreaterThanOrEqual(240);
    expect(s.events.some((e) => e.kind === 'shift_end')).toBe(true);
  });

  it('does not advance once ended', () => {
    const ended = runShift({ seed: 3, playerCount: 1, frames: 240 * 50 + 10 });
    const again = step(ended, {}, DT);
    expect(again.tick).toBe(ended.tick);
  });

  it('grades scale with player count', () => {
    expect(gradeFor(0, 1)).toBe('D');
    expect(gradeFor(TUNING.REVENUE_TARGET_PER_PLAYER * 1, 1)).toBe('A');
    expect(gradeFor(TUNING.REVENUE_TARGET_PER_PLAYER * 1.5, 1)).toBe('S');
    // The same revenue is a worse grade with more players on the clock.
    // (500 / (300*4) = 0.42, below the C threshold of 0.5.)
    expect(gradeFor(500, 4)).toBe('D');
    expect(gradeFor(600, 4)).toBe('C');
    expect(gradeFor(350, 1)).toBe('A'); // 350/300 = 1.17
    expect(gradeFor(600, 1)).toBe('S'); // 600/300 = 2.0
    expect(gradeFor(250, 1)).toBe('B'); // 250/300 = 0.83
    expect(gradeFor(200, 1)).toBe('C'); // 200/300 = 0.67
  });
});

describe('chaos meter (S5.8)', () => {
  it('decays over time', () => {
    let s = createShift({ seed: 1, playerCount: 1 });
    s = { ...s, chaos: 50 };
    const after = idle(s, 50 * 5); // 5 seconds
    expect(after.chaos).toBeCloseTo(50 - CHAOS.DECAY_PER_SEC * 5, 1);
  });

  it('clamps to [0, 100]', () => {
    let s = createShift({ seed: 1, playerCount: 1 });
    s = { ...s, chaos: 99.9 };
    const up = idle(s, 50 * 60);
    expect(up.chaos).toBeLessThanOrEqual(100);
    s = { ...s, chaos: 0.1 };
    const down = idle(s, 50 * 60);
    expect(down.chaos).toBeGreaterThanOrEqual(0);
  });

  it('maps chaos to the correct tier and multiplier', () => {
    expect(tierFor(0).tier).toBe('CALM');
    expect(tierFor(25).tier).toBe('CALM');
    expect(tierFor(26).tier).toBe('RATTLED');
    expect(tierFor(51).tier).toBe('ROWDY');
    expect(tierFor(76).tier).toBe('FULL');
    expect(tierFor(100).multiplier).toBe(2.5);
    expect(tierFor(0).multiplier).toBe(1.0);
    // Tiers tile the range with no gaps or overlaps.
    for (let c = 0; c <= 100; c++) {
      expect(TIERS.filter((t) => c >= t.min && c <= t.max)).toHaveLength(1);
    }
  });
});

describe('rush (the player-caused chaos button)', () => {
  /** Holds Act at the rush button until Rush fires. */
  function pressRush() {
    let s = createShift({ seed: 11, playerCount: 1 });
    // Walk player 0 onto the rush button at (3.4, 7.4).
    for (let i = 0; i < 50 * 6 && !s.rush.active; i++) {
      const p = s.players[0]!;
      const dx = 3.4 - p.pos.x;
      const dy = 7.4 - p.pos.y;
      const m = Math.hypot(dx, dy) || 1;
      const near = m < 1.2;
      s = step(
        s,
        { 0: { moveX: near ? 0 : dx / m, moveY: near ? 0 : dy / m, act: near, ping: false } },
        DT,
      );
    }
    return s;
  }

  it('costs chaos immediately and is attributed to the player who pressed it', () => {
    const s = pressRush();
    expect(s.rush.active).toBe(true);
    expect(s.rush.startedBy).toBe(0);
    expect(s.stats[0]!.rushes).toBe(1);
    const ev = s.events.find((e) => e.kind === 'rush_start' && e.detail?.includes('RUSH'));
    expect(ev).toBeDefined();
    expect(ev!.playerId).toBe(0);
    expect(ev!.chaos).toBeCloseTo(CHAOS.ADD.RUSH_INSTANT, 5);
  });

  it('runs for the configured duration then goes on cooldown', () => {
    let s = pressRush();
    expect(s.rush.active).toBe(true);
    s = idle(s, Math.ceil((CHAOS.RUSH_DURATION_SEC + 0.1) * 50));
    expect(s.rush.active).toBe(false);
    expect(s.rush.cooldownSec).toBeGreaterThan(0);
  });

  it('cannot be spammed while on cooldown', () => {
    let s = pressRush();
    const rushesBefore = s.stats[0]!.rushes;
    s = idle(s, Math.ceil((CHAOS.RUSH_DURATION_SEC + 1) * 50));
    // Still standing on the button, holding Act.
    for (let i = 0; i < 50 * 3; i++) {
      s = step(s, { 0: { moveX: 0, moveY: 0, act: true, ping: false } }, DT);
    }
    expect(s.stats[0]!.rushes).toBe(rushesBefore);
  });
});
