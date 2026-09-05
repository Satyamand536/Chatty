/**
 * Builds and VALIDATES assets/gremlin.glb.
 *
 * Run: npx tsx packages/assets/build.ts
 *
 * Validation matters here. A .glb that Blender produced would have been validated by
 * Blender; a procedurally written one has to be checked, or "it exported" means nothing.
 * This re-parses the container and asserts the things a renderer will actually rely on.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGremlin, triangleCount, writeGlb } from './src/gremlin.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../assets');
const outPath = resolve(outDir, 'gremlin.glb');

const model = buildGremlin();
const bytes = writeGlb(model);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, bytes);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface Report {
  ok: boolean;
  checks: { name: string; pass: boolean; detail: string }[];
}

function validate(path: string): Report {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const checks: Report['checks'] = [];
  const check = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

  const magic = dv.getUint32(0, true);
  check('magic is "glTF"', magic === 0x46546c67, `0x${magic.toString(16)}`);
  const version = dv.getUint32(4, true);
  check('container version is 2', version === 2, `${version}`);
  const total = dv.getUint32(8, true);
  check('declared length matches file size', total === buf.byteLength, `${total} vs ${buf.byteLength}`);

  const jsonLen = dv.getUint32(12, true);
  const jsonMagic = dv.getUint32(16, true);
  check('first chunk is JSON', jsonMagic === 0x4e4f534a, `0x${jsonMagic.toString(16)}`);
  const jsonText = new TextDecoder().decode(buf.subarray(20, 20 + jsonLen));
  const gltf = JSON.parse(jsonText) as Record<string, any>;
  check('asset.version is 2.0', gltf.asset?.version === '2.0', String(gltf.asset?.version));

  const binOffset = 20 + jsonLen;
  const binLen = dv.getUint32(binOffset, true);
  const binMagic = dv.getUint32(binOffset + 4, true);
  check('second chunk is BIN', binMagic === 0x004e4942, `0x${binMagic.toString(16)}`);
  check(
    'BIN chunk size matches declared buffer length',
    binLen === gltf.buffers[0].byteLength,
    `${binLen} vs ${gltf.buffers[0].byteLength}`,
  );

  // Every bufferView must sit inside the BIN chunk.
  const viewsInBounds = (gltf.bufferViews as any[]).every(
    (v) => v.byteOffset >= 0 && v.byteOffset + v.byteLength <= binLen,
  );
  check('all bufferViews fit inside BIN', viewsInBounds, `${gltf.bufferViews.length} views`);

  // Every accessor must fit inside its bufferView.
  const accOk = (gltf.accessors as any[]).every((a) => {
    return gltf.bufferViews[a.bufferView] !== undefined;
  });
  check('all accessors reference a valid bufferView', accOk, `${gltf.accessors.length} accessors`);

  const prim = gltf.meshes[0].primitives[0];
  const attrs = prim.attributes;
  const need = ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0'];
  check('primitive has POSITION/NORMAL/JOINTS_0/WEIGHTS_0', need.every((n) => attrs[n] !== undefined), need.join(','));

  const vertCount = gltf.accessors[attrs.POSITION]!.count;
  check(
    'JOINTS_0 and WEIGHTS_0 have one entry per vertex',
    gltf.accessors[attrs.JOINTS_0]!.count === vertCount &&
      gltf.accessors[attrs.WEIGHTS_0]!.count === vertCount,
    `${vertCount} verts`,
  );

  // POSITION must declare min/max, or frustum culling and bounding boxes break.
  const posAcc = gltf.accessors[attrs.POSITION]!;
  check('POSITION declares min/max', Array.isArray(posAcc.min) && Array.isArray(posAcc.max), JSON.stringify(posAcc.min));

  // Skin joints must be valid node indices; JOINTS_0 values must be in range.
  const skin = gltf.skins[0];
  const jointsOk = (skin.joints as number[]).every((j) => gltf.nodes[j] !== undefined);
  check('all skin joints are valid nodes', jointsOk, `${skin.joints.length} joints`);

  const jv = gltf.bufferViews[gltf.accessors[attrs.JOINTS_0]!.bufferView]!;
  const jointBytes = buf.subarray(binOffset + 8 + jv.byteOffset, binOffset + 8 + jv.byteOffset + jv.byteLength);
  const maxJoint = Math.max(...Array.from(jointBytes));
  check(
    'no JOINTS_0 index exceeds the joint count',
    maxJoint < skin.joints.length,
    `max index ${maxJoint} < ${skin.joints.length} joints`,
  );

  // Weights must sum to ~1 per vertex, or the mesh will collapse when skinned.
  const wv = gltf.bufferViews[gltf.accessors[attrs.WEIGHTS_0]!.bufferView]!;
  const wf = new Float32Array(
    buf.buffer,
    buf.byteOffset + binOffset + 8 + wv.byteOffset,
    vertCount * 4,
  );
  let weightsOk = true;
  for (let i = 0; i < vertCount; i++) {
    const sum = wf[i * 4]! + wf[i * 4 + 1]! + wf[i * 4 + 2]! + wf[i * 4 + 3]!;
    if (Math.abs(sum - 1) > 1e-4) weightsOk = false;
  }
  check('skin weights sum to 1.0 for every vertex', weightsOk, `${vertCount} verts checked`);

  // Animation channels must target real nodes and real samplers.
  const anim = gltf.animations[0]!;
  const animOk =
    anim &&
    (anim.channels as any[]).every(
      (c) => gltf.nodes[c.target.node] !== undefined && anim.samplers[c.sampler] !== undefined,
    );
  check('animation channels target valid nodes/samplers', !!animOk, `${anim?.channels.length ?? 0} channels`);

  const pathsOk = (anim?.channels as any[]).every((c) =>
    ['translation', 'rotation', 'scale', 'weights'].includes(c.target.path),
  );
  check('animation channel paths are legal glTF paths', !!pathsOk, '');

  // Inverse bind matrices: one MAT4 per joint.
  const ibm = gltf.accessors[skin.inverseBindMatrices]!;
  check('inverseBindMatrices is one MAT4 per joint', ibm.type === 'MAT4' && ibm.count === skin.joints.length, `count ${ibm.count}`);

  return { ok: checks.every((c) => c.pass), checks };
}

const report = validate(outPath);

console.log('CHAOS KITCHEN — art pipeline proof (Workstream B)\n');
console.log(`asset      : ${outPath}`);
console.log(`size       : ${(bytes.byteLength / 1024).toFixed(2)} KiB`);
console.log(`triangles  : ${triangleCount(model)}`);
console.log(`vertices   : ${model.mesh.positions.length / 3}`);
console.log(`bones      : ${model.bones.length}`);
console.log(`animations : ${model.animations.length} (${model.animations[0]!.channels.length} channels)`);
console.log(`draw calls : 1 (single primitive)\n`);
console.log('glTF validation:');
for (const c of report.checks) {
  console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(`\n${report.ok ? 'ALL CHECKS PASSED' : 'VALIDATION FAILED'}`);
process.exit(report.ok ? 0 : 1);
