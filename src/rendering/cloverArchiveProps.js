// Model dressing for Clover's Living Road: the Rootkeeper Archive as a royal library (Fantasy Props
// and Medieval Village kits) and clover, flowers and mushrooms on the root landings (Nature kit).
// All Quaternius CC0, one style. Purely visual: colliders for anything walkable stay in cloverCampaign.js.
import { loadModel } from './models.js';
import { ROOT_LANDINGS, ROOT_HEADINGS, ROOT_OBSTACLES } from '../models/cloverGrowth.js';
import { SKY_SECRET } from '../models/skyIsland.js';

const KITS = {
  props: 'assets/Fantasy Props MegaKit[Standard]/Exports/glTF/',
  village: 'assets/Medieval Village MegaKit[Standard]/glTF/',
  nature: 'assets/Stylized Nature MegaKit[Standard]/glTF/',
};
// Kit models face +z (south here; north is -z). Yaw that turns a model's front toward:
const SOUTH = 0, NORTH = Math.PI, EAST = Math.PI / 2, WEST = -Math.PI / 2;

// [kit, model, x, y (feet), z, yaw, height in metres]
// The hall's walls are at z -410 (south) and -431 (north), x -42 (west) and -26 (east); inner faces 0.3 m in.
const ARCHIVE = [
  ['props', 'Bookcase_2', -40.8, 12, -410.6, NORTH, 2.6], ['props', 'Bookcase_2', -39.3, 12, -410.6, NORTH, 2.6],
  ['props', 'Bookcase_2', -37.8, 12, -410.6, NORTH, 2.6], ['props', 'Shelf_Arch', -41.5, 12, -413, EAST, 1.7],
  ['props', 'BookStand', -37.6, 12, -412.6, WEST + .4, 1.45], ['props', 'Book_Stack_1', -36.3, 12, -411, NORTH, .3],
  ['props', 'Book_Stack_2', -41.4, 12, -416.2, EAST, .32], ['props', 'Scroll_2', -41.3, 12.05, -417.1, EAST, .08],
  ['props', 'Chandelier', -34, 16.6, -420.5, SOUTH, 1.8],
  // Models are centred on their bounds, so the 1.3 m-deep lantern sits half its depth off the column face.
  ['props', 'Lantern_Wall', -25, 15.6, -410, EAST, 1.3], ['props', 'Lantern_Wall', -25, 15.6, -431, EAST, 1.3],
  ['props', 'Vase_2', -41.2, 12, -429.6, SOUTH, .6],
  // Flowering planters (the junction's blocking stones, drawn in cloverCampaign.js; soil at 12.61).
  ['nature', 'Bush_Common_Flowers', -34, 12.61, -412, SOUTH, 1.1], ['nature', 'Flower_4_Group', -33.4, 12.61, -428, SOUTH, 1],
  ['nature', 'Clover_2', -35.6, 12.61, -411.3, SOUTH, .5], ['nature', 'Clover_2', -32.6, 12.61, -413, EAST, .5],
  ['nature', 'Clover_1', -35.4, 12.61, -429, NORTH, .5], ['nature', 'Clover_2', -34.8, 12.61, -426.6, WEST, .5],
  // Vines climbing the outside faces of the four ivory corner columns and the south wall.
  ['village', 'Prop_Vine5', -42, 12, -409.1, SOUTH, 4.2], ['village', 'Prop_Vine5', -26, 12, -409.1, SOUTH, 3.6],
  ['village', 'Prop_Vine5', -42, 12, -431.9, NORTH, 3.8], ['village', 'Prop_Vine5', -26, 12, -431.9, NORTH, 4.4],
  ['village', 'Prop_Vine2', -40.6, 15.4, -409.6, SOUTH, 2.6],
];
// Each outer landing is a small Clover growth shrine with an ivory pillar on every diagonal, clear of
// the roads (they leave through edge midpoints), the guide marks and the guide boards.
export function shrinePillars(landing) {
  const dx = Math.min(landing.width / 2 - 1.6, 7), dz = Math.min(landing.depth / 2 - 1.6, 8);
  return [-1, 1].flatMap(sx => [-1, 1].map(sz => ({ x: landing.x + sx * dx, z: landing.z + sz * dz })));
}
const headingDir = h => ({ x: Math.round(Math.sin(h * Math.PI / 2)), z: -Math.round(Math.cos(h * Math.PI / 2)) });
export const ARCH_SPAN = 2.9; // pillar centres either side of a 3.8 m road: 1 m beyond its edge
// Where the shrines put their solid pieces (pure, so movement tests can use the same colliders):
// diagonal pillars, an arch at every edge a road crosses, and a briar thicket on every wrong exit
// (the edge facing a blocking stone that lies beyond the landing).
export function shrineLayout() {
  const pillars = [], arches = [], thickets = [];
  ROOT_LANDINGS.forEach((landing, j) => {
    const edge = h => {
      const d = headingDir(h), half = Math.abs(d.x) > .5 ? landing.width / 2 : landing.depth / 2;
      return { x: landing.x + d.x * (half - .5), z: landing.z + d.z * (half - .5), dx: d.x, dz: d.z, floor: landing.top };
    };
    if (j > 0) {
      pillars.push(...shrinePillars(landing).map(p => ({ ...p, floor: landing.top })));
      arches.push(edge((ROOT_HEADINGS[j - 1] + 2) % 4));
      if (j < ROOT_HEADINGS.length) arches.push(edge(ROOT_HEADINGS[j]));
    }
    for (const stone of ROOT_OBSTACLES.filter(o => o.junction === j)) {
      const ox = stone.x - landing.x, oz = stone.z - landing.z;
      if (Math.abs(ox) < landing.width / 2 && Math.abs(oz) < landing.depth / 2) continue; // on the landing: a planter
      const h = Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 1 : 3) : (oz > 0 ? 2 : 0), e = edge(h);
      // The hedge spans the edge: an east/west edge runs along z, a north/south edge along x.
      thickets.push({ x: landing.x + e.dx * (landing.width / 2 - .7), z: landing.z + e.dz * (landing.depth / 2 - .7),
        ax: Math.abs(e.dz), az: Math.abs(e.dx), floor: landing.top });
    }
  });
  // The Sky Garden chest perch is a shrine too: pillars on its diagonals, inside the octagon's edge.
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) pillars.push({ x: SKY_SECRET.x + sx * 3.25, z: SKY_SECRET.z + sz * 3.25, floor: SKY_SECRET.top });
  const archPillars = arches.flatMap(a => [-1, 1].map(side => ({ x: a.x - a.dz * side * ARCH_SPAN, z: a.z + a.dx * side * ARCH_SPAN, floor: a.floor })));
  const colliders = [
    ...pillars.map(p => ({ x: p.x, z: p.z, radius: .45, minY: p.floor, maxY: p.floor + 4 })),
    ...archPillars.map(p => ({ x: p.x, z: p.z, radius: .35, minY: p.floor, maxY: p.floor + 4.4 })),
    ...thickets.map(t => ({ x: t.x, z: t.z, radius: 2, minY: t.floor, maxY: t.floor + 2.2 })),
  ];
  return { pillars, arches, archPillars, thickets, colliders };
}
// Clover, flowers and mushrooms ring each pillar's base, on the side away from the landing centre.
// The Archive landing is the library floor, so it has none.
const FLORA = ['Clover_1', 'Clover_2', 'Flower_3_Group', 'Flower_4_Group', 'Mushroom_Common', 'Clover_2', 'Bush_Common_Flowers'];
const FLORA_HEIGHT = { Clover_1: .55, Clover_2: .6, Flower_3_Group: .9, Flower_4_Group: 1, Mushroom_Common: .35, Bush_Common_Flowers: 1.1 };
export function floraPlacements(hash) {
  const out = [];
  ROOT_LANDINGS.slice(1).forEach((p, l) => shrinePillars(p).forEach((pillar, c) => {
    const ox = Math.sign(pillar.x - p.x), oz = Math.sign(pillar.z - p.z);
    for (const [fx, fz] of [[.85, .15], [.15, .85], [.7, .7]]) {
      const h = hash(l * 17 + c * 5, fx * 10 + fz), model = FLORA[Math.floor(h * FLORA.length) % FLORA.length];
      out.push(['nature', model, pillar.x + ox * fx, p.top, pillar.z + oz * fz, h * Math.PI * 2, FLORA_HEIGHT[model]]);
    }
  }));
  return out;
}

