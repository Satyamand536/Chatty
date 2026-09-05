/**
 * Recipes. Pure data.
 *
 * Each recipe is a set of component keys. A plate satisfies a recipe when its
 * `components` array contains every required key (order-insensitive, no duplicates).
 *
 * Phase 1 ships three recipes, per docs/GAME_DESIGN_FOUNDATION.md §6.1. The fourth
 * (Emergency Salad, the deliberately cook-free low-skill order) is Phase 4 content and is
 * intentionally NOT here yet.
 */

export interface RecipeDef {
  id: string;
  label: string;
  /** Component keys required on the plate. */
  components: readonly string[];
  /** Base coin value before multipliers. */
  basePrice: number;
  /** Seconds a ticket stays on the rail before the customer storms out. */
  ticketSec: number;
}

export const RECIPES: Record<string, RecipeDef> = {
  panic_burger: {
    id: 'panic_burger',
    label: 'Panic Burger',
    components: ['bun', 'patty', 'lettuce'],
    basePrice: 90,
    ticketSec: 50,
  },
  suspicious_soup: {
    id: 'suspicious_soup',
    label: 'Suspicious Soup',
    components: ['soup'],
    basePrice: 70,
    ticketSec: 55,
  },
  doom_fries: {
    id: 'doom_fries',
    label: 'Doom Fries',
    components: ['fries'],
    basePrice: 60,
    ticketSec: 40,
  },
};

export const RECIPE_IDS = Object.keys(RECIPES);

/** Matches a plate's components to a recipe, or null. Exact set match required. */
export function matchRecipe(components: readonly string[]): RecipeDef | null {
  for (const id of RECIPE_IDS) {
    const r = RECIPES[id] as RecipeDef;
    if (r.components.length !== components.length) continue;
    const want = [...r.components].sort();
    const have = [...components].sort();
    if (want.every((c, i) => c === have[i])) return r;
  }
  return null;
}
