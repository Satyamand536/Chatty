/**
 * Simulation state and input types.
 *
 * INVARIANT: `SimState` is plain serializable data. No functions, no class instances,
 * no Date, no closures. This is what lets the server and client share one state shape
 * and lets a shift be snapshotted, diffed, and replayed (D-009).
 */

import type { RngState } from './rng.js';
import type { Vec2 } from './data/kitchen.js';

export type CookState = 'raw' | 'cooked' | 'burnt';

/** A physical item in the world. */
export interface WorldItem {
  id: number;
  /** Item definition key, e.g. 'patty' or 'patty_cooked'. */
  def: string;
  /** Seconds of heat applied. Only meaningful on cookable items on a heat station. */
  heat: number;
  cookState: CookState;
  /** For plates: the component keys assembled so far. */
  components: string[];
  /** Seconds of chop/prep progress applied to this item. */
  prep: number;
  /** Where this item is. Exactly one of the three below is set. */
  atStation?: string;
  heldBy?: number;
  onFloor?: Vec2;
  /**
   * Player who last placed this item on a heat station. Used to attribute a burn to a
   * named player in The Bill — "who burned the food?" must have an answer (§7.1).
   */
  placedBy?: number | null;
}

export type ActionKind =
  | 'chop'
  | 'cook'
  | 'assemble'
  | 'clean'
  | 'extinguish'
  | 'rush';

export interface PlayerAction {
  kind: ActionKind;
  /** Station the action targets. */
  stationId: string;
  /** 0..1 progress. */
  progress: number;
  /** Total seconds required. */
  durationSec: number;
}

export interface Player {
  id: number;
  pos: Vec2;
  /** Held item id, or null. One item per player (§5.3) — a hard constraint. */
  held: number | null;
  action: PlayerAction | null;
  /** Seconds remaining of slip-slowness from an oil slick. */
  slipSec: number;
  /** Seconds since this player last moved; used to suppress collision spam. */
  stillSec: number;
}

export type OrderStatus = 'open' | 'served' | 'expired';

export interface Order {
  id: number;
  recipeId: string;
  /** Seconds remaining on the ticket. */
  remainSec: number;
  totalSec: number;
  status: OrderStatus;
  /** Coins awarded, filled in on serve. */
  awarded: number;
}

export type DisasterKind = 'grease_fire' | 'oil_slick' | 'mouse_thief';

export interface Disaster {
  id: number;
  kind: DisasterKind;
  /** Station affected, where applicable. */
  stationId?: string;
  /** Seconds until the disaster becomes active (the anticipation tell, §5.8). */
  telegraphSec: number;
  /** Seconds remaining once active. */
  remainSec: number;
  active: boolean;
  /** Whether the mouse has already taken its ingredient. */
  resolved?: boolean;
}

export type EventKind =
  | 'burn'
  | 'drop'
  | 'boil_over'
  | 'collision'
  | 'wrong_order'
  | 'ticket_expire'
  | 'dirty_pan'
  | 'rush_start'
  | 'serve_correct'
  | 'serve_wrong'
  | 'clean'
  | 'extinguish'
  | 'disaster_start'
  | 'disaster_end'
  | 'mouse_steal'
  | 'shift_end';

/**
 * An attributed event. This is the raw material for The Bill (§7.8): every chaos-generating
 * event records WHO did it, so the recap can name names.
 */
export interface GameEvent {
  tick: number;
  time: number;
  kind: EventKind;
  /** Player responsible, or null for unattributed events. */
  playerId: number | null;
  /** Chaos delta this event caused (negative for reductions). */
  chaos: number;
  /** Optional payload for recap text and debugging. */
  detail?: string;
}

export interface PlayerStats {
  playerId: number;
  served: number;
  dropped: number;
  burnt: number;
  cleaned: number;
  extinguished: number;
  rushes: number;
  revenue: number;
}

export type ShiftPhase = 'lobby' | 'playing' | 'ended';

export interface RushState {
  active: boolean;
  remainSec: number;
  cooldownSec: number;
  /** Player who pressed it — attribution for The Bill. */
  startedBy: number | null;
}

export interface SimState {
  /** Monotonic fixed-step counter. Never wall-clock. */
  tick: number;
  /** Seconds elapsed in the shift. */
  time: number;
  shiftLengthSec: number;
  phase: ShiftPhase;
  seed: RngState;
  rng: RngState;

  players: Player[];
  items: WorldItem[];
  nextItemId: number;
  orders: Order[];
  nextOrderId: number;
  disasters: Disaster[];
  nextDisasterId: number;

  /** Station id -> dirty flag. */
  dirty: Record<string, number>;
  /** Total pans and how many are currently dirty. */
  pansTotal: number;
  pansDirty: number;

  chaos: number;
  rush: RushState;
  revenue: number;
  combo: number;
  served: number;
  expired: number;

  /** Seconds until the next ticket spawns. */
  nextOrderInSec: number;
  maxOrders: number;

  /**
   * Seconds accumulated toward the next disaster spawn check.
   * This MUST live in state, not in a module-level variable — a module-level clock would
   * leak between shifts and break the determinism contract (D-009).
   */
  disasterClockSec: number;

  events: GameEvent[];
  stats: PlayerStats[];

  /** Final grade, set when the shift ends. */
  grade: string | null;
}

/** Per-player input for one fixed step. */
export interface PlayerInput {
  /** -1..1 analog axes. */
  moveX: number;
  moveY: number;
  /** Act is HELD (drives hold-to-progress). */
  act: boolean;
  /** Ping (edge-triggered). Recorded for The Bill; no sim effect in Phase 1. */
  ping: boolean;
}

export type InputFrame = Record<number, PlayerInput>;

export const EMPTY_INPUT: PlayerInput = { moveX: 0, moveY: 0, act: false, ping: false };

/** Simulation fixed timestep. 50 Hz internally; the netcode layer will tick at 20 Hz (§8.4). */
export const DT = 1 / 50;
