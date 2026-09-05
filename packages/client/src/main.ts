/**
 * Phase 2 — playable greybox prototype.
 *
 * One human, one kitchen, one complete shift. The simulation owns all game state; this file
 * only reads input, drives a fixed timestep, and draws what the sim says is true. There is
 * no gameplay logic here (D-009) — if a rule needs changing, it changes in packages/sim.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  createShift,
  nearestStation,
  step,
  stationById,
  itemAtStation,
  DT,
  RECIPES,
  TUNING,
  tierFor,
  type InputFrame,
  type SimState,
  type WorldItem,
} from '@chaos-kitchen/sim';
import { buildKitchen, cookTint, ITEM_COLOR, makeHighlight, makeItemMesh, makePlayerRing } from './visuals.js';
import {
  attachKeyboard,
  beginFrame,
  connectedPads,
  KEY_LABELS,
  readPlayerInput,
  touch,
} from './input.js';

// ---------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
document.getElementById('boot')!.style.display = 'none';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1e24);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
const kitchenGroup = buildKitchen();
scene.add(kitchenGroup);

function frameKitchen() {
  const w = 11;
  const h = 13;
  camera.position.set(w / 2, Math.max(w, h) * 1.05, h / 2 + Math.max(w, h) * 0.58);
  camera.lookAt(w / 2, 0, h / 2);
}
frameKitchen();

scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(6, 14, 8);
scene.add(key);

// Chaos lighting: a warm point light that intensifies with the meter (S10.3).
const chaosLight = new THREE.PointLight(0xff5a1f, 0, 30);
chaosLight.position.set(5.5, 4, 6.5);
scene.add(chaosLight);

/** One colour per cook, used for the stand-in, the ring, the highlight and the HUD. */
export const PLAYER_COLORS = [0x7bd94e, 0x4aa8ff, 0xffd23f, 0xff5e8a];

interface PlayerView {
  root: THREE.Group;
  ring: THREE.Mesh;
  highlight: THREE.Mesh;
  mesh: THREE.Object3D;
  color: number;
}

const playerViews: PlayerView[] = [];

function capsuleStandIn(color: number): THREE.Object3D {
  const m = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.7, 4, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true }),
  );
  m.position.y = 0.75;
  return m;
}

/**
 * Grow or shrink the cast to match the shift. Rebuilt on player-count change so a 4p
 * shift never renders 1 cook, and a 1p shift never leaves 3 ghosts in the kitchen.
 */
function ensureCast(n: number) {
  while (playerViews.length > n) {
    const v = playerViews.pop()!;
    scene.remove(v.root, v.ring, v.highlight);
  }
  while (playerViews.length < n) {
    const i = playerViews.length;
    const color = PLAYER_COLORS[i % PLAYER_COLORS.length]!;
    const root = new THREE.Group();
    const mesh = capsuleStandIn(color);
    root.add(mesh);
    const ring = makePlayerRing(color);
    const highlight = makeHighlight();
    highlight.visible = false;
    scene.add(root, ring, highlight);
    playerViews.push({ root, ring, highlight, mesh, color });
  }
}

ensureCast(1);

/** The gremlin bytes, kept so cooks added after load get one too. */
let glbBuffer: ArrayBuffer | null = null;
const dressed = new WeakSet<THREE.Group>();

/** Cooks created after the asset loaded still get the real model, not a capsule. */
function dressLateJoiners() {
  for (const view of playerViews) {
    if (dressed.has(view.root)) continue;
    dressed.add(view.root);
    void (async () => {
      const gltf = await new GLTFLoader().parseAsync(glbBuffer!, '');
      gltf.scene.scale.setScalar(1.0);
      applyGremlinTo(view, gltf.scene, gltf.animations[0] ?? null);
    })();
  }
}

function applyGremlinTo(view: PlayerView, g: THREE.Object3D, clip: THREE.AnimationClip | null) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: view.color, roughness: 0.6, flatShading: true });
  });
  view.root.remove(view.mesh);
  view.root.add(g);
  view.mesh = g;
  if (!clip) return;
  // Real delta, not a fixed DT — otherwise animation speed tracks the frame rate.
  const mixer = new THREE.AnimationMixer(g);
  mixer.clipAction(clip).play();
  let prev = performance.now();
  const tick = (now: number) => {
    mixer.update(Math.min(0.1, (now - prev) / 1000));
    prev = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Simulation driver
// ---------------------------------------------------------------------------

// Start paused in the lobby. `step` is a no-op unless phase === 'playing'.
let playerCount = 1;
let sim: SimState = { ...createShift({ seed: 2026, playerCount: 1 }), phase: 'lobby' };
let accumulator = 0;
let lastTime = performance.now();
let running = true;

const itemMeshes = new Map<number, THREE.Mesh>();
const heldGroup = new THREE.Group();
scene.add(heldGroup);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

attachKeyboard();
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && sim.phase === 'ended') restart();
});

