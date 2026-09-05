/**
 * Procedural low-poly gremlin: geometry + skeleton + skin weights + a walk animation.
 *
 * This is the Phase 1 art-pipeline proof (D-021 containment measure 5). It demonstrates
 * that a *rigged, skinned, animated* character can be produced and exported to glTF without
 * a DCC tool in the loop — which is the part of the pipeline that actually threatens the
 * schedule for a 1-3 person team (R11).
 *
 * It is deliberately a GREYBOX character: correct proportions, correct silhouette, correct
 * rig, zero polish. Per §6.1, "placeholder does not mean ugly; it must already be readable"
 * — and per §10.2 the character must stay under ~1,500 triangles including attachments.
 */

import {
  mat4FromTranslation,
  mat4InvertRigid,
  writeGlb,
  type AnimChannel,
  type Bone,
  type GlbModel,
  type Quat,
  type Vec3,
} from './glb.js';

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

interface Part {
  positions: number[];
  normals: number[];
  indices: number[];
}

function sphere(cx: number, cy: number, cz: number, r: number, seg = 10, rings = 6, squash = 1): Part {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= seg; x++) {
      const u = x / seg;
      const theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      positions.push(cx + nx * r, cy + ny * r * squash, cz + nz * r);
      normals.push(nx, ny, nz);
    }
  }
  const row = seg + 1;
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < seg; x++) {
      const a = y * row + x;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, indices };
}

