/**
 * Greybox visuals for the playable prototype (Phase 2).
 *
 * Deliberately ugly-but-readable. Per §6.1: "placeholder does not mean ugly; it must
 * already be readable." So this obeys the §10.4 rules that are cheap now and expensive to
 * retrofit later:
 *   - one hue per station type, constant across kitchens (rule 2)
 *   - food state readable at a glance: raw pale, cooked golden, burnt black (rule 4)
 *   - the player is the highest-contrast thing on screen (rule 6)
 *   - the Act target is highlighted BEFORE you press (rule from §5.2, now a requirement)
 */

import * as THREE from 'three';
import { KITCHEN, type StationDef } from '@chaos-kitchen/sim';

export const STATION_COLOR: Record<string, number> = {
  crate: 0x8a8f98,
  counter: 0x1c6f66, // cold prep = dark teal (kept dark so it separates from heat by luminance, not hue alone)
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

/** Base colour per item definition. */
export const ITEM_COLOR: Record<string, number> = {
  bun: 0xd9a05b,
  patty: 0xa8443a,
  lettuce: 0x7ec850,
  tomato: 0xd94a4a,
  potato: 0xc9a227,
  lettuce_chopped: 0x9adb6a,
  tomato_chopped: 0xe8625c,
  potato_sliced: 0xe0c04a,
  patty_cooked: 0x8a4a2a,
  soup_cooked: 0xe8a33d,
  fries_cooked: 0xf2c14e,
  plate: 0xe8e8e8,
  extinguisher: 0xd94a4a,
  burnt_food: 0x1c1c1c,
};

/** Cook-state tint, applied on top of the base colour. §10.4 rule 4. */
export function cookTint(state: 'raw' | 'cooked' | 'burnt'): number {
  if (state === 'burnt') return 0x1c1c1c;
  if (state === 'cooked') return 0xffcf6a;
  return 0xffffff;
}

export function buildKitchen(): THREE.Group {
  const g = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(KITCHEN.width, 0.2, KITCHEN.height),
    new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.95 }),
  );
  floor.position.set(KITCHEN.width / 2, -0.1, KITCHEN.height / 2);
  g.add(floor);

  // Checkerboard tiles: cheap, and gives the floor readable scale for movement.
  const tile = new THREE.BoxGeometry(0.96, 0.02, 0.96);
  for (let x = 0; x < KITCHEN.width; x++) {
    for (let y = 0; y < KITCHEN.height; y++) {
      if ((x + y) % 2 !== 0) continue;
      const m = new THREE.Mesh(tile, new THREE.MeshStandardMaterial({ color: 0x333944, roughness: 0.9 }));
      m.position.set(x + 0.5, 0.01, y + 0.5);
      g.add(m);
    }
  }

  for (const s of KITCHEN.stations) {
    g.add(buildStation(s));
  }
  for (const w of KITCHEN.walls) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w.half.x * 2, 2.2, w.half.y * 2),
      new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.9 }),
    );
    m.position.set(w.x, 1.1, w.y);
    g.add(m);
  }
  return g;
}

function buildStation(s: StationDef): THREE.Group {
  const g = new THREE.Group();
  const height = s.kind === 'counter' || s.kind === 'crate' ? 0.9 : 1.0;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s.half.x * 2, height, s.half.y * 2),
    new THREE.MeshStandardMaterial({ color: STATION_COLOR[s.kind] ?? 0x888888, roughness: 0.8 }),
  );
  body.name = `station:${s.id}`;
  body.position.set(s.pos.x, height / 2, s.pos.y);
  g.add(body);
  return g;
}

/** A flat ring used to mark the station the Act button will hit. */
export function makeHighlight(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.58, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  return m;
}

/** Ground ring under a player. In 3D this is not polish — see §10.2. */
export function makePlayerRing(color: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.44, 24),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}

/** Simple stand-in mesh for an item. */
export function makeItemMesh(def: string): THREE.Mesh {
  const base = ITEM_COLOR[def] ?? 0xcccccc;
  const round =
    def === 'bun' || def === 'tomato' || def === 'potato' || def === 'soup_cooked' || def === 'plate';
  const geo = round
    ? new THREE.SphereGeometry(0.22, 10, 7, 0, Math.PI * 2, 0, def === 'plate' ? Math.PI / 2 : Math.PI)
    : new THREE.BoxGeometry(0.32, 0.2, 0.32);
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: base, roughness: 0.65, flatShading: true }),
  );
}

/** Small floating chip showing a plate's assembled components. */
export function makeComponentChips(): THREE.Group {
  return new THREE.Group();
}
