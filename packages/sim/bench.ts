/**
 * Headless simulation benchmark.
 *
 * This is the concrete payoff of D-009: the whole game can be run thousands of times with
 * no renderer, no browser, and no human. It is also the number that tells us whether the
 * deep-clone-per-tick trade in sim.ts is affordable.
 */
import { createShift, step } from './src/sim.js';
import { DT, type InputFrame } from './src/types.js';

function benchShifts(playerCount: number, shifts: number, seconds = 240) {
  const frames = seconds * 50;
  const t0 = performance.now();
  let ticks = 0;
  for (let n = 0; n < shifts; n++) {
    let s = createShift({ seed: n + 1, playerCount });
    for (let i = 0; i < frames && s.phase === 'playing'; i++) {
      const f: InputFrame = {};
      for (let p = 0; p < playerCount; p++) {
        f[p] = {
          moveX: Math.sin((i + p * 37) / 9),
          moveY: Math.cos((i + p * 53) / 11),
          act: (i + p) % 17 < 8,
          ping: false,
        };
      }
      s = step(s, f, DT);
      ticks++;
    }
  }
  const ms = performance.now() - t0;
  return { shifts, ticks, ms, ticksPerSec: ticks / (ms / 1000), msPerTick: ms / ticks };
}

console.log('CHAOS KITCHEN — headless simulation benchmark');
console.log('sim tick rate target: 50 Hz internal / 20 Hz network (S8.4)\n');
for (const pc of [1, 2, 4]) {
  const r = benchShifts(pc, 2);
  console.log(
    `${pc} player(s): ${r.ticks.toLocaleString()} ticks in ${r.ms.toFixed(0)} ms` +
      `  ->  ${r.msPerTick.toFixed(3)} ms/tick  (${Math.round(r.ticksPerSec).toLocaleString()} ticks/sec)`,
  );
  const budget20 = 1000 / 20;
  const rooms = Math.floor(budget20 / r.msPerTick);
  console.log(`   a 20 Hz server tick has ${budget20} ms; ~${rooms} concurrent room(s) fit per core\n`);
}
