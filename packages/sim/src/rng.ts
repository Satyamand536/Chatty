/**
 * Deterministic PRNG (mulberry32).
 *
 * The simulation MUST NOT call Math.random() or Date.now(). All randomness is drawn from
 * `state.rng`, which is part of the serialized state. This is what makes a shift
 * reproducible from (seed, inputs) and therefore testable in CI.
 *
 * `nextRng` returns the new seed; callers store it back into state.
 */
export type RngState = number;

export function createRng(seed: number): RngState {
  return seed >>> 0;
}

/** Advances the seed and returns [randomFloat0to1, nextSeed]. */
export function nextFloat(rng: RngState): [number, RngState] {
  let t = (rng + 0x6d2b79f5) >>> 0;
  const next = t >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const f = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [f, next];
}

/** Inclusive integer in [min, max]. */
export function nextInt(rng: RngState, min: number, max: number): [number, RngState] {
  const [f, next] = nextFloat(rng);
  return [min + Math.floor(f * (max - min + 1)), next];
}

/** Uniform pick from a non-empty array. */
export function pick<T>(rng: RngState, items: readonly T[]): [T, RngState] {
  const [i, next] = nextInt(rng, 0, items.length - 1);
  return [items[i] as T, next];
}