// --- touch (provisional shim; the real mobile scheme is Phase 5) -------------

function initTouch() {
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (!isTouch) return;
  document.getElementById('touch')!.classList.add('on');

  const stick = document.getElementById('stick') as HTMLDivElement;
  const nub = document.getElementById('nub') as HTMLDivElement;
  let active = false;
  const R = 46;

  const move = (cx: number, cy: number) => {
    const r = stick.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > R) {
      dx = (dx / m) * R;
      dy = (dy / m) * R;
    }
    nub.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.x = dx / R;
    touch.y = dy / R;
  };
  const end = () => {
    active = false;
    touch.x = 0;
    touch.y = 0;
    nub.style.transform = 'translate(0,0)';
  };

  stick.addEventListener('touchstart', (e) => {
    active = true;
    const t = e.touches[0]!;
    move(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0]!;
    move(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  stick.addEventListener('touchend', end);
  stick.addEventListener('touchcancel', end);

  const act = document.getElementById('actbtn') as HTMLDivElement;
  act.addEventListener('touchstart', (e) => {
    touch.act = true;
    e.preventDefault();
  }, { passive: false });
  act.addEventListener('touchend', () => (touch.act = false));
  act.addEventListener('touchcancel', () => (touch.act = false));
}

/** One input per cook on shift. Players past playerCount simply get no entry. */
function readInputs(): InputFrame {
  const frame: InputFrame = {};
  for (let i = 0; i < playerCount; i++) {
    const f = readPlayerInput(i);
    frame[i] = { moveX: f.moveX, moveY: f.moveY, act: f.actHeld, ping: f.pingPressed };
  }
  return frame;
}

// ---------------------------------------------------------------------------
// Fixed timestep
// ---------------------------------------------------------------------------

function update(now: number) {
  const frameSec = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  beginFrame();

  if (sim.phase === 'playing') {
    accumulator += frameSec;
    let guard = 0;
    while (accumulator >= DT && guard < 40) {
      sim = step(sim, readInputs(), DT);
      accumulator -= DT;
      guard++;
    }
  }

  syncScene();
  syncHud();
  renderer.render(scene, camera);

  if (sim.phase === 'ended' && running) {
    running = false;
    showBill();
  }
  requestAnimationFrame(update);
}

let seedCounter = 2026;

function beginShift() {
  document.getElementById('start')!.style.display = 'none';
  document.getElementById('bill')!.style.display = 'none';
  document.getElementById('hud')!.style.display = 'block';
  sim = { ...sim, phase: 'playing' };
}

function renderCastLegend(n: number, pads: number) {
  const el = document.getElementById('cast');
  if (!el) return;
  el.innerHTML = Array.from({ length: n }, (_, i) => {
    const l = KEY_LABELS[i]!;
    const pad = i < pads ? ' &nbsp;<b>+ PAD ' + (i + 1) + '</b>' : '';
    return `<div><b style="color:#${PLAYER_COLORS[i % PLAYER_COLORS.length]!.toString(16).padStart(6, '0')}">P${i + 1}</b>
      &nbsp;<kbd>${l.move}</kbd> move &nbsp;<kbd>${l.act}</kbd> work &nbsp;<kbd>${l.ping}</kbd> ping${pad}</div>`;
  }).join('') + '<div><kbd>R</kbd> next shift (after The Bill)</div>';
  const note = document.getElementById('padnote');
  if (note) note.textContent = pads > 0 ? `${pads} gamepad(s) detected.` : 'Plug in a gamepad and press a button — pad 1 drives P1.';
}

function initLobby() {
  renderCastLegend(playerCount, connectedPads());
  // Gamepads only appear once one has been touched; refresh the note when that happens.
  globalThis.addEventListener?.('gamepadconnected', () => renderCastLegend(playerCount, connectedPads()));
  const picks = document.getElementById('picks');
  picks?.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest('.pick') as HTMLElement | null;
    const n = Number(btn?.dataset.n);
    if (!n || n < 1 || n > 4) return;
    playerCount = n;
    ensureCast(n);
    picks.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', b === btn));
    renderCastLegend(n, connectedPads());
  });
}

