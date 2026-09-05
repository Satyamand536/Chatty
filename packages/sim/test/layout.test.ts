import { describe, expect, it } from 'vitest';
import { KITCHEN, REACH, PLAYER_RADIUS, type StationDef } from '../src/data/kitchen.js';
import { createShift, nearestStation, stationById } from '../src/sim.js';

/**
 * Layout invariants.
 *
 * Phase 1 found two layout defects that unit tests would never have caught:
 *   1. A wall made three ingredient crates reachable only through a corridor, so a player
 *      holding "up" got pinned against an invisible edge.
 *   2. Utility stations packed tighter than the interaction radius made "nearest station"
 *      ambiguous, so pressing Act did the wrong thing.
 * Both are cheap to assert and expensive to discover by hand, so they are tests now.
 */

function blocked(pos: { x: number; y: number }): boolean {
  for (const def of KITCHEN.stations) {
    if (
      Math.abs(pos.x - def.pos.x) < def.half.x + PLAYER_RADIUS &&
      Math.abs(pos.y - def.pos.y) < def.half.y + PLAYER_RADIUS
    )
      return true;
  }
  for (const w of KITCHEN.walls) {
    if (
      Math.abs(pos.x - w.x) < w.half.x + PLAYER_RADIUS &&
      Math.abs(pos.y - w.y) < w.half.y + PLAYER_RADIUS
    )
      return true;
  }
  return false;
}

describe('kitchen layout invariants', () => {
  it('every station can be stood at (none is sealed inside geometry)', () => {
    const sealed: string[] = [];
    for (const def of KITCHEN.stations) {
      let ok = false;
      for (let a = 0; a < 64 && !ok; a++) {
        const t = (a / 64) * Math.PI * 2;
        const r = Math.max(def.half.x, def.half.y) + PLAYER_RADIUS + 0.05;
        const p = { x: def.pos.x + Math.cos(t) * r, y: def.pos.y + Math.sin(t) * r };
        if (
          p.x > PLAYER_RADIUS && p.x < KITCHEN.width - PLAYER_RADIUS &&
          p.y > PLAYER_RADIUS && p.y < KITCHEN.height - PLAYER_RADIUS &&
          !blocked(p)
        )
          ok = true;
      }
      if (!ok) sealed.push(def.id);
    }
    expect(sealed).toEqual([]);
  });

  it('every station is the unique nearest target from at least one standing point', () => {
    // If a station can never be the nearest one, it is unreachable by the Act button.
    const s = createShift({ seed: 1, playerCount: 1 });
    const unreachable: string[] = [];
    for (const def of KITCHEN.stations) {
      let ok = false;
      for (let a = 0; a < 64 && !ok; a++) {
        const t = (a / 64) * Math.PI * 2;
        const r = Math.max(def.half.x, def.half.y) + PLAYER_RADIUS + 0.05;
        const p = { x: def.pos.x + Math.cos(t) * r, y: def.pos.y + Math.sin(t) * r };
        if (blocked(p)) continue;
        const probe = { ...s, players: [{ ...s.players[0]!, pos: p }] };
        if (nearestStation(probe, probe.players[0]!)?.id === def.id) ok = true;
      }
      if (!ok) unreachable.push(def.id);
    }
    expect(unreachable).toEqual([]);
  });

  it('player spawns are inside bounds and not inside geometry', () => {
    expect(KITCHEN.spawns.length).toBeGreaterThanOrEqual(4);
    for (const sp of KITCHEN.spawns) {
      expect(sp.x).toBeGreaterThan(PLAYER_RADIUS);
      expect(sp.x).toBeLessThan(KITCHEN.width - PLAYER_RADIUS);
      expect(sp.y).toBeGreaterThan(PLAYER_RADIUS);
      expect(sp.y).toBeLessThan(KITCHEN.height - PLAYER_RADIUS);
      expect(blocked(sp)).toBe(false);
    }
  });

  it('no two stations physically overlap', () => {
    // Proper axis-aligned test. An earlier version of this check used max(half.x, half.y)
    // on both axes, which reported sink/bin as overlapping when they are 0.4 tiles apart
    // vertically. Measure each axis properly.
    const overlaps: string[] = [];
    for (let i = 0; i < KITCHEN.stations.length; i++) {
      for (let j = i + 1; j < KITCHEN.stations.length; j++) {
        const a = KITCHEN.stations[i] as StationDef;
        const b = KITCHEN.stations[j] as StationDef;
        if (
          Math.abs(a.pos.x - b.pos.x) < a.half.x + b.half.x &&
          Math.abs(a.pos.y - b.pos.y) < a.half.y + b.half.y
        )
          overlaps.push(`${a.id}<->${b.id}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('reports the interaction-ambiguity baseline (Phase 2 spacing work)', () => {
    // A measurement, not a quality gate. Pairs whose surface gap is under REACH compete for
    // the same Act press. The design answer (S5.2) is that the client must highlight the
    // resolved target before input; until that exists, this list is what a designer spaces
    // out. The count is asserted so a layout edit that makes ambiguity WORSE fails loudly.
    const hotspots: string[] = [];
    for (let i = 0; i < KITCHEN.stations.length; i++) {
      for (let j = i + 1; j < KITCHEN.stations.length; j++) {
        const a = KITCHEN.stations[i] as StationDef;
        const b = KITCHEN.stations[j] as StationDef;
        // Separation along the dominant axis only.
        const dx = Math.abs(a.pos.x - b.pos.x) - a.half.x - b.half.x;
        const dy = Math.abs(a.pos.y - b.pos.y) - a.half.y - b.half.y;
        const gap = Math.abs(a.pos.x - b.pos.x) > Math.abs(a.pos.y - b.pos.y) ? dx : dy;
        if (gap < 0.6) hotspots.push(`${a.id}<->${b.id} (${gap.toFixed(2)})`);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`interaction ambiguity baseline: ${hotspots.length} pair(s)\n  ${hotspots.join('\n  ')}`);
    // Phase 1 measured 14. Raising this without a decision entry means a regression.
    expect(hotspots.length).toBeLessThanOrEqual(14);
  });

  it('the reach radius is sane relative to tile size', () => {
    expect(REACH).toBeGreaterThan(1);
    expect(REACH).toBeLessThan(2.5);
    expect(stationById('pass')).toBeDefined();
  });
});
