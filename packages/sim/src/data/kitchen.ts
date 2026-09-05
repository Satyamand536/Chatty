/**
 * "The Diner" — the single MVP kitchen (§6.1).
 *
 * Layout is data, not code, so a new kitchen is a new file rather than new logic.
 * Coordinates are in tiles; one tile = 1 unit. The play field is 11 wide x 13 deep.
 *
 * L-shaped: the top-right quadrant is walled off, which forces routing decisions
 * rather than letting players stand in one spot and reach everything.
 */

import type { StationKind } from './items.js';

export interface Vec2 {
  x: number;
  y: number;
}

export interface StationDef {
  id: string;
  kind: StationKind;
  /** Centre position in tiles. */
  pos: Vec2;
  /** Half-extents in tiles; used for collision and reach. */
  half: Vec2;
  /** For crates: which ingredient this crate dispenses. */
  dispenses?: string;
  /** Whether this station can be dirtied by cooking. */
  dirties?: boolean;
}

export const KITCHEN = {
  id: 'the_diner',
  label: 'The Diner',
  width: 11,
  height: 13,
  /**
   * Solid wall rectangles. The perimeter is implicit.
   *
   * LAYOUT RULE, learned the hard way in Phase 1: a wall must never leave a station
   * reachable only through a corridor the player cannot reliably find. The first revision
   * walled off x in [4,11], y in [0,3], which made the three right-hand ingredient crates
   * reachable only by hugging the left wall at x <= 3.65 — anyone holding "up" got pinned
   * against an invisible edge with no visible reason. Walls should force *routing*, never
   * create a trap. This wall blocks only the far corner, so every crate is approachable
   * from directly below.
   */
  walls: [
    { x: 9.5, y: 1.5, half: { x: 1.5, y: 1.5 } },
  ],
  stations: [
    // --- ingredient crates (top edge) ---
    { id: 'crate_bun', kind: 'crate', pos: { x: 1.0, y: 0.6 }, half: { x: 0.5, y: 0.5 }, dispenses: 'bun' },
    { id: 'crate_patty', kind: 'crate', pos: { x: 2.5, y: 0.6 }, half: { x: 0.5, y: 0.5 }, dispenses: 'patty' },
    { id: 'crate_lettuce', kind: 'crate', pos: { x: 4.0, y: 0.6 }, half: { x: 0.5, y: 0.5 }, dispenses: 'lettuce' },
    { id: 'crate_tomato', kind: 'crate', pos: { x: 5.5, y: 0.6 }, half: { x: 0.5, y: 0.5 }, dispenses: 'tomato' },
    { id: 'crate_potato', kind: 'crate', pos: { x: 7.0, y: 0.6 }, half: { x: 0.5, y: 0.5 }, dispenses: 'potato' },

    // --- prep counters (left edge) ---
    { id: 'counter_1', kind: 'counter', pos: { x: 0.6, y: 3.0 }, half: { x: 0.5, y: 0.9 } },
    { id: 'counter_2', kind: 'counter', pos: { x: 0.6, y: 5.2 }, half: { x: 0.5, y: 0.9 } },
    { id: 'counter_3', kind: 'counter', pos: { x: 0.6, y: 7.4 }, half: { x: 0.5, y: 0.9 } },

    // --- heat (right edge, below the wall) ---
    { id: 'grill_1', kind: 'grill', pos: { x: 10.4, y: 4.2 }, half: { x: 0.5, y: 0.9 }, dirties: true },
    { id: 'grill_2', kind: 'grill', pos: { x: 10.4, y: 6.2 }, half: { x: 0.5, y: 0.9 }, dirties: true },
    { id: 'pot_1', kind: 'pot', pos: { x: 10.4, y: 8.2 }, half: { x: 0.5, y: 0.9 }, dirties: true },
    { id: 'pot_2', kind: 'pot', pos: { x: 10.4, y: 10.2 }, half: { x: 0.5, y: 0.9 }, dirties: true },
    { id: 'fryer_1', kind: 'fryer', pos: { x: 8.6, y: 12.4 }, half: { x: 0.9, y: 0.5 }, dirties: true },

    // --- plating + pass (bottom-left) ---
    { id: 'plating_1', kind: 'plating', pos: { x: 2.6, y: 12.4 }, half: { x: 0.9, y: 0.5 } },
    { id: 'pass', kind: 'pass', pos: { x: 4.8, y: 12.4 }, half: { x: 0.9, y: 0.5 } },

    // --- utility (centre island) ---
    { id: 'sink', kind: 'sink', pos: { x: 5.5, y: 8.8 }, half: { x: 0.9, y: 0.5 } },
    { id: 'bin', kind: 'bin', pos: { x: 5.5, y: 10.2 }, half: { x: 0.9, y: 0.5 } },
    { id: 'ext_station', kind: 'extinguisher', pos: { x: 5.5, y: 7.4 }, half: { x: 0.7, y: 0.5 } },
    { id: 'rush_button', kind: 'rush', pos: { x: 3.4, y: 7.4 }, half: { x: 0.6, y: 0.5 } },

    // --- plate stack ---
    { id: 'plates', kind: 'counter', pos: { x: 1.0, y: 12.4 }, half: { x: 0.5, y: 0.5 }, dispenses: 'plate' },
  ] satisfies StationDef[],
  /** Player spawn points, spaced so a 4-player game does not start in a clump. */
  spawns: [
    { x: 5.5, y: 4.5 },
    { x: 5.5, y: 6.0 },
    { x: 3.5, y: 5.25 },
    { x: 7.5, y: 5.25 },
  ],
} as const;

/** Reach radius (tiles) for interacting with a station. */
export const REACH = 1.5;
/** Player collision radius in tiles. */
export const PLAYER_RADIUS = 0.35;
/** Base movement speed in tiles per second. */
export const BASE_SPEED = 4.2;
