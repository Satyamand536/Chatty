/**
 * Item definitions. Pure data.
 *
 * Timing lives on the INPUT item, because that is what is physically sitting on the heat
 * source. `cooksInto` names the item it becomes. Getting this the other way round (timings
 * on the output) means a raw item on a grill never cooks — which is exactly the bug this
 * file's first revision had, caught by the burger integration test.
 */

export type ItemKind =
  | 'ingredient'
  | 'prepared'
  | 'cooked'
  | 'plate'
  | 'tool'
  | 'waste';

export interface ItemDef {
  id: string;
  label: string;
  kind: ItemKind;
  /** Station kind required to process this item. */
  station?: StationKind;
  /** Input item id this is produced from (informational; used by tests/docs). */
  from?: string;
  /** Seconds of hold-to-progress to prep this item on a counter. */
  prepSec?: number;
  /** Item this prep step produces. */
  prepsInto?: string;
  /** Seconds of heat until COOKED. */
  cookedAtSec?: number;
  /** Seconds of heat until BURNT. */
  burntAtSec?: number;
  /** Seconds of heat until this pot boils over into a mess. */
  boilOverAtSec?: number;
  /** Item this becomes when it finishes cooking. */
  cooksInto?: string;
  /** Recipe component key this item satisfies when assembled onto a plate. */
  component?: string;
}

export type StationKind =
  | 'counter'
  | 'grill'
  | 'pot'
  | 'fryer'
  | 'plating'
  | 'pass'
  | 'sink'
  | 'bin'
  | 'extinguisher'
  | 'rush'
  | 'crate';

export const ITEMS: Record<string, ItemDef> = {
  // --- raw ingredients (dispensed from crates) ---
  bun: { id: 'bun', label: 'Bun', kind: 'ingredient', component: 'bun' },
  patty: {
    id: 'patty', label: 'Raw Patty', kind: 'ingredient',
    station: 'grill', cookedAtSec: 3.0, burntAtSec: 6.0, cooksInto: 'patty_cooked',
  },
  lettuce: { id: 'lettuce', label: 'Lettuce', kind: 'ingredient', station: 'counter', prepSec: 1.2, prepsInto: 'lettuce_chopped' },
  tomato: { id: 'tomato', label: 'Tomato', kind: 'ingredient', station: 'counter', prepSec: 1.2, prepsInto: 'tomato_chopped' },
  potato: { id: 'potato', label: 'Potato', kind: 'ingredient', station: 'counter', prepSec: 1.2, prepsInto: 'potato_sliced' },

  // --- prepared (chopped/sliced) ---
  lettuce_chopped: { id: 'lettuce_chopped', label: 'Chopped Lettuce', kind: 'prepared', from: 'lettuce', component: 'lettuce' },
  tomato_chopped: {
    id: 'tomato_chopped', label: 'Chopped Tomato', kind: 'prepared', from: 'tomato',
    // Boil-over MUST come before burn, or the pot's signature failure is unreachable:
    // with burn at 8.0 and boil-over at 9.5 the soup always burned first and the
    // boil-over event could never fire. Caught by the soup integration test.
    station: 'pot', cookedAtSec: 5.0, burntAtSec: 12.0, boilOverAtSec: 9.5, cooksInto: 'soup_cooked',
  },
  potato_sliced: {
    id: 'potato_sliced', label: 'Sliced Potato', kind: 'prepared', from: 'potato',
    station: 'fryer', cookedAtSec: 2.5, burntAtSec: 4.5, cooksInto: 'fries_cooked',
  },

  // --- cooked (these carry the recipe component keys) ---
  patty_cooked: { id: 'patty_cooked', label: 'Grilled Patty', kind: 'cooked', from: 'patty', component: 'patty' },
  soup_cooked: { id: 'soup_cooked', label: 'Soup', kind: 'cooked', from: 'tomato_chopped', component: 'soup' },
  fries_cooked: { id: 'fries_cooked', label: 'Fries', kind: 'cooked', from: 'potato_sliced', component: 'fries' },

  // --- tools / vessels ---
  plate: { id: 'plate', label: 'Plate', kind: 'tool' },
  extinguisher: { id: 'extinguisher', label: 'Extinguisher', kind: 'tool' },

  // --- waste ---
  burnt_food: { id: 'burnt_food', label: 'Burnt Food', kind: 'waste' },
};

/** Items dispensed by ingredient crates. */
export const CRATE_ITEMS = ['bun', 'patty', 'lettuce', 'tomato', 'potato'] as const;

/** Lead time for the audible/visual burn warning (§5.4: every punishment is telegraphed). */
export const BURN_WARNING_SEC = 1.5;

/** True when this item can be prepped (chopped) on a counter. */
export function isPrepable(def: string): boolean {
  const d = ITEMS[def];
  return !!d && typeof d.prepSec === 'number' && typeof d.prepsInto === 'string';
}

/** True when this item cooks on a heat source. */
export function isCookable(def: string): boolean {
  const d = ITEMS[def];
  return !!d && typeof d.cookedAtSec === 'number' && typeof d.burntAtSec === 'number';
}

/**
 * Component key an item contributes to a plate, given how cooked it is.
 *
 * We deliberately do NOT swap `item.def` when cooking finishes. Swapping the def means the
 * cooked item loses its source timings, so it can no longer burn — the pan would sit there
 * forever. Deriving the component from (def, cookState) keeps one stable def per item and
 * lets the same timing table drive cook -> burn.
 */
const COOKED_COMPONENT: Record<string, string> = {
  patty: 'patty',
  tomato_chopped: 'soup',
  potato_sliced: 'fries',
};

export function componentOf(def: string, cookState: 'raw' | 'cooked' | 'burnt'): string | null {
  if (cookState === 'burnt') return null;
  const direct = ITEMS[def]?.component;
  if (typeof direct === 'string') return direct;
  if (cookState === 'cooked') return COOKED_COMPONENT[def] ?? null;
  return null;
}