function restart() {
  seedCounter = (Date.now() % 1e9) | 0;
  sim = createShift({ seed: seedCounter, playerCount });
  accumulator = 0;
  running = true;
  for (const m of itemMeshes.values()) scene.remove(m);
  itemMeshes.clear();
  clearChips();
  document.getElementById('bill')!.style.display = 'none';
  document.getElementById('hud')!.style.display = 'block';
}
(window as unknown as { __restart: () => void }).__restart = restart;

// ---------------------------------------------------------------------------
// Scene sync — reads sim state, never writes it
// ---------------------------------------------------------------------------

function syncScene() {
  ensureCast(sim.players.length);
  if (glbBuffer) dressLateJoiners();

  for (let i = 0; i < playerViews.length; i++) {
    const view = playerViews[i]!;
    const p = sim.players[i];
    if (!p) { view.root.visible = view.ring.visible = view.highlight.visible = false; continue; }
    view.root.visible = view.ring.visible = true;
    view.root.position.set(p.pos.x, 0, p.pos.y);
    view.ring.position.set(p.pos.x, 0.04, p.pos.y);

    // Face what the Act button would hit, so each cook can see their own intent.
    const target = nearestStation(sim, p);
    if (target) {
      view.root.rotation.y = Math.atan2(target.pos.x - p.pos.x, target.pos.y - p.pos.y);
      // Act target highlight — the S5.2 requirement, per player, in that player's colour.
      view.highlight.visible = true;
      view.highlight.position.set(target.pos.x, 0.06, target.pos.y);
      view.highlight.scale.setScalar(Math.max(target.half.x, target.half.y) * 2.1);
      (view.highlight.material as THREE.MeshBasicMaterial).color.setHex(view.color);
    } else {
      view.highlight.visible = false;
    }
  }

  // Chaos drives the lighting (S10.3).
  const c = sim.chaos / 100;
  chaosLight.intensity = c * 6;
  (scene.background as THREE.Color).setRGB(0.106 + c * 0.12, 0.118 - c * 0.04, 0.141 - c * 0.06);

  // Items.
  clearChips();
  const live = new Set<number>();
  for (const it of sim.items) {
    live.add(it.id);
    let mesh = itemMeshes.get(it.id);
    if (!mesh) {
      mesh = makeItemMesh(it.def);
      itemMeshes.set(it.id, mesh);
      scene.add(mesh);
    }
    // Colour tracks both the def and the cook state.
    const base = mesh.material as THREE.MeshStandardMaterial;
    base.color.setHex(cookTint(it.cookState));
    base.color.multiply(new THREE.Color(ITEM_COLOR[it.def] ?? 0xcccccc));

    let x = 0;
    let y = 0.35;
    let z = 0;
    if (it.heldBy !== undefined) {
      const holder = sim.players[it.heldBy];
      if (holder) {
        x = holder.pos.x;
        z = holder.pos.y;
      }
      y = 1.55;
    } else if (it.atStation) {
      const st = stationById(it.atStation);
      if (st) {
        x = st.pos.x;
        z = st.pos.y;
        y = 1.25;
      }
    } else if (it.onFloor) {
      x = it.onFloor.x;
      z = it.onFloor.y;
      y = 0.15;
    }
    mesh.position.set(x, y, z);
    // A burnt item slumps; a cooked one pops. Cheap state readability (S10.5 item 4).
    const sc = it.cookState === 'burnt' ? 0.8 : it.cookState === 'cooked' ? 1.12 : 1;
    mesh.scale.setScalar(sc);

    syncChips(it, x, y, z);
  }
  for (const [id, mesh] of itemMeshes) {
    if (!live.has(id)) {
      scene.remove(mesh);
      itemMeshes.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Component chips — what is actually on the plate
// ---------------------------------------------------------------------------

const chipGroup = new THREE.Group();
scene.add(chipGroup);
const CHIP_COLORS: Record<string, number> = {
  bun: 0xd9a05b, patty: 0x8a4a2a, lettuce: 0x9adb6a, soup: 0xe8a33d, fries: 0xf2c14e,
};

function syncChips(it: WorldItem, x: number, y: number, z: number) {
  if (it.def !== 'plate') return;
  it.components.forEach((c, i) => {
    const chip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: CHIP_COLORS[c] ?? 0xffffff, flatShading: true }),
    );
    chip.position.set(x - 0.2 + i * 0.2, y + 0.28, z);
    chipGroup.add(chip);
  });
}