function box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): Part {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const faces: { n: Vec3; v: Vec3[] }[] = [
    { n: { x: 0, y: 0, z: 1 }, v: [{ x: -hx, y: -hy, z: hz }, { x: hx, y: -hy, z: hz }, { x: hx, y: hy, z: hz }, { x: -hx, y: hy, z: hz }] },
    { n: { x: 0, y: 0, z: -1 }, v: [{ x: hx, y: -hy, z: -hz }, { x: -hx, y: -hy, z: -hz }, { x: -hx, y: hy, z: -hz }, { x: hx, y: hy, z: -hz }] },
    { n: { x: 1, y: 0, z: 0 }, v: [{ x: hx, y: -hy, z: hz }, { x: hx, y: -hy, z: -hz }, { x: hx, y: hy, z: -hz }, { x: hx, y: hy, z: hz }] },
    { n: { x: -1, y: 0, z: 0 }, v: [{ x: -hx, y: -hy, z: -hz }, { x: -hx, y: -hy, z: hz }, { x: -hx, y: hy, z: hz }, { x: -hx, y: hy, z: -hz }] },
    { n: { x: 0, y: 1, z: 0 }, v: [{ x: -hx, y: hy, z: hz }, { x: hx, y: hy, z: hz }, { x: hx, y: hy, z: -hz }, { x: -hx, y: hy, z: -hz }] },
    { n: { x: 0, y: -1, z: 0 }, v: [{ x: -hx, y: -hy, z: -hz }, { x: hx, y: -hy, z: -hz }, { x: hx, y: -hy, z: hz }, { x: -hx, y: -hy, z: hz }] },
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const f of faces) {
    const base = positions.length / 3;
    for (const v of f.v) {
      positions.push(cx + v.x, cy + v.y, cz + v.z);
      normals.push(f.n.x, f.n.y, f.n.z);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

function merge(parts: Part[]): Part {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const p of parts) {
    const base = positions.length / 3;
    positions.push(...p.positions);
    normals.push(...p.normals);
    for (const i of p.indices) indices.push(i + base);
  }
  return { positions, normals, indices };
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/** Local transforms; world positions are accumulated for skin weighting. */
const BONES: Bone[] = [
  { name: 'root', translation: { x: 0, y: 0, z: 0 }, parent: -1 },
  { name: 'hips', translation: { x: 0, y: 0.35, z: 0 }, parent: 0 },
  { name: 'spine', translation: { x: 0, y: 0.27, z: 0 }, parent: 1 },
  { name: 'head', translation: { x: 0, y: 0.36, z: 0 }, parent: 2 },
  { name: 'armL', translation: { x: -0.36, y: 0.16, z: 0 }, parent: 2 },
  { name: 'armR', translation: { x: 0.36, y: 0.16, z: 0 }, parent: 2 },
  { name: 'legL', translation: { x: -0.16, y: 0, z: 0 }, parent: 1 },
  { name: 'legR', translation: { x: 0.16, y: 0, z: 0 }, parent: 1 },
];

function worldPositions(bones: Bone[]): Vec3[] {
  const world: Vec3[] = [];
  for (const b of bones) {
    const p = b.parent >= 0 ? world[b.parent]! : { x: 0, y: 0, z: 0 };
    world.push({ x: p.x + b.translation.x, y: p.y + b.translation.y, z: p.z + b.translation.z });
  }
  return world;
}

// ---------------------------------------------------------------------------
// Model assembly
// ---------------------------------------------------------------------------

export function buildGremlin(): GlbModel {
  const geo = merge([
    // torso
    sphere(0, 0.62, 0, 0.33, 12, 8, 1.05),
    // head — big, per S10.2 (~1:1 head to body)
    sphere(0, 1.03, 0, 0.29, 12, 8),
    // ears: the silhouette feature that distinguishes players at a glance
    sphere(-0.24, 1.24, 0, 0.1, 8, 5, 1.6),
    sphere(0.24, 1.24, 0, 0.1, 8, 5, 1.6),
    // eyes
    sphere(-0.11, 1.06, 0.24, 0.065, 8, 5),
    sphere(0.11, 1.06, 0.24, 0.065, 8, 5),
    // snout
    sphere(0, 0.96, 0.26, 0.09, 8, 5, 0.8),
    // arms
    box(-0.42, 0.6, 0, 0.14, 0.38, 0.14),
    box(0.42, 0.6, 0, 0.14, 0.38, 0.14),
    // legs
    box(-0.16, 0.17, 0, 0.17, 0.35, 0.17),
    box(0.16, 0.17, 0, 0.17, 0.35, 0.17),
    // feet
    box(-0.16, 0.05, 0.05, 0.19, 0.1, 0.26),
    box(0.16, 0.05, 0.05, 0.19, 0.1, 0.26),
  ]);

  const vertCount = geo.positions.length / 3;
  const world = worldPositions(BONES);

  // Rigid skinning: nearest bone wins. Cheap, and plenty for a chunky cartoon character.
  const joints = new Uint8Array(vertCount * 4);
  const weights = new Float32Array(vertCount * 4);
  for (let i = 0; i < vertCount; i++) {
    const x = geo.positions[i * 3]!;
    const y = geo.positions[i * 3 + 1]!;
    const z = geo.positions[i * 3 + 2]!;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let b = 0; b < world.length; b++) {
      const w = world[b]!;
      const d = (x - w.x) ** 2 + (y - w.y) ** 2 + (z - w.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    joints[i * 4] = best;
    weights[i * 4] = 1;
  }

  // Inverse bind matrices: bones are pure translations, so this is just -world.
  const ibm = new Float32Array(BONES.length * 16);
  for (let b = 0; b < BONES.length; b++) {
    const w = world[b]!;
    const inv = mat4InvertRigid(mat4FromTranslation(w));
    ibm.set(inv, b * 16);
  }

  const channels = walkAnimation();

  return {
    name: 'gremlin_greybox',
    mesh: {
      positions: new Float32Array(geo.positions),
      normals: new Float32Array(geo.normals),
      indices: new Uint16Array(geo.indices),
      joints,
      weights,
    },
    bones: BONES,
    inverseBindMatrices: ibm,
    animations: [{ name: 'walk', channels }],
  };
}

// --- animation -------------------------------------------------------------

function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const h = angle / 2;
  const s = Math.sin(h);
  const len = Math.hypot(axis.x, axis.y, axis.z) || 1;
  return { x: (axis.x / len) * s, y: (axis.y / len) * s, z: (axis.z / len) * s, w: Math.cos(h) };
}

function walkAnimation(): AnimChannel[] {
  const KEYS = 9;
  const DURATION = 1.0;
  const times = new Float32Array(KEYS);
  for (let i = 0; i < KEYS; i++) times[i] = (i / (KEYS - 1)) * DURATION;

  const boneIndex = (name: string) => BONES.findIndex((b) => b.name === name);

  // Hips bob: vertical translation, two cycles per loop.
  const hipsT = new Float32Array(KEYS * 3);
  for (let i = 0; i < KEYS; i++) {
    const t = i / (KEYS - 1);
    hipsT[i * 3] = 0;
    hipsT[i * 3 + 1] = 0.35 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.045;
    hipsT[i * 3 + 2] = 0;
  }

  const swing = (phase: number, amp: number, axis: Vec3) => {
    const vals = new Float32Array(KEYS * 4);
    for (let i = 0; i < KEYS; i++) {
      const t = i / (KEYS - 1);
      const q = quatFromAxisAngle(axis, Math.sin(t * Math.PI * 2 + phase) * amp);
      vals[i * 4] = q.x;
      vals[i * 4 + 1] = q.y;
      vals[i * 4 + 2] = q.z;
      vals[i * 4 + 3] = q.w;
    }
    return vals;
  };

  return [
    { bone: boneIndex('hips'), path: 'translation', times, values: hipsT },
    { bone: boneIndex('armL'), path: 'rotation', times, values: swing(0, 0.6, { x: 1, y: 0, z: 0 }) },
    { bone: boneIndex('armR'), path: 'rotation', times, values: swing(Math.PI, 0.6, { x: 1, y: 0, z: 0 }) },
    { bone: boneIndex('legL'), path: 'rotation', times, values: swing(Math.PI, 0.55, { x: 1, y: 0, z: 0 }) },
    { bone: boneIndex('legR'), path: 'rotation', times, values: swing(0, 0.55, { x: 1, y: 0, z: 0 }) },
  ];
}

export function triangleCount(m: GlbModel): number {
  return m.mesh.indices.length / 3;
}

export { writeGlb };
