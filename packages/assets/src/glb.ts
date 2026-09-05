/**
 * A minimal, dependency-free glTF 2.0 binary (.glb) writer.
 *
 * Why hand-rolled: the Phase 1 art-pipeline proof needs to demonstrate that a *rigged,
 * skinned, animated* character can be produced and loaded in the browser. Blender is not
 * available in this environment, so the mesh is generated procedurally instead — which for
 * a 1-3 person team is arguably the better pipeline anyway: versionable in git, diffable,
 * and a new cosmetic variant costs milliseconds rather than an artist's afternoon (R11).
 *
 * Supports exactly what we need: one skinned mesh, one skin, one animation, one buffer.
 */

export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }

export interface SkinnedMeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  joints: Uint8Array;   // 4 per vertex
  weights: Float32Array; // 4 per vertex
}

export interface Bone {
  name: string;
  translation: Vec3;
  /** Parent index, or -1. */
  parent: number;
}

export interface AnimChannel {
  bone: number;
  /** 'translation' | 'rotation' */
  path: 'translation' | 'rotation';
  times: Float32Array;
  /** 3 floats per keyframe for translation, 4 for rotation. */
  values: Float32Array;
}

export interface GlbModel {
  name: string;
  mesh: SkinnedMeshData;
  bones: Bone[];
  /** Inverse bind matrices, 16 floats (column-major) per bone. */
  inverseBindMatrices: Float32Array;
  animations: { name: string; channels: AnimChannel[] }[];
}

// ---------------------------------------------------------------------------
// mat4 helpers (column-major, matching glTF)
// ---------------------------------------------------------------------------

export function mat4FromTranslation(t: Vec3): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t.x, t.y, t.z, 1];
}

export function mat4InvertRigid(m: number[]): number[] {
  // For a rotation+translation matrix the inverse is [R^T | -R^T t].
  const r = [m[0]!, m[1]!, m[2]!, m[4]!, m[5]!, m[6]!, m[8]!, m[9]!, m[10]!];
  const t = [m[12]!, m[13]!, m[14]!];
  const rt = [r[0]!, r[3]!, r[6]!, r[1]!, r[4]!, r[7]!, r[2]!, r[5]!, r[8]!];
  const t0 = t[0]!, t1 = t[1]!, t2 = t[2]!;
  const nt = [
    -(rt[0]! * t0 + rt[3]! * t1 + rt[6]! * t2),
    -(rt[1]! * t0 + rt[4]! * t1 + rt[7]! * t2),
    -(rt[2]! * t0 + rt[5]! * t1 + rt[8]! * t2),
  ];
  return [
    rt[0]!, rt[1]!, rt[2]!, 0,
    rt[3]!, rt[4]!, rt[5]!, 0,
    rt[6]!, rt[7]!, rt[8]!, 0,
    nt[0]!, nt[1]!, nt[2]!, 1,
  ];
}

// ---------------------------------------------------------------------------
// Binary buffer assembly
// ---------------------------------------------------------------------------

class BufferBuilder {
  private chunks: Uint8Array[] = [];
  private byteLength = 0;

  add(data: ArrayBuffer, target?: number): { bufferView: number; byteOffset: number; byteLength: number } {
    // glTF requires 4-byte alignment for accessor offsets.
    const pad = (4 - (this.byteLength % 4)) % 4;
    if (pad) {
      this.chunks.push(new Uint8Array(pad));
      this.byteLength += pad;
    }
    const bytes = new Uint8Array(data);
    const byteOffset = this.byteLength;
    this.chunks.push(bytes);
    this.byteLength += bytes.byteLength;
    this.pendingViews.push({ byteOffset, byteLength: bytes.byteLength, target });
    return { bufferView: this.pendingViews.length - 1, byteOffset, byteLength: bytes.byteLength };
  }

  pendingViews: { byteOffset: number; byteLength: number; target?: number }[] = [];

  finish(): Uint8Array {
    const out = new Uint8Array(this.byteLength);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.byteLength;
    }
    // Pad the whole buffer to a 4-byte boundary.
    const pad = (4 - (out.byteLength % 4)) % 4;
    if (!pad) return out;
    const padded = new Uint8Array(out.byteLength + pad);
    padded.set(out);
    return padded;
  }
}

const COMPONENT_TYPE = {
  FLOAT: 5126,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_BYTE: 5121,
} as const;