// Load each model once, then clone it for every placement. Returns when all are placed.
function place(root, placements) {
  const byModel = new Map();
  for (const p of placements) { const key = KITS[p[0]] + p[1]; byModel.set(key, [...(byModel.get(key) ?? []), p]); }
  return Promise.all([...byModel].map(([url, list]) => loadModel(encodeURI(`${url}.gltf`), 1).then(({ object }) => {
    for (const [, , x, y, z, yaw, height] of list) {
      const copy = object.clone(true); copy.position.set(x, y, z); copy.rotation.y = yaw; copy.scale.setScalar(height);
      root.add(copy);
    }
  }).catch(error => console.warn(`Clover archive: ${url} unavailable.`, error))));
}

// An emerald tiled roof: the kit's round-tile roof, recoloured and stretched over the 16 x 21 m hall.
function roof(root) {
  return loadModel(encodeURI(`${KITS.village}Roof_RoundTiles_8x12.gltf`), 1).then(({ object, size }) => {
    object.traverse(child => {
      if (!child.isMesh) return;
      child.material = child.material.clone();
      child.material.map = null; child.material.color.set(0x3f9a5a); // terracotta tint would mix to brown
    });
    object.scale.set(17.4 / size.x, 4.2, 23.4 / size.z); object.position.set(-34, 18.5, -420.5);
    root.add(object);
  }).catch(error => console.warn('Clover archive roof unavailable.', error));
}

export function dressLivingRoad({ root, world, onReady }) {
  Promise.all([place(root, [...ARCHIVE, ...floraPlacements(world.hash)]), roof(root)]).then(() => onReady?.(root));
}
