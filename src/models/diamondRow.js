// Diamond · Artificers' Row (DIAMOND_KINGDOM_TERRAIN.md, Phase 3). Pure logic, no Three.js.
// A paved street west of the quarry: four open-front workshops (forge, cutting, storage, armoury),
// each hiding one of the relay's conduit fragments, and Orin's Artificers' Hall at the street's end,
// an enclosed hall with a forge and the Connector Study Wall that teaches the relay's tile rules.
// Positions are in the kingdom's u/v frame (createDiamondKingdom).
import { makeTile, hasSide, opposite, TILE_COUNT, DIR_NAMES } from './diamondWfc.js';

export const STREET = { v: 55, u0: 28, u1: 82 };
export const SHOP = { w: 8, d: 6.5, h: 3.4 };            // w along the street (u), d back from it (v)
// face: +1 when the open front faces +v (shop on the quarry side of the street), -1 otherwise.
export const SHOPS = [
  { trade: 'forge', u: 31, v: 45.5, face: 1 },
  { trade: 'cutting', u: 59, v: 45.5, face: 1 },
  { trade: 'storage', u: 33, v: 64.5, face: -1 },
  { trade: 'armoury', u: 59, v: 64.5, face: -1 },
];
export const HALL = { u0: 82, u1: 98, v0: 46, v1: 64, h: 7, door: 3.4 };   // door in the u0 wall, on the street
export const STUDY = { u: HALL.u1 - 0.35, v: 55, width: 8, height: 4, reach: 4.5 }; // panel on the back wall
const WALL_STEP = 0.8, WALL_R = 0.45;

// A fragment rests at the back of each workshop, on its bench.
export const fragmentSpot = shop => ({ u: shop.u, v: shop.v - shop.face * (SHOP.d / 2 - 1.6) });

// Points along a straight wall (u/v), for circle colliders.
function wallPoints(a, b, skip = () => false) {
  const out = [], length = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(length / WALL_STEP));
  for (let s = 0; s <= n; s++) {
    const u = a[0] + (b[0] - a[0]) * s / n, v = a[1] + (b[1] - a[1]) * s / n;
    if (!skip(u, v)) out.push({ u, v });
  }
  return out;
}

export function shopWalls(shop) {
  const { w, d } = SHOP, back = shop.v - shop.face * d / 2, front = shop.v + shop.face * (d / 2 - 0.4);
  return [
    ...wallPoints([shop.u - w / 2, back], [shop.u + w / 2, back]),
    ...wallPoints([shop.u - w / 2, back], [shop.u - w / 2, front]),
    ...wallPoints([shop.u + w / 2, back], [shop.u + w / 2, front]),
  ];
}

export function hallWalls() {
  const { u0, u1, v0, v1, door } = HALL;
  const inDoor = (u, v) => Math.abs(v - STREET.v) < door / 2 + WALL_R;
  return [
    ...wallPoints([u0, v0], [u0, v1], inDoor), ...wallPoints([u1, v0], [u1, v1]),
    ...wallPoints([u0, v0], [u1, v0]), ...wallPoints([u0, v1], [u1, v1]),
  ];
}

// kingdom: createDiamondKingdom(gate).
export function createRow(kingdom) {
  const toWorld = p => ({ ...kingdom.at(p.u, p.v), u: p.u, v: p.v });
  const colliders = [...SHOPS.flatMap(shopWalls), ...hallWalls()].map(p => ({ ...kingdom.at(p.u, p.v), radius: WALL_R }));
  return {
    shops: SHOPS.map(s => ({ ...s, ...kingdom.at(s.u, s.v), fragment: toWorld(fragmentSpot(s)) })),
    fragments: SHOPS.map(s => toWorld(fragmentSpot(s))),
    colliders,
    insideHall(x, z) { const { u, v } = kingdom.local(x, z); return u > HALL.u0 && u < HALL.u1 && v > HALL.v0 && v < HALL.v1; },
    nearStudy(x, z) { const { u, v } = kingdom.local(x, z); return Math.hypot(u - STUDY.u, v - STUDY.v) < STUDY.reach && u < HALL.u1; },
  };
}

// The Connector Study Wall: one page per conduit shape, then how the relay fills itself.
// For each side of the centre tile, `good` is a neighbour that may sit there (arm meets arm, blank
// meets blank: the solver's only adjacency rule) and `bad` is one that may not.
const SHAPES = ['end', 'straight', 'corner', 'tee', 'cross'];
export const STUDY_PAGES = SHAPES.length + 1;
export function studyPage(index) {
  const i = ((index % STUDY_PAGES) + STUDY_PAGES) % STUDY_PAGES;
  if (i === SHAPES.length) return {
    title: 'HOW THE RELAY FILLS ITSELF',
    lines: ['Every fitted fragment removes the shapes its neighbours can no longer hold.',
      'The relay then fills the socket with the fewest shapes left (it glows gold) first.',
      'If no shape is left anywhere, it jams: lift a fragment with X and try another way.'],
  };
  const type = SHAPES[i], centre = makeTile(type, 0);
  const pick = (d, ok, offset) => {
    for (let k = 0; k < TILE_COUNT; k++) {
      const t = (k + offset) % TILE_COUNT;
      if (t && (hasSide(t, opposite(d)) === hasSide(centre, d)) === ok) return t;
    }
    return 0;
  };
  return {
    title: `${type.toUpperCase()} · ${[0, 1, 2, 3].filter(d => hasSide(centre, d)).map(d => DIR_NAMES[d]).join(' ')}`,
    centre,
    sides: [0, 1, 2, 3].map(d => ({ dir: d, good: pick(d, true, d * 3 + i * 5), bad: pick(d, false, d * 5 + i * 3) })),
    lines: ['An arm must meet an arm. A blank side must meet a blank side.', 'Press E for the next shape.'],
  };
}
