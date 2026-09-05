import { beforeEach, describe, expect, it } from 'vitest';
import { createShift, step, type InputFrame, type SimState } from '@chaos-kitchen/sim';
import { beginFrame, keysDown, readPlayerInput, resetInput } from '../src/input.js';

/**
 * Phase 3 end-to-end: the client input layer feeding the real simulation with four cooks.
 *
 * This exercises the exact code path main.ts runs each tick — readPlayerInput() per player,
 * packed into an InputFrame, handed to step(). If a player's cluster is misrouted, or the
 * frame is packed with the wrong ids, this is where it shows up rather than in someone's
 * living room with three friends waiting.
 */

const DT = 1 / 50;

/** Same packing main.ts does, so the test cannot drift from the shipped wiring. */
function readInputs(playerCount: number): InputFrame {
  const frame: InputFrame = {};
  for (let i = 0; i < playerCount; i++) {
    const f = readPlayerInput(i);
    frame[i] = { moveX: f.moveX, moveY: f.moveY, act: f.actHeld, ping: f.pingPressed };
  }
  return frame;
}

/** Hold every listed key for `ticks` ticks of real simulation. */
function run(s: SimState, down: string[], ticks: number): SimState {
  keysDown.clear();
  for (const c of down) keysDown.add(c);
  beginFrame();
  let cur = s;
  for (let t = 0; t < ticks; t++) cur = step(cur, readInputs(s.players.length), DT);
  return cur;
}

beforeEach(() => resetInput());

describe('a 4-cook shift', () => {
  it('spawns four distinct cooks in four distinct places', () => {
    const s = createShift({ playerCount: 4, seed: 7 });
    expect(s.players).toHaveLength(4);
    const spots = new Set(s.players.map((p) => `${p.pos.x.toFixed(3)},${p.pos.y.toFixed(3)}`));
    expect(spots.size).toBe(4);
  });

  it('moves all four cooks independently from one shared keyboard', () => {
    let s = createShift({ playerCount: 4, seed: 7 });
    const before = s.players.map((p) => ({ ...p.pos }));

    // Every player's own "right" key, held at once.
    s = run(s, ['KeyD', 'ArrowRight', 'Numpad6', 'KeyL'], 25);

    s.players.forEach((p, i) => {
      expect(p.pos.x, `P${i + 1} moved right`).toBeGreaterThan(before[i]!.x);
      expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y)).toBe(true);
    });
  });

  it('leaves the other cooks alone when only one of them presses anything', () => {
    let s = createShift({ playerCount: 4, seed: 7 });
    const before = s.players.map((p) => ({ ...p.pos }));

    s = run(s, ['KeyW'], 25); // only P1 acts

    expect(s.players[0]!.pos.y).toBeLessThan(before[0]!.y);
    for (const i of [1, 2, 3]) {
      expect(s.players[i]!.pos.x).toBeCloseTo(before[i]!.x, 6);
      expect(s.players[i]!.pos.y).toBeCloseTo(before[i]!.y, 6);
    }
  });

  it('produces exactly one input entry per cook, keyed by player id', () => {
    const s = createShift({ playerCount: 4, seed: 7 });
    const frame = readInputs(4);
    expect(Object.keys(frame).sort()).toEqual(['0', '1', '2', '3']);
    for (const p of s.players) expect(frame[p.id]).toBeDefined();
  });

  it('stays inside the kitchen when all four push into the same corner', () => {
    let s = createShift({ playerCount: 4, seed: 11 });
    s = run(s, ['KeyW', 'KeyA', 'ArrowUp', 'ArrowLeft', 'Numpad8', 'Numpad4', 'KeyI', 'KeyJ'], 600);
    for (const p of s.players) {
      expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y), `P${p.id + 1} finite`).toBe(true);
      expect(p.pos.x).toBeGreaterThanOrEqual(-0.5);
      expect(p.pos.y).toBeGreaterThanOrEqual(-0.5);
      expect(p.pos.x).toBeLessThanOrEqual(13.5);
      expect(p.pos.y).toBeLessThanOrEqual(11.5);
    }
  });
});

describe('solo and duo still work after the multiplayer refactor', () => {
  it('runs a 1-cook shift', () => {
    let s = createShift({ playerCount: 1, seed: 3 });
    expect(s.players).toHaveLength(1);
    s = run(s, ['KeyD'], 20);
    expect(s.players[0]!.pos.x).toBeGreaterThan(0);
  });

  it('runs a 2-cook shift with both moving', () => {
    let s = createShift({ playerCount: 2, seed: 3 });
    const before = s.players.map((p) => p.pos.x);
    s = run(s, ['KeyD', 'ArrowLeft'], 20);
    expect(s.players[0]!.pos.x).toBeGreaterThan(before[0]!);
    expect(s.players[1]!.pos.x).toBeLessThan(before[1]!);
  });
});
