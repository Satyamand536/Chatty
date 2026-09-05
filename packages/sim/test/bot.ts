/**
 * A minimal scripted player used by the integration tests.
 *
 * This is the seed of `packages/bots` (roadmap Phase 1). It is deliberately dumb: navigate
 * to a station, hold Act until a condition is met, move on.
 *
 * IMPORTANT — it uses the same `nearestStation()` the real interaction code uses, and only
 * presses Act when the station it would act on IS the station it intends. That mirrors the
 * design rule in §5.2 ("resolve by nearest, and highlight the target before input"): the
 * client will draw that highlight, and the bot must respect the same rule or it will grab
 * the wrong ingredient. Phase 1 found this the hard way — standing 1.2 tiles from two
 * adjacent crates acted on whichever was marginally closer.
 */

import { KITCHEN, REACH, type StationDef, type Vec2 } from '../src/data/kitchen.js';
import { nearestStation } from '../src/sim.js';
import { DT, EMPTY_INPUT, type InputFrame, type PlayerInput, type SimState } from '../src/types.js';

export interface Task {
  /** Station to go to. */
  station: string;
  /** Hold Act for this many seconds once in range (default: until `done`). */
  holdSec?: number;
  /** Set false to wait at the station WITHOUT acting (e.g. letting a pan cook). */
  act?: boolean;
  /** Advance when this returns true. */
  done?: (s: SimState) => boolean;
  /** Safety timeout in seconds. */
  timeoutSec?: number;
}

const STUCK_SEC = 0.6;

export class Bot {
  playerId: number;
  private queue: Task[];
  private holdFor = 0;
  private waited = 0;
  private lastPos: Vec2 | null = null;
  private stillFor = 0;
  /** +1 or -1; flips when stuck, to slide around an obstacle. */
  private orbit = 1;

  constructor(playerId: number, tasks: Task[]) {
    this.playerId = playerId;
    this.queue = [...tasks];
  }

  get finished(): boolean {
    return this.queue.length === 0;
  }

  get currentStation(): string | null {
    return this.queue[0]?.station ?? null;
  }

  input(s: SimState): PlayerInput {
    const task = this.queue[0];
    if (!task) return { ...EMPTY_INPUT };

    const def = KITCHEN.stations.find((x) => x.id === task.station) as StationDef | undefined;
    if (!def) {
      this.queue.shift();
      return { ...EMPTY_INPUT };
    }

    const p = s.players[this.playerId]!;
    const nearest = nearestStation(s, p);
    // Only act when the station we would interact with is the one we mean.
    const ready = nearest?.id === task.station;

    if (task.done?.(s)) {
      this.advance();
      return { ...EMPTY_INPUT };
    }

    if (!ready) {
      this.holdFor = 0;
      this.waited += DT;
      if (this.waited > (task.timeoutSec ?? 30)) {
        this.advance();
        return { ...EMPTY_INPUT };
      }
      return this.moveToward(s, p.pos, def.pos);
    }

    this.waited += DT;
    this.holdFor += DT;
    if (
      (task.holdSec !== undefined && this.holdFor >= task.holdSec) ||
      this.waited > (task.timeoutSec ?? 30)
    ) {
      this.advance();
      return { ...EMPTY_INPUT };
    }
    return { moveX: 0, moveY: 0, act: task.act ?? true, ping: false };
  }

  private advance(): void {
    this.queue.shift();
    this.holdFor = 0;
    this.waited = 0;
    this.stillFor = 0;
    this.lastPos = null;
  }

  /** Direct movement with a stuck-detector that orbits around whatever it hit. */
  private moveToward(s: SimState, from: Vec2, to: Vec2): PlayerInput {
    if (this.lastPos) {
      const moved = Math.hypot(from.x - this.lastPos.x, from.y - this.lastPos.y);
      this.stillFor = moved < 0.02 ? this.stillFor + DT : 0;
      if (this.stillFor > STUCK_SEC) {
        this.orbit *= -1;
        this.stillFor = 0;
      }
    }
    this.lastPos = { x: from.x, y: from.y };

    let dx = to.x - from.x;
    let dy = to.y - from.y;
    const m = Math.hypot(dx, dy);
    if (m < 0.001) return { ...EMPTY_INPUT };
    dx /= m;
    dy /= m;
    if (this.stillFor > 0) {
      // Move perpendicular to slide around the obstacle rather than grinding into it.
      const px = -dy * this.orbit;
      const py = dx * this.orbit;
      dx = dx * 0.15 + px;
      dy = dy * 0.15 + py;
      const mm = Math.hypot(dx, dy) || 1;
      dx /= mm;
      dy /= mm;
    }
    void s;
    return { moveX: dx, moveY: dy, act: false, ping: false };
  }
}

export function frameFor(bots: Bot[], s: SimState): InputFrame {
  const f: InputFrame = {};
  for (const b of bots) f[b.playerId] = b.input(s);
  return f;
}

export { REACH };
