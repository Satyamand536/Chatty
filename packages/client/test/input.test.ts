import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginFrame,
  connectedPads,
  gamepadInput,
  KEY_LABELS,
  KEY_MAP,
  keysDown,
  readPlayerInput,
  resetInput,
  touch,
} from '../src/input.js';

/**
 * The failure mode these tests exist for: four people on one keyboard, and two of them
 * are bound to the same physical key. That is invisible in a single-player build and
 * ruins the game the moment a friend sits down. It is also completely testable here.
 */

function fakePads(pads: unknown[]) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { getGamepads: () => pads },
    configurable: true,
    writable: true,
  });
}

const noPads = () => fakePads([null, null, null, null]);

function pad(ax = 0, ay = 0, act = false, ping = false) {
  return { axes: [ax, ay], buttons: [{ pressed: act }, { pressed: false }, { pressed: ping }] };
}

beforeEach(() => {
  resetInput(); // clears keysDown, wasDown AND the press edges — see the blur test
  noPads();
});

describe('four cooks can share one keyboard', () => {
  it('gives every player a complete cluster', () => {
    expect(KEY_MAP).toHaveLength(4);
    for (const k of KEY_MAP) {
      expect([k.up, k.down, k.left, k.right, k.act, k.ping].every(Boolean)).toBe(true);
    }
  });

  it('never binds the same key to two different players', () => {
    const seen = new Map<string, number>();
    const clashes: string[] = [];
    KEY_MAP.forEach((k, i) => {
      for (const code of [k.up, k.down, k.left, k.right, k.act, k.ping]) {
        if (seen.has(code)) clashes.push(`${code}: P${seen.get(code)! + 1} and P${i + 1}`);
        else seen.set(code, i);
      }
    });
    expect(clashes).toEqual([]);
  });

  it('has a legend label for every player', () => {
    expect(KEY_LABELS).toHaveLength(KEY_MAP.length);
  });

  it('moves only the player whose keys were pressed', () => {
    keysDown.add('KeyW');
    expect(readPlayerInput(0).moveY).toBeLessThan(0);
    expect(readPlayerInput(1).moveY).toBe(0);
    expect(readPlayerInput(2).moveX).toBe(0);
    expect(readPlayerInput(3).moveY).toBe(0);

    keysDown.clear();
    keysDown.add('ArrowRight');
    expect(readPlayerInput(0).moveX).toBe(0);
    expect(readPlayerInput(1).moveX).toBe(1);
  });

  it('normalises a diagonal so nobody moves 41% faster', () => {
    keysDown.add('KeyW');
    keysDown.add('KeyD');
    const f = readPlayerInput(0);
    expect(Math.hypot(f.moveX, f.moveY)).toBeCloseTo(1, 6);
  });
});

describe('gamepads', () => {
  it('returns nothing when no pad is connected', () => {
    expect(gamepadInput(0)).toBeNull();
    expect(connectedPads()).toBe(0);
  });

  it('deadzones a drifting stick so a resting pad does not walk a cook into a fryer', () => {
    fakePads([pad(0.09, -0.07)]);
    expect(gamepadInput(0)).toBeNull();
    expect(connectedPads()).toBe(1);
  });

  it('passes a real stick deflection through', () => {
    fakePads([pad(0.8, 0)]);
    const f = gamepadInput(0);
    expect(f).not.toBeNull();
    expect(f!.moveX).toBeCloseTo(0.8, 5);
  });

  it('routes pad N to player N, so pads never fight over a cook', () => {
    fakePads([pad(1, 0), null, pad(-1, 0), null]);
    expect(gamepadInput(0)!.moveX).toBeCloseTo(1, 5);
    expect(gamepadInput(1)).toBeNull();
    expect(gamepadInput(2)!.moveX).toBeCloseTo(-1, 5);
    expect(connectedPads()).toBe(2);
  });

  it('reads act and ping from the standard buttons', () => {
    fakePads([pad(0, 0, true, true)]);
    const f = gamepadInput(0)!;
    expect(f.actHeld).toBe(true);
    expect(f.pingPressed).toBe(true);
  });

  it('survives getGamepads throwing, which real browsers do when permission is revoked', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { getGamepads: () => { throw new Error('denied'); } },
      configurable: true,
      writable: true,
    });
    expect(gamepadInput(0)).toBeNull();
    expect(connectedPads()).toBe(0);
  });
});

describe('device arbitration', () => {
  it('lets the touch stick drive player 0', () => {
    touch.x = 0.6;
    touch.act = true;
    expect(readPlayerInput(0).moveX).toBeCloseTo(0.6, 5);
    expect(readPlayerInput(0).actHeld).toBe(true);
  });

  it('never lets the touch stick drive another player', () => {
    touch.x = 0.6;
    touch.act = true;
    for (const i of [1, 2, 3]) {
      expect(readPlayerInput(i).moveX).toBe(0);
      expect(readPlayerInput(i).actHeld).toBe(false);
    }
  });

  it('lets the pad win when it is the one actually moving', () => {
    keysDown.add('KeyW'); // keyboard tapped
    fakePads([pad(1, 1)]); // pad committed hard
    const f = readPlayerInput(0);
    expect(f.moveX).toBeCloseTo(1, 5);
    expect(f.moveY).toBeCloseTo(1, 5);
  });

  it('returns a fully-formed idle frame rather than undefined', () => {
    const f = readPlayerInput(3);
    expect(f).toEqual({ moveX: 0, moveY: 0, actHeld: false, actPressed: false, pingPressed: false });
  });
});

describe('press edges', () => {
  it('does not swallow the first press after the window loses and regains focus', () => {
    keysDown.add('KeyQ');
    beginFrame();
    expect(readPlayerInput(0).pingPressed).toBe(true);
    resetInput(); // what the blur handler does
    keysDown.add('KeyQ');
    beginFrame();
    expect(readPlayerInput(0).pingPressed).toBe(true);
  });

  it('fires ping only on the frame the key goes down', () => {
    keysDown.add('KeyQ');
    beginFrame();
    expect(readPlayerInput(0).pingPressed).toBe(true);
    beginFrame(); // still held, no longer a new press
    expect(readPlayerInput(0).pingPressed).toBe(false);
    expect(readPlayerInput(0).actHeld).toBe(false);
  });

  it('re-arms after the key is released and pressed again', () => {
    keysDown.add('KeyQ');
    beginFrame();
    expect(readPlayerInput(0).pingPressed).toBe(true);
    beginFrame();
    keysDown.delete('KeyQ');
    beginFrame();
    keysDown.add('KeyQ');
    beginFrame();
    expect(readPlayerInput(0).pingPressed).toBe(true);
  });

  it('keeps hold-to-work held, since that is the whole interaction model', () => {
    keysDown.add('KeyE');
    beginFrame();
    expect(readPlayerInput(0).actHeld).toBe(true);
    beginFrame();
    beginFrame();
    expect(readPlayerInput(0).actHeld).toBe(true);
  });
});