function clearChips() {
  while (chipGroup.children.length) {
    const c = chipGroup.children[0]!;
    chipGroup.remove(c);
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

const hud = document.getElementById('hud') as HTMLDivElement;

function syncHud() {
  const p = sim.players[0]!;
  const tier = tierFor(sim.chaos);
  const remain = Math.max(0, sim.shiftLengthSec - sim.time);
  const mm = Math.floor(remain / 60);
  const ss = Math.floor(remain % 60).toString().padStart(2, '0');
  const target = nearestStation(sim, p);
  const heldItem = p.held !== null ? sim.items.find((i) => i.id === p.held) : undefined;
  const onTarget = target ? itemAtStation(sim, target.id) : undefined;

  const chaosPct = Math.round(sim.chaos);
  const chaosClass = tier.tier === 'FULL' ? 'hot' : tier.tier === 'ROWDY' ? 'warm' : '';

  hud.innerHTML = `
    <div class="row">
      <div class="clock ${remain < 30 ? 'urgent' : ''}">${mm}:${ss}</div>
      <div class="coins">$${sim.revenue}</div>
      <div class="combo">${sim.combo > 1 ? `x${Math.min(TUNING.COMBO_CAP, 1 + sim.combo * TUNING.COMBO_STEP).toFixed(1)}` : ''}</div>
    </div>
    <div class="chaos">
      <div class="chaosbar"><div class="chaosfill ${chaosClass}" style="width:${chaosPct}%"></div></div>
      <div class="chaoslabel">${tier.tier} &middot; ${chaosPct}% &middot; payout <b>${tier.multiplier.toFixed(1)}&times;</b></div>
    </div>
    <div class="rail">${renderRail()}</div>
    <div class="ctx">${contextLine(target?.kind ?? null, heldItem, onTarget)}</div>
    ${renderCooks()}
  `;
}

/**
 * Per-cook strip. With one cook it is a control hint; with four it is the only way to
 * see whose patty is where, so it carries each cook's colour, held item and progress.
 */
function renderCooks(): string {
  return `<div class="cooks">${sim.players
    .map((pl, i) => {
      const held = pl.held !== null ? sim.items.find((it) => it.id === pl.held) : undefined;
      const col = `#${PLAYER_COLORS[i % PLAYER_COLORS.length]!.toString(16).padStart(6, '0')}`;
      const pct = pl.action ? Math.round(pl.action.progress * 100) : null;
      const what = pct !== null ? `working ${pct}%` : held ? (held.def ?? 'item') : '&mdash;';
      return `<div class="cook"><i style="background:${col}"></i>P${i + 1} ${what}</div>`;
    })
    .join('')}</div>`;
}

function renderRail(): string {
  if (!sim.orders.length) return '<div class="ticket empty">no tickets yet…</div>';
  return sim.orders
    .map((o) => {
      const r = RECIPES[o.recipeId];
      const pct = Math.max(0, Math.min(100, (o.remainSec / o.totalSec) * 100));
      const late = pct < 30 ? 'late' : '';
      return `<div class="ticket ${late}">
        <span class="tname">${r?.label ?? o.recipeId}</span>
        <span class="tbar"><i style="width:${pct}%"></i></span>
        <span class="tval">$${r?.basePrice ?? 0}</span>
      </div>`;
    })
    .join('');
}

function contextLine(
  kind: string | null,
  held: WorldItem | undefined,
  onTarget: WorldItem | undefined,
): string {
  if (!kind) return 'nothing in reach';
  if (kind === 'rush') return held ? 'put that down first' : '<b>hold</b> to RUSH (+25 chaos, 10s speed)';
  if (kind === 'pass') return held?.def === 'plate' ? '<b>serve</b> the plate' : 'bring a plate here';
  if (kind === 'bin') return held ? '<b>bin</b> it' : 'the bin is empty';
  if (kind === 'sink') return sim.dirty['sink'] ? '<b>hold</b> to wash' : 'nothing to wash';
  if (kind === 'extinguisher') return held ? '' : '<b>take</b> the extinguisher';
  if (kind === 'plating') {
    if (onTarget?.def === 'plate' && held) return '<b>hold</b> to add to the plate';
    if (!onTarget && held?.def === 'plate') return '<b>put</b> the plate down';
    if (onTarget?.def === 'plate') return `<b>take</b> the plate${onTarget.components.length ? ` (${onTarget.components.join(', ')})` : ' (empty)'}`;
  }
  if (kind === 'crate') return held ? 'hands full' : '<b>take</b> an ingredient';
  if (held) return onTarget ? '<b>take</b> it' : `<b>put down</b> ${held.def}`;
  return onTarget ? `<b>${onTarget.def === 'plate' ? 'take' : 'take'}</b> ${onTarget.def}${onTarget.cookState !== 'raw' ? ` (${onTarget.cookState})` : ''}` : 'empty';
}

// ---------------------------------------------------------------------------
// The Bill (S7.8) — templated, per D-013. No LLM.
// ---------------------------------------------------------------------------

const VERDICTS: { test: (s: SimState) => boolean; lines: string[] }[] = [
  {
    test: (s) => s.grade === 'S',
    lines: ['Genuinely, horrifyingly competent.', 'The health inspector is crying.', 'Somebody promote the gremlins.'],
  },
  {
    test: (s) => s.stats[0]!.burnt >= 3,
    lines: ['We are not a kitchen. We are a fire with a menu.', 'The smoke alarm has filed a complaint.'],
  },
  {
    test: (s) => s.stats[0]!.dropped >= 3,
    lines: ['The floor is now the menu.', 'Gravity remains undefeated.'],
  },
  {
    test: (s) => s.stats[0]!.rushes >= 3,
    lines: ['Someone has their hand on the button and we cannot stop them.', 'Rush was pressed. Repeatedly. On purpose.'],
  },
  {
    test: (s) => s.expired >= 4,
    lines: ['Four customers walked out. One left a review.', 'The dining room is emptier than the fridge.'],
  },
  {
    test: (s) => s.grade === 'D',
    lines: ['Technically a restaurant.', 'We served food. Loosely.'],
  },
  {
    test: () => true,
    lines: ['A shift happened.', 'Nobody died. Probably.'],
  },
];

function showBill() {
  const s = sim;
  const st = s.stats[0]!;
  const tier = tierFor(s.chaos);
  const verdict = (VERDICTS.find((v) => v.test(s)) ?? VERDICTS[VERDICTS.length - 1]!).lines;
  const line = verdict[((s.revenue + s.served) % verdict.length)];

  const target = TUNING.REVENUE_TARGET_PER_PLAYER;
  const gap = target - s.revenue;
  const nearMiss =
    gap > 0 && gap <= target * 0.25
      ? `<div class="near">You were <b>$${gap}</b> short of a ${nextGrade(s.grade)}. One more shift.</div>`
      : '';

  const bill = document.getElementById('bill') as HTMLDivElement;
  bill.style.display = 'block';
  document.getElementById('hud')!.style.display = 'none';
  bill.innerHTML = `
    <div class="card">
      <h1>THE BILL</h1>
      <div class="grade grade-${s.grade}">${s.grade}</div>
      <div class="big">$${s.revenue}</div>
      <table>
        <tr><td>Served</td><td>${s.served}</td></tr>
        <tr><td>Lost tickets</td><td>${s.expired}</td></tr>
        <tr><td>Burnt</td><td>${st.burnt}</td></tr>
        <tr><td>Dropped</td><td>${st.dropped}</td></tr>
        <tr><td>Cleaned</td><td>${st.cleaned}</td></tr>
        <tr><td>Extinguished</td><td>${st.extinguished}</td></tr>
        <tr><td>RUSH pressed</td><td>${st.rushes}</td></tr>
        <tr><td>Final chaos</td><td>${tier.tier} (${Math.round(s.chaos)}%)</td></tr>
      </table>
      <div class="verdict">“${line}”</div>
      <div class="seed">shift seed ${s.seed}</div>
      ${nearMiss}
      <button onclick="__restart()">NEXT SHIFT &nbsp;(R)</button>
    </div>
  `;
}

function nextGrade(g: string | null): string {
  const order = ['D', 'C', 'B', 'A', 'S'];
  const i = order.indexOf(g ?? 'D');
  return order[Math.min(order.length - 1, i + 1)]!;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameKitchen();
});

document.getElementById('startbtn')!.addEventListener('click', beginShift);
initTouch();
initLobby();

(async () => {
  try {
    const res = await fetch('/gremlin.glb');
    const buf = await res.arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    const g = gltf.scene;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: 0x7bd94e, roughness: 0.6, flatShading: true });
    });
    g.scale.setScalar(1.0);
    // Store the parsed result and re-parse per cook. scene.clone() does NOT rebind a
    // SkinnedMesh's skeleton, so cloned gremlins would animate but never deform.
    glbBuffer = buf;
    dressed.add(playerViews[0]!.root); // already wearing it; do not re-parse
    applyGremlinTo(playerViews[0]!, g, gltf.animations[0] ?? null);
  } catch {
    // Fall back to the capsule. The prototype must still be playable without the asset.
  }
  requestAnimationFrame((t) => {
    lastTime = t;
    update(t);
  });
})();