function bounds(arr: Float32Array, stride: number): { min: number[]; max: number[] } {
  const min = new Array(stride).fill(Number.POSITIVE_INFINITY);
  const max = new Array(stride).fill(Number.NEGATIVE_INFINITY);
  for (let i = 0; i < arr.length; i += stride) {
    for (let c = 0; c < stride; c++) {
      const v = arr[i + c] as number;
      if (v < min[c]!) min[c] = v;
      if (v > max[c]!) max[c] = v;
    }
  }
  return { min, max };
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export function writeGlb(model: GlbModel): Uint8Array {
  const bb = new BufferBuilder();
  const accessors: Record<string, unknown>[] = [];
  const m = model.mesh;

  const addAccessor = (
    data: ArrayBuffer,
    componentType: number,
    type: string,
    count: number,
    withBounds = false,
    stride?: number,
    target?: number,
  ) => {
    const { bufferView } = bb.add(data, target);
    const acc: Record<string, unknown> = { bufferView, componentType, count, type };
    if (withBounds && stride) {
      const b = bounds(new Float32Array(data), stride);
      acc.min = b.min;
      acc.max = b.max;
    }
    accessors.push(acc);
    return accessors.length - 1;
  };

  const posAcc = addAccessor(m.positions.buffer as ArrayBuffer, COMPONENT_TYPE.FLOAT, 'VEC3', m.positions.length / 3, true, 3, 34962);
  const nrmAcc = addAccessor(m.normals.buffer as ArrayBuffer, COMPONENT_TYPE.FLOAT, 'VEC3', m.normals.length / 3, false, undefined, 34962);
  const jntAcc = addAccessor(m.joints.buffer as ArrayBuffer, COMPONENT_TYPE.UNSIGNED_BYTE, 'VEC4', m.joints.length / 4, false, undefined, 34962);
  const wgtAcc = addAccessor(m.weights.buffer as ArrayBuffer, COMPONENT_TYPE.FLOAT, 'VEC4', m.weights.length / 4, false, undefined, 34962);
  const idxAcc = addAccessor(m.indices.buffer as ArrayBuffer, COMPONENT_TYPE.UNSIGNED_SHORT, 'SCALAR', m.indices.length, false, undefined, 34963);
  const ibmAcc = addAccessor(
    model.inverseBindMatrices.buffer as ArrayBuffer,
    COMPONENT_TYPE.FLOAT,
    'MAT4',
    model.bones.length,
  );

  const animAccessors: { times: number; values: number }[] = [];
  for (const anim of model.animations) {
    for (const ch of anim.channels) {
      const stride = ch.path === 'translation' ? 3 : 4;
      const times = addAccessor(ch.times.buffer as ArrayBuffer, COMPONENT_TYPE.FLOAT, 'SCALAR', ch.times.length, true, 1);
      const values = addAccessor(
        ch.values.buffer as ArrayBuffer,
        COMPONENT_TYPE.FLOAT,
        ch.path === 'translation' ? 'VEC3' : 'VEC4',
        ch.values.length / stride,
        false,
      );
      animAccessors.push({ times, values });
    }
  }

  const buffer = bb.finish();

  // Node layout: one node per bone, then a mesh node that carries the skin.
  const nodes: Record<string, unknown>[] = model.bones.map((b) => ({
    name: b.name,
    translation: [b.translation.x, b.translation.y, b.translation.z],
    ...(b.parent >= 0 ? {} : {}),
  }));
  for (let i = 0; i < model.bones.length; i++) {
    const b = model.bones[i]!;
    if (b.parent >= 0) {
      const parent = nodes[b.parent] as { children?: number[] };
      parent.children = [...(parent.children ?? []), i];
    }
  }
  const meshNodeIndex = nodes.length;
  nodes.push({ name: `${model.name}_mesh`, mesh: 0, skin: 0 });
  const rootNodeIndex = nodes.length;
  const rootChildren = model.bones.map((b, i) => (b.parent < 0 ? i : -1)).filter((i) => i >= 0);
  nodes.push({ name: `${model.name}_root`, children: [...rootChildren, meshNodeIndex] });

  const gltf: Record<string, unknown> = {
    asset: { version: '2.0', generator: 'chaos-kitchen procedural pipeline (Phase 1)' },
    scene: 0,
    scenes: [{ name: model.name, nodes: [rootNodeIndex] }],
    nodes,
    meshes: [
      {
        name: model.name,
        primitives: [
          {
            attributes: { POSITION: posAcc, NORMAL: nrmAcc, JOINTS_0: jntAcc, WEIGHTS_0: wgtAcc },
            indices: idxAcc,
            mode: 4,
          },
        ],
      },
    ],
    skins: [{ name: `${model.name}_skin`, inverseBindMatrices: ibmAcc, joints: model.bones.map((_, i) => i), skeleton: 0 }],
    accessors,
    bufferViews: bb.pendingViews.map((v) => ({
      buffer: 0,
      byteOffset: v.byteOffset,
      byteLength: v.byteLength,
      ...(v.target ? { target: v.target } : {}),
    })),
    buffers: [{ byteLength: buffer.byteLength }],
  };

  let ai = 0;
  gltf.animations = model.animations.map((anim) => ({
    name: anim.name,
    samplers: anim.channels.map((ch) => {
      const a = animAccessors[ai++]!;
      return { input: a.times, output: a.values, interpolation: 'LINEAR' };
    }),
    channels: anim.channels.map((ch, ci) => ({
      sampler: ci,
      target: { node: ch.bone, path: ch.path },
    })),
  }));

  const jsonText = JSON.stringify(gltf);
  const jsonBytes = new TextEncoder().encode(jsonText);
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunk = new Uint8Array(jsonBytes.byteLength + jsonPad);
  jsonChunk.set(jsonBytes);
  for (let i = jsonBytes.byteLength; i < jsonChunk.byteLength; i++) jsonChunk[i] = 0x20;

  const binPad = (4 - (buffer.byteLength % 4)) % 4;
  const binChunk = new Uint8Array(buffer.byteLength + binPad);
  binChunk.set(buffer);

  const total = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  let o = 12;
  dv.setUint32(o, jsonChunk.byteLength, true);
  dv.setUint32(o + 4, 0x4e4f534a, true); // 'JSON'
  out.set(jsonChunk, o + 8);
  o += 8 + jsonChunk.byteLength;
  dv.setUint32(o, binChunk.byteLength, true);
  dv.setUint32(o + 4, 0x004e4942, true); // 'BIN\0'
  out.set(binChunk, o + 8);

  return out;
}
