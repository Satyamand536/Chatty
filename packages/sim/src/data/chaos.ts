/**
 * Chaos constants. These values are the balance contract from
 * docs/GAME_DESIGN_FOUNDATION.md §5.8. They live in data, not code, so a headless
 * balance sweep (D-009) can vary them without touching simulation logic.
 */

export const CHAOS = {
  MAX: 100,
  /** Chaos added by each event. */
  ADD: {
    BURN: 8,
    DROP: 4,
    BOIL_OVER: 6,
    COLLISION: 1,
    WRONG_ORDER: 10,
    TICKET_EXPIRE: 15,
    DIRTY_PAN_TIMEOUT: 2,
    RUSH_INSTANT: 25,
  },
  /** Chaos removed. Stored positive; applied as subtraction. */
  SUB: {
    CORRECT_SERVE: 6,
    CLEAN: 8,
    EXTINGUISH: 10,
  },
  /** Passive decay per second while playing. */
  DECAY_PER_SEC: 1,
  RUSH_PER_SEC: 2,
  RUSH_DURATION_SEC: 10,
  RUSH_COOLDOWN_SEC: 30,
  RUSH_COOK_SPEED: 1.5,
  RUSH_MOVE_SPEED: 1.2,
  /** Dirty pans start charging chaos after this many seconds unwashed. */
  DIRTY_PAN_GRACE_SEC: 20,
} as const;

export type ChaosTier = 'CALM' | 'RATTLED' | 'ROWDY' | 'FULL';

export interface TierDef {
  tier: ChaosTier;
  min: number;
  max: number;
  multiplier: number;
  /** Whether tier-scoped disasters can spawn at this tier. */
  disasters: boolean;
}

/** §5.8 tier table. `max` is inclusive. */
export const TIERS: readonly TierDef[] = [
  { tier: 'CALM', min: 0, max: 25, multiplier: 1.0, disasters: false },
  { tier: 'RATTLED', min: 26, max: 50, multiplier: 1.2, disasters: true },
  { tier: 'ROWDY', min: 51, max: 75, multiplier: 1.7, disasters: true },
  { tier: 'FULL', min: 76, max: 100, multiplier: 2.5, disasters: true },
] as const;

export function tierFor(chaos: number): TierDef {
  const c = clampChaos(chaos);
  for (const t of TIERS) {
    if (c >= t.min && c <= t.max) return t;
  }
  return TIERS[TIERS.length - 1] as TierDef;
}

export function clampChaos(c: number): number {
  if (!Number.isFinite(c)) return 0;
  return Math.max(0, Math.min(CHAOS.MAX, c));
}
