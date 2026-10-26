// Briar vines for the Living Road, after Captain Charlotte's thorn magic in Black Clover: the walkable
// road is drawn as braided vines with twisting handrails, thorns, blue roses and four-leaf clover
// leaves, and the junctions' wrong exits are sealed by thorn thickets. Purely visual: collision stays
// on the model's road slabs, so the puzzle and movement are unchanged.
import { visibleRoadSegments } from './cloverRoadLayout.js';
import { cloverShapes } from './kingdomGates.js';

const DECK_TOP = 12, RAIL_HEIGHT = .85;
const up = new THREE.Vector3(0, 1, 0), along = new THREE.Vector3(), dummy = new THREE.Object3D();
const shades = [0x2f6a2c, 0x3b7d33, 0x2a5a27, 0x467f36].map(c => new THREE.Color(c));

// Four instanced layers sharing one write cursor each. Colours are set for every slot up front: an
// InstancedMesh compiled before its first setColorAt ignores instance colours (leaves rendered white).
function vineSet(root, { pieces, thorns, roses, leaves }) {
  const make = (geometry, material, count, colour) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    for (let i = 0; i < count; i++) mesh.setColorAt(i, colour);
    mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true; root.add(mesh);
    return mesh;
  };
  const leafGeometry = new THREE.ShapeGeometry(cloverShapes(1)); leafGeometry.rotateX(-Math.PI / 2);
  const layers = {
    piece: make(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshStandardMaterial({ roughness: .8 }), pieces, shades[0]),
    thorn: make(new THREE.ConeGeometry(1, 1, 4), new THREE.MeshStandardMaterial({ color: 0x1f3a19, roughness: .9 }), thorns, new THREE.Color(0xffffff)),
    rose: make(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, emissive: 0x0b1a4a }), roses, new THREE.Color(0x3d64d8)),
    leaf: make(leafGeometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), leaves, new THREE.Color(0x67c95a)),
  };
  const used = { piece: 0, thorn: 0, rose: 0, leaf: 0 };
  const write = (layer, colour) => {
    const mesh = layers[layer];
    if (used[layer] >= mesh.instanceMatrix.count) return;
    dummy.updateMatrix(); mesh.setMatrixAt(used[layer], dummy.matrix);
    if (colour) mesh.setColorAt(used[layer], colour);
    used[layer]++;
  };
  return {
    // A vine piece between two points.
    piece(a, b, radius, shade = 0) {
      along.set(b.x - a.x, b.y - a.y, b.z - a.z); const length = along.length();
      if (length < .01) return;
      dummy.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      dummy.quaternion.setFromUnitVectors(up, along.normalize()); dummy.scale.set(radius, length, radius);
      write('piece', shades[shade % shades.length]);
    },
    // A thorn at p pointing along (dx, dy, dz).
    thorn(p, dx, dy, dz, size = .2) {
      along.set(dx, dy, dz).normalize(); dummy.position.set(p.x + along.x * size / 2, p.y + along.y * size / 2, p.z + along.z * size / 2);
      dummy.quaternion.setFromUnitVectors(up, along); dummy.scale.set(size * .22, size, size * .22); write('thorn');
    },
    rose(p, size = .17, h = 0) {
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(h * 3, h * 7, h * 5); dummy.scale.set(size, size * .75, size); write('rose');
    },
    leaf(p, size, h, gold = false) {
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set((h - .5) * .9, h * Math.PI * 2, 0); dummy.scale.setScalar(size);
      write('leaf', gold ? leafGold : leafGreen);
    },
    begin() { for (const k in used) used[k] = 0; },
    end() {
      for (const k in layers) {
        const mesh = layers[k]; mesh.count = used[k]; mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    get count() { return used.piece + used.thorn + used.rose + used.leaf; },
  };
}
const leafGreen = new THREE.Color(0x67c95a), leafGold = new THREE.Color(0xe8d26a);

// One visible road run: a deck of braided vines just under the walking top, twisting handrails that
// rise from both ends, vine posts tying deck to rail, thorns, roses and clover leaves.
// options: top (walking height), deck (strand count), spacing, rail (rail offset from the centre line).
function run(road, hash, segment, { top: DECK_TOP = 12, deck: DECK = 7, spacing: DECK_SPACING = .52, rail: RAIL_OFFSET = 1.95 } = {}) {
  const dx = segment.to.x - segment.from.x, dz = segment.to.z - segment.from.z, length = Math.hypot(dx, dz);
  if (length < .2) return;
  const ux = dx / length, uz = dz / length, nx = -uz, nz = ux, seed = segment.from.x * 3 + segment.from.z;
  const at = (s, offset, y) => ({ x: segment.from.x + ux * s + nx * offset, y, z: segment.from.z + uz * s + nz * offset });
  const steps = Math.max(2, Math.ceil(length / .8)), ds = length / steps;
  for (let k = 0; k < DECK; k++) {
    const base = (k - (DECK - 1) / 2) * DECK_SPACING, radius = .19 + hash(seed, k) * .05;
    const deck = s => at(s, base + Math.sin(s * 1.4 + k * 1.7) * .1, DECK_TOP - radius + .02 + Math.sin(s * 2.2 + k * 2.3) * .05);
    for (let i = 0; i < steps; i++) road.piece(deck(i * ds), deck((i + 1) * ds), radius, k);
  }
  // Rails dip into the deck at both ends so the road reads as grown from each landing.
  const lift = s => Math.min(1, s / 1.6, (length - s) / 1.6);
  for (const side of [-1, 1]) for (const phase of [0, Math.PI]) {
    const rail = s => at(s, side * (RAIL_OFFSET + Math.cos(s * 1.3 + phase) * .14),
      DECK_TOP - .05 + lift(s) * (RAIL_HEIGHT + Math.sin(s * 1.3 + phase) * .14));
    for (let i = 0; i < steps; i++) road.piece(rail(i * ds), rail((i + 1) * ds), .1, phase ? 3 : 1);
    if (phase) continue;
    for (let s = .4; s < length; s += .6) {
      const p = rail(s), h = hash(seed + side, s * 10);
      road.thorn(p, nx * side + (h - .5) * .6, .55 + h * .4, ux * (h - .5), .18 + h * .1);
    }
    for (let s = 1.2 + (side > 0 ? 1.2 : 0); s < length - .6; s += 2.4) {
      const p = rail(s), h = hash(seed - side, s * 7);
      road.rose({ x: p.x, y: p.y + .1, z: p.z }, .15 + h * .06, h);
      road.leaf({ x: p.x + ux * .35, y: p.y + .05, z: p.z + uz * .35 }, .3, h, h > .8);
    }
    for (let s = .6; s < length; s += 1.2) {
      const p = rail(s), h = hash(seed * side, s * 5);
      road.leaf({ x: p.x + nx * side * .12, y: p.y - .08, z: p.z + nz * side * .12 }, .26 + h * .1, h, h > .85);
    }
    // Vine posts curl from the deck edge up to the rail every 3 m.
    for (let s = 1.5; s < length - 1; s += 3) {
      const top = rail(s), arc = [0, .35, .7, 1].map(t => at(s + Math.sin(t * Math.PI) * .25, side * (RAIL_OFFSET - .25 + t * .25), DECK_TOP - .05 + (top.y - DECK_TOP + .05) * t));
      for (let i = 0; i < 3; i++) road.piece(arc[i], arc[i + 1], .08, 2);
    }
  }
}

export function createVineRoad({ root, world }) {
  const road = vineSet(root, { pieces: 1500, thorns: 320, roses: 90, leaves: 280 });
  const hedge = vineSet(root, { pieces: 420, thorns: 200, roses: 40, leaves: 60 });
  const hash = (a, b) => world.hash(a, b);
  hedge.begin();

  return {
    // roads: committed and growing backbone runs; branches: the L-system's decorative d segments.
    draw(roads, branches) {
      road.begin();
      for (const segment of roads.flatMap(s => visibleRoadSegments(s))) run(road, hash, segment);
      for (const b of branches) {
        road.piece(b.from, b.to, .07, 2);
        const h = hash(b.to.x * 3, b.to.z * 3);
        if (h > .72) road.rose({ x: b.to.x, y: b.to.y + .08, z: b.to.z }, .13, h);
        else road.leaf({ x: b.to.x, y: b.to.y + .05, z: b.to.z }, .35 + h * .2, h, h > .6);
      }
      road.end();
    },
    // A thorn thicket sealing a landing edge: overlapping briar arches across `width`, centred at
    // `centre` on the floor, spanning along (ax, az). Static; call before the first frame.
    thicket(centre, ax, az, width = 4.4) {
      const seed = centre.x * 7 + centre.z;
      for (let i = 0; i < 11; i++) {
        const h = hash(seed, i), a = (h - .5) * width, b = a + (hash(seed, i + 30) - .5) * width * .9;
        const height = .9 + hash(seed, i + 60) * 1.1, out = (hash(seed, i + 90) - .5) * .9;
        const point = t => ({ x: centre.x + ax * (a + (b - a) * t) - az * out, y: DECK_TOP + Math.sin(t * Math.PI) * height, z: centre.z + az * (a + (b - a) * t) + ax * out });
        for (let j = 0; j < 7; j++) hedge.piece(point(j / 7), point((j + 1) / 7), .08 + h * .06, i);
        for (let j = 1; j < 7; j++) {
          const p = point(j / 7), t = hash(seed + i, j);
          hedge.thorn(p, (t - .5), .4 + t * .5, (hash(seed - i, j) - .5), .16 + t * .1);
        }
        if (h > .45) hedge.rose({ ...point(.5), y: point(.5).y + .08 }, .14 + h * .05, h);
        if (h < .3) hedge.leaf({ ...point(.3), y: point(.3).y + .04 }, .3, h);
      }
      hedge.end();
    },
    clear() { road.begin(); road.end(); },
    get count() { return road.count; },
  };
}

// Static briar decoration for other Clover places: a vine bridge between two points and briars
// hanging from a cliff rim, with thorns, blue roses and clover leaves. Call done() once placed.
export function createVineDecor({ root, world, pieces = 900, thorns = 260, roses = 70, leaves = 120 }) {
  const set = vineSet(root, { pieces, thorns, roses, leaves }), hash = (a, b) => world.hash(a, b);
  set.begin();
  return {
    bridge(from, to, options) { run(set, hash, { from, to }, options); },
    // A briar hanging from rim point (x, y, z), leaning outward along (ox, oz), `length` metres long.
    hang(x, y, z, ox, oz, length, seed = 0) {
      const steps = Math.max(3, Math.ceil(length / .6)), point = t => {
        const sway = Math.sin(t * 4 + seed) * .25;
        return { x: x + ox * (.35 + t * .5) + oz * sway, y: y - t * length, z: z + oz * (.35 + t * .5) - ox * sway };
      };
      for (let i = 0; i < steps; i++) set.piece(point(i / steps), point((i + 1) / steps), .09 - i / steps * .04, i + seed);
      for (let i = 1; i < steps; i += 2) { const p = point(i / steps), h = hash(seed, i); set.thorn(p, ox + (h - .5), -.2, oz - (h - .5), .15); }
      const h = hash(x, z + seed);
      if (h > .35) set.rose(point(.55 + h * .3), .14, h);
      set.leaf(point(.25), .28, h, h > .8);
    },
    done() { set.end(); },
  };
}
