// The Clover sanctum on the High Valley summit (CLOVER_SANCTUM_PLAN.md): the walk from the climb's arrival
// (north end, z -541) south along a winding rock path, between mossy standing stones and flower beds, to a
// clover-leaf plaza before the Sky Garden gateway (SUMMIT_DOOR). Pure layout data; rendering/cloverSanctuary.js
// draws it. Every model below is one the game already downloads (or the 13 KB fern), so it adds ~no load time.
import { SUMMIT_DOOR, SUMMIT_ARRIVAL } from './skyIsland.js';
import { CLOVER_SUMMIT_CHECKPOINT } from './cloverTerrain.js';

export const SANCTUM_FLOOR = 24;
export const PLAZA = Object.freeze({ x: SUMMIT_DOOR.x, z: SUMMIT_DOOR.z - 5.5, radius: 6.2 });
export const GATE = Object.freeze({ x: SUMMIT_DOOR.x, z: SUMMIT_DOOR.z, half: 4.4, rise: 3.2 }); // stone frame around the portal

// The walking line, north to south; stepping stones follow it, nothing solid may stand on it.
export const PATH = Object.freeze([[-2, -541], [1, -536], [0.6, -531], [3.4, -524], [3, -519], [1, -514], [2, PLAZA.z - PLAZA.radius + .6]]);

// Places a player must always reach freely: [x, z, radius] circles and [x0, z0, x1, z1] boxes.
export const KEEP_CLEAR = Object.freeze({
  circles: [
    [SUMMIT_ARRIVAL.x, SUMMIT_ARRIVAL.z, 2.2], // back from the Sky Garden
    [CLOVER_SUMMIT_CHECKPOINT.x, CLOVER_SUMMIT_CHECKPOINT.z, 2.2], // fall recovery
    [-7, -478.5, 3], // top of the north rock jumps (CLOVER_ASCENT_JUMPS)
  ],
  boxes: [
    [GATE.x - 3.75, GATE.z - 7, GATE.x + 3.75, GATE.z + 1.2], // the portal (3.7 m each side) and its approach
    [-22, -543, 4, -539], // arrival from the west climb
    [8, -530, 17, -526], [8, -494, 17, -490], // walkways to the east overlook
    [-9, -486, -4, -477], // from the rock jumps onto the summit
  ],
});

// Solid pieces: standing stones [x, z, height, lean], rune crystals at the plaza's leaf tips, trees, lanterns.
export const STONES = Object.freeze([
  [-3.4, -537, 2.2, .06], [6.6, -535.5, 1.5, -.08], [-3, -527.5, 2.9, -.05], [7.6, -522.5, 2.1, .07],
  [-2.8, -519, 1.7, .1], [6.8, -516, 2.6, -.04], [-3.8, -511.5, 1.3, .12], [24.2, -500.5, 1.6, -.06],
]);
export const CRYSTALS = Object.freeze([20, 160, 200, 340].map(deg => {
  const a = deg * Math.PI / 180; return [PLAZA.x + Math.cos(a) * (PLAZA.radius - .9), PLAZA.z + Math.sin(a) * (PLAZA.radius - .9)];
}));
export const TREES = Object.freeze([
  [-7.5, -538, 'CommonTree_2', 5.5], [10.5, -537, 'CommonTree_3', 6], [-8.5, -508, 'CommonTree_1', 5],
  [11.5, -510, 'Pine_2', 5], [-5, -489, 'Pine_1', 5], [11, -486, 'CommonTree_2', 5.5], [12, -521, 'Pine_1', 4.5],
]);
export const LANTERNS = Object.freeze([-1, 1].map(side => [GATE.x + side * (GATE.half + 1.4), GATE.z - 1.6]));
// The lookout stone at the east overlook, facing Heavenly Falls.
export const LOOKOUT = Object.freeze({ x: 26, z: -506, yaw: Math.PI / 2 });

// Soft dressing (no colliders): beds of flowers, clover and ferns around the stones and trees.
const BEDS = [
  [-4.5, -534, 'flowers'], [7.5, -532, 'clover'], [-4.6, -523, 'clover'], [8.6, -519, 'flowers'], [-4.4, -515, 'flowers'],
  [8, -512, 'clover'], [-7, -540, 'fern'], [8, -538.5, 'fern'], [-9, -512, 'fern'], [12, -506, 'fern'],
  [-6, -497, 'flowers'], [10, -497, 'flowers'], [-6.5, -485, 'clover'], [9, -483, 'flowers'], [22.6, -508, 'flowers'], [22.8, -502.5, 'clover'],
];
const BED_MODELS = {
  flowers: [['Flower_3_Group', .38], ['Flower_4_Group', .42], ['Bush_Common_Flowers', .75], ['Clover_1', .22], ['Flower_3_Group', .34]],
  clover: [['Clover_1', .24], ['Clover_2', .26], ['Clover_1', .2], ['Flower_4_Group', .36], ['Clover_2', .22], ['Bush_Common', .6]],
  fern: [['Fern_1', .9], ['Fern_1', .7], ['Mushroom_Common', .3], ['Clover_2', .24], ['Mushroom_Common', .22]],
};

/** Bed dressing, placed deterministically from hash(i, j) -> 0..1. (The stepping-stone path is a flat decal along PATH.) */
export function sanctumDressing(hash) {
  const items = []; // { model, x, z, height, yaw }
  BEDS.forEach(([cx, cz, kind], b) => BED_MODELS[kind].forEach(([model, height], i) => {
    const a = i * 2.4 + b, r = .5 + hash(i, b + 960) * 1.5;
    items.push({ model, x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, height, yaw: hash(i, b + 961) * Math.PI * 2 });
  }));
  return items;
}

/** Everything solid, as colliders { x, z, radius }. */
export function sanctumColliders() {
  return [
    ...STONES.map(([x, z]) => ({ x, z, radius: .75 })),
    ...CRYSTALS.map(([x, z]) => ({ x, z, radius: .45 })),
    ...TREES.map(([x, z]) => ({ x, z, radius: .85 })),
    ...LANTERNS.map(([x, z]) => ({ x, z, radius: .3 })),
    ...[-1, 1].map(side => ({ x: GATE.x + side * GATE.half, z: GATE.z, radius: .55 })), // the frame's pillars
    { x: LOOKOUT.x, z: LOOKOUT.z, radius: .9 },
  ];
}

/** True when (x, z) is somewhere the player must reach freely. */
export function keepClear(x, z, pad = 0) {
  if (KEEP_CLEAR.circles.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + pad)) return true;
  if (KEEP_CLEAR.boxes.some(([x0, z0, x1, z1]) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad)) return true;
  for (let i = 0; i < PATH.length - 1; i++) { // within 1.1 m of the walking line
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < 1.1 + pad) return true;
  }
  return false;
}
