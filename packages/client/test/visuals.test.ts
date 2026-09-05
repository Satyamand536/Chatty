import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { KITCHEN } from '@chaos-kitchen/sim';
import {
  buildKitchen,
  cookTint,
  ITEM_COLOR,
  makeHighlight,
  makeItemMesh,
  makePlayerRing,
  STATION_COLOR,
} from '../src/visuals.js';

/**
 * Headless scene-graph tests.
 *
 * These do NOT prove the game looks right — there is no browser here, so no pixels are
 * produced. What they DO prove is that the scene is *built correctly*: every station
 * exists, sits where the simulation thinks it sits, and carries the colour the art
 * direction assigned to its type. That is a large share of the "is it readable?" question,
 * and it was previously being left entirely to eyeballs that do not exist in this
 * environment.
 */

/** Stations are nested one level down (each is its own Group), so traverse. */
function stationMeshes(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name.startsWith('station:')) out.push(o as THREE.Mesh);
  });
  return out;
}

describe('the greybox kitchen is built from the simulation layout', () => {
  const group = buildKitchen();
  const meshes = stationMeshes(group);

  it('creates one mesh per station', () => {
    expect(meshes).toHaveLength(KITCHEN.stations.length);
  });

  it('places every station exactly where the simulation places it', () => {
    // If these drift apart, the player sees a counter they cannot interact with.
    for (const s of KITCHEN.stations) {
      const found = meshes.find((m) => m.name === `station:${s.id}`);
      expect(found, `station ${s.id} is rendered at its sim position`).toBeDefined();
    }
  });

  it('sizes every station to match its collision half-extents', () => {
    for (const s of KITCHEN.stations) {
      const m = meshes.find((x) => x.name === `station:${s.id}`)!;
      expect(m.position.x).toBeCloseTo(s.pos.x, 6);
      expect(m.position.z).toBeCloseTo(s.pos.y, 6);
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      const w = bb.max.x - bb.min.x;
      const d = bb.max.z - bb.min.z;
      expect(w).toBeCloseTo(s.half.x * 2, 5);
      expect(d).toBeCloseTo(s.half.y * 2, 5);
    }
  });

  it('renders a floor that covers the whole play field', () => {
    const floors = group.children.filter(
      (c): c is THREE.Mesh =>
        (c as THREE.Mesh).isMesh &&
        (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry &&
        Math.abs(c.position.y + 0.1) < 1e-6,
    ) as THREE.Mesh[];
    expect(floors.length).toBeGreaterThan(0);
    const f = floors[0]!;
    f.geometry.computeBoundingBox();
    const bb = f.geometry.boundingBox!;
    expect(bb.max.x - bb.min.x).toBeGreaterThanOrEqual(KITCHEN.width);
    expect(bb.max.z - bb.min.z).toBeGreaterThanOrEqual(KITCHEN.height);
  });

  it('renders the walls', () => {
    const tall = group.children.filter(
      (c): c is THREE.Mesh =>
        (c as THREE.Mesh).isMesh &&
        (c as THREE.Mesh).geometry instanceof THREE.BoxGeometry &&
        c.position.y > 1.0 &&
        c.position.y < 1.2,
    );
    expect(tall.length).toBeGreaterThanOrEqual(KITCHEN.walls.length);
  });
});

describe('S10.4 rule 2 — one hue per station type, and types are distinguishable', () => {
  it('assigns a colour to every station kind used in the layout', () => {
    const kinds = new Set(KITCHEN.stations.map((s) => s.kind));
    const missing = [...kinds].filter((k) => STATION_COLOR[k] === undefined);
    expect(missing).toEqual([]);
  });

  it('gives heat stations a shared warm hue, and cold stations a distinct one', () => {
    // grill/pot/fryer are all "heat" but the fryer is separately coloured by design.
    expect(STATION_COLOR.grill).toBe(STATION_COLOR.pot);
    expect(STATION_COLOR.fryer).not.toBe(STATION_COLOR.grill);
    expect(STATION_COLOR.counter).not.toBe(STATION_COLOR.grill);
  });

  it('keeps the six functional groups visually distinct', () => {
    const groups = [
      STATION_COLOR.counter, // cold prep
      STATION_COLOR.grill,   // heat
      STATION_COLOR.fryer,   // fry
      STATION_COLOR.sink,    // water
      STATION_COLOR.pass,    // serve
      STATION_COLOR.rush,    // chaos button
    ];
    expect(new Set(groups).size).toBe(groups.length);
  });

  it('separates those groups by luminance too, not hue alone', () => {
    // S10.4 rule 3: never encode meaning by colour alone. ~8% of men have red-green
    // deficiency, and this is a game about fire and burnt food. Hue-only separation fails
    // them; luminance separation survives. This is a proxy check, not a full CVD sim.
    const lum = (hex: number) => {
      const c = new THREE.Color(hex);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    const pairs: [number, number, string][] = [
      [STATION_COLOR.grill!, STATION_COLOR.counter!, 'grill vs cold prep'],
      [STATION_COLOR.grill!, STATION_COLOR.pass!, 'grill vs pass'],
      [STATION_COLOR.fryer!, STATION_COLOR.counter!, 'fryer vs cold prep'],
    ];
    const tooClose = pairs.filter(([a, b]) => Math.abs(lum(a) - lum(b)) < 0.12);
    expect(
      tooClose.map(([a, b, name]) => `${name} (${Math.abs(lum(a) - lum(b)).toFixed(3)})`),
    ).toEqual([]);
  });
});

describe('S10.4 rule 4 — food state readable at a glance', () => {
  it('burnt is near-black, cooked is warm, raw is neutral', () => {
    const burnt = new THREE.Color(cookTint('burnt'));
    const cooked = new THREE.Color(cookTint('cooked'));
    const raw = new THREE.Color(cookTint('raw'));
    expect(burnt.r + burnt.g + burnt.b).toBeLessThan(0.5);
    expect(cooked.r).toBeGreaterThan(cooked.b); // warm, not blue
    expect(raw.getHexString()).toBe('ffffff');
  });

  it('has a colour for every item the simulation can produce', () => {
    // Anything missing renders grey, which is how a state silently becomes invisible.
    const produced = [
      'bun', 'patty', 'lettuce', 'tomato', 'potato',
      'lettuce_chopped', 'tomato_chopped', 'potato_sliced',
      'patty_cooked', 'soup_cooked', 'fries_cooked',
      'plate', 'extinguisher', 'burnt_food',
    ];
    expect(produced.filter((d) => ITEM_COLOR[d] === undefined)).toEqual([]);
  });

  it('builds a mesh for each of those items', () => {
    for (const def of Object.keys(ITEM_COLOR)) {
      const m = makeItemMesh(def);
      expect(m.isMesh).toBe(true);
      expect(m.geometry.attributes.position.count).toBeGreaterThan(0);
    }
  });
});

describe('player and target markers', () => {
  it('the Act-target highlight is a flat ring (readable from above)', () => {
    const h = makeHighlight();
    expect(h.geometry.type).toBe('RingGeometry');
    // Laid flat on the floor: rotated -90 degrees about X.
    expect(h.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('the player ground ring is flat and distinct from the target ring', () => {
    const r = makePlayerRing(0x7bd94e);
    expect(r.geometry.type).toBe('RingGeometry');
    expect(r.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    const h = makeHighlight();
    const rc = (r.material as THREE.MeshBasicMaterial).color.getHexString();
    const hc = (h.material as THREE.MeshBasicMaterial).color.getHexString();
    expect(rc).not.toBe(hc);
  });
});
