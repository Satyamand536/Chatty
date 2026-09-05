/**
 * Phase 1 Workstream B — browser render + performance harness.
 *
 * This page exists to answer one question that cannot be answered in a headless sandbox:
 * can a mid-range phone hold frame rate while running this game's renderer (R12)?
 *
 * It loads the procedurally generated rigged gremlin, renders the greybox Diner built from
 * the SAME layout data the simulation uses, and reports real device numbers. Open it on the
 * target device and read the HUD.
 *
 * Nothing here is gameplay. There is no simulation running — that is Phase 2.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KITCHEN } from '@chaos-kitchen/sim';

const hud = document.getElementById('hud') as HTMLDivElement;

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1e24);

// Fixed 3/4 overhead camera per D-021 — no player camera control.
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
function frameKitchen() {
  const w = KITCHEN.width;
  const h = KITCHEN.height;
  camera.position.set(w / 2, Math.max(w, h) * 1.15, h / 2 + Math.max(w, h) * 0.62);
  camera.lookAt(w / 2, 0, h / 2);
}
frameKitchen();

scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(6, 14, 8);
scene.add(key);

// ---------------------------------------------------------------------------
// Greybox kitchen, driven by the simulation's own layout data
// ---------------------------------------------------------------------------

const STATION_COLOR: Record<string, number> = {
  crate: 0x8a8f98,
  counter: 0x3fb6a8, // cold prep = teal (S10.4 rule 2)
  grill: 0xe8622c,   // heat = warm orange
  pot: 0xe8622c,
  fryer: 0xf2c14e,   // fryer = yellow
  plating: 0x9ad14b,
  pass: 0x6fbf4a,    // pass = green
  sink: 0x4a90d9,    // sink = blue
  bin: 0x6b6b6b,
  extinguisher: 0xd94a4a,
  rush: 0xff3d81,
};

const kitchen = new THREE.Group();
{
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(KITCHEN.width, 0.2, KITCHEN.height),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.95 }),
  );
  floor.position.set(KITCHEN.width / 2, -0.1, KITCHEN.height / 2);
  kitchen.add(floor);

  for (const s of KITCHEN.stations) {
    const hx = s.half.x;
    const hy = s.half.y;
    const height = s.kind === 'counter' || s.kind === 'crate' ? 0.9 : 1.0;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(hx * 2, height, hy * 2),
      new THREE.MeshStandardMaterial({
        color: STATION_COLOR[s.kind] ?? 0x888888,
        roughness: 0.8,
      }),
    );
    m.position.set(s.pos.x, height / 2, s.pos.y);
    kitchen.add(m);
  }
  for (const w of KITCHEN.walls) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w.half.x * 2, 2.2, w.half.y * 2),
      new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.9 }),
    );
    m.position.set(w.x, 1.1, w.y);
    kitchen.add(m);
  }
}
scene.add(kitchen);

// ---------------------------------------------------------------------------
// Load the gremlin and spawn N of them
// ---------------------------------------------------------------------------

let gremlinCount = 4;
const gremlins: { root: THREE.Object3D; mixer: THREE.AnimationMixer }[] = [];
let loadMs = 0;
let triPerGremlin = 0;

async function loadGremlin() {
  const t0 = performance.now();
  const res = await fetch('/gremlin.glb');
  const buf = await res.arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(buf, '');
  loadMs = performance.now() - t0;

  const proto = gltf.scene;
  const anim = gltf.animations[0];
  let tris = 0;
  proto.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const g = mesh.geometry as THREE.BufferGeometry;
      tris += (g.index ? g.index.count : g.attributes.position!.count) / 3;
      mesh.material = new THREE.MeshStandardMaterial({ color: 0x7bd94e, roughness: 0.6, flatShading: true });
    }
  });
  triPerGremlin = tris;
  return { proto, anim };
}

function respawn(proto: THREE.Object3D, anim: THREE.AnimationClip | undefined) {
  for (const g of gremlins) scene.remove(g.root);
  gremlins.length = 0;
  for (let i = 0; i < gremlinCount; i++) {
    const root = proto.clone(true);
    const spawn = KITCHEN.spawns[i % KITCHEN.spawns.length]!;
    root.position.set(spawn.x, 0, spawn.y);
    root.rotation.y = Math.PI;
    scene.add(root);
    const mixer = new THREE.AnimationMixer(root);
    if (anim) mixer.clipAction(anim).play();
    gremlins.push({ root, mixer });
  }
}

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------

const frameTimes: number[] = [];
let last = performance.now();
let hudTimer = 0;
let current: { proto: THREE.Object3D; anim?: THREE.AnimationClip } | null = null;

function tick(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  frameTimes.push(now);
  while (frameTimes.length && frameTimes[0]! < now - 1000) frameTimes.shift();

  for (const g of gremlins) g.mixer.update(dt);

  // Cheap "chaos" stress: more gremlins, and a flickering light at high counts.
  renderer.render(scene, camera);

  hudTimer += dt;
  if (hudTimer > 0.4) {
    hudTimer = 0;
    drawHud();
  }
  requestAnimationFrame(tick);
}

function drawHud() {
  const fps = frameTimes.length;
  const info = renderer.info.render;
  const fpsClass = fps >= 55 ? 'good' : fps >= 30 ? '' : 'bad';
  const geo = renderer.info.memory;
  hud.innerHTML = `
    <b>CHAOS KITCHEN — Phase 1 performance harness</b><br />
    FPS <span class="${fpsClass}"><b>${fps}</b></span> &nbsp;
    frame <b>${(1000 / Math.max(fps, 1)).toFixed(1)} ms</b> &nbsp;
    glb load <b>${loadMs.toFixed(0)} ms</b><br />
    draw calls <b>${info.calls}</b> &nbsp; triangles <b>${info.triangles.toLocaleString()}</b> &nbsp;
    geometries <b>${geo.geometries}</b><br />
    gremlins <b>${gremlinCount}</b> &times; ${triPerGremlin} tris &nbsp;
    DPR <b>${renderer.getPixelRatio().toFixed(2)}</b><br />
    viewport <b>${window.innerWidth}&times;${window.innerHeight}</b><br />
    <button data-n="1">1</button><button data-n="4">4 players</button>
    <button data-n="8">8</button><button data-n="16">16 (stress)</button><br />
    <small>${navigator.userAgent.slice(0, 96)}</small><br />
    <small>Target: 60 FPS with 4 gremlins on a mid-range phone (R12).</small>
  `;
}

hud.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const n = t.dataset?.n;
  if (!n || !current) return;
  gremlinCount = Number(n);
  respawn(current.proto, current.anim);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameKitchen();
});

(async () => {
  try {
    const { proto, anim } = await loadGremlin();
    current = { proto, anim };
    respawn(proto, anim);
    requestAnimationFrame(tick);
  } catch (err) {
    hud.innerHTML = `<b class="bad">Failed to load gremlin.glb</b><br />${String(err)}`;
  }
})();
