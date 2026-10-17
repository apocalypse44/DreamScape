import { castleVolumes } from './spadeCastle.js';
import { storyVolumes } from './spadeStory.js';
// Authored westward route. u travels into Spade; v is world z.
export const SPADE_GATE = Object.freeze({ x: -344, z: 0 });
export const spadePosition = (u, v = 0) => ({ x: SPADE_GATE.x - u, z: v });
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function spadeArea(x, z, pad = 0) {
  return x < -310 + pad && x > -570 - pad && Math.abs(z) < 102 + pad;
}
export function spadeHeight(x) {
  return 1.5 + 14.5 * smooth(58, 112, -344 - x);
}
export const spadeStableArea = (x,z) => x>=-550&&x<=-330&&Math.abs(z)<=85;
export function spadeGround(x, z, original) {
  if (!spadeArea(x, z)) return original;
  const edge = smooth(-570, -550, x) * (1 - smooth(-330, -310, x)) * (1 - smooth(85, 102, Math.abs(z)));
  let target = spadeHeight(x);
  const plazaDistance=Math.hypot(x+447,z+48);
  if(plazaDistance<7.5)target+=(spadeHeight(-447)-target)*(1-smooth(6.4,7.5,plazaDistance));
  // Houses sit on level pads; the avenue retains its continuous ascent. Blend
  // outside each foundation rather than letting a slope cut through the walls.
  if (x < -357 && x > -440 && Math.abs(z) > 15 && Math.abs(z) < 72) {
    for (const h of SPADE_HOUSES) {
      const dx = Math.abs(x + 344 + h.u) - h.depth / 2;
      const dz = Math.abs(z - h.v) - h.width / 2;
      if (dx > 2.5 || dz > 2.5) continue;
      const weight = (1 - smooth(0.5, 2.5, dx)) * (1 - smooth(0.5, 2.5, dz));
      target += (spadeHeight(-344 - h.u) - target) * weight;
    }
  }
  return original + (target - original) * edge;
}
export const SPADE_HOUSES = Array.from({ length: 5 }, (_, row) =>
  [-1, 1].flatMap(side => [0, 1, 2].map(col => ({
    u: 22 + row * 16 + (col % 2) * 3,
    v: side * (23 + col * 19),
    width: 10 + (row + col) % 3, depth: 10 + col % 2 * 2,
    height: 5 + (row + col) % 3,
    refuge: row===0&&side===-1&&col===0,
  })))).flat();

// Explicit wall volumes are shared by movement and rendering. Main door stays open.
export const SPADE_WALLS = [
  { u: 150, v: -16, width: 54, depth: 2, height: 20 },
  { u: 150, v: 16, width: 54, depth: 2, height: 20 },
  { u: 177, v: 0, width: 2, depth: 34, height: 20 },
  { u: 123, v: -11, width: 2, depth: 10, height: 20 },
  { u: 123, v: 11, width: 2, depth: 10, height: 20 },
];
export const SPADE_TOWERS = [
  { u: 0, v: -13, width: 9, height: 17 }, { u: 0, v: 13, width: 9, height: 17 },
  ...[-1, 1].flatMap(side => [
    { u: 121, v: side * 27, width: 12, height: 24 },
    { u: 172, v: side * 27, width: 14, height: 32 },
  ]),
];
export const SPADE_WINGS = [-1, 1].flatMap(side => [
  { u: 150, v: side * 32, width: 54, depth: 32, height: 20, bottom: 16 },
  { u: 121, v: side * 21, width: 12, depth: 10, height: 20, bottom: 16 },
  { u: 177, v: side * 24, width: 4, depth: 18, height: 20, bottom: 16 },
]);
// Physical dimensions after rotation. Rendering and collision share these
// curtain modules so decorative battlements cannot extend through empty space.
export const SPADE_CURTAIN_MODULES = [-1,1].flatMap(side=>
  [20,32,44,56,68].map(v=>({u:114,v:side*v,width:4,depth:12,bottom:15,height:5,name:'curtain-wall'})));
export const SPADE_RETAINING = [-46,46].map(v=>
  ({u:115,v,width:5,depth:66,bottom:1.5,height:15,name:'retaining-wall'}));
export const SPADE_FIXTURES = [
  { name: 'chest', u: 142, v: -10, width: 2, depth: 1.3, height: 1.5, bottom: 16.12 },
  ...[-8, 0, 8].map(v => ({ name: 'pedestal', u: 171, v, width: 2.4, depth: 2.4, height: 2.5, bottom: 16.12 })),
  ...Array.from({ length: 4 }, (_, i) => [-11, 11].map(v =>
    ({ name: 'pillar', u: 132 + i * 12, v: Math.sign(v)*5.8, width: 1.4, depth: 1.4, height: 19, bottom: 16.12 }))).flat(),
  ...Array.from({ length: 6 }, (_, i) => [-10, 10].map(v =>
    ({ name: 'lantern', u: 10 + i * 20, v, width: 0.5, depth: 0.5, height: 4.4 }))).flat(),
];
export const SPADE_MOUNTAINS = Array.from({ length: 12 }, (_, i) => ({
  u: 105 + i * 9, v: (i % 2 ? -1 : 1) * (116 + i % 3 * 7),
  height: 36 + i % 4 * 12, radiusX: 27, radiusZ: 25, rotation: i, bottom: -4,
}));
export function spadeMountainColliders() {
  // Closed mountain footprints are deliberately impassable, including when the
  // character takes very small steps that would otherwise climb any mesh ramp.
  return SPADE_MOUNTAINS.map(m => ({ ...spadePosition(m.u, m.v), radius: Math.max(m.radiusX, m.radiusZ) + 0.2, maxY: m.bottom + m.height }));
}
export function spadeMountainVolume(m) {
  const at = spadePosition(m.u, m.v), c = Math.cos(m.rotation), s = Math.sin(m.rotation);
  // The rendered seven-sided mountain and its support surface use the same
  // polygon. Every cross-section shrinks linearly toward the peak.
  const vertices = Array.from({ length: 7 }, (_, i) => {
    const x = Math.sin(i * Math.PI * 2 / 7) * m.radiusX, z = Math.cos(i * Math.PI * 2 / 7) * m.radiusZ;
    return { x: x * c + z * s, z: z * c - x * s };
  });
  const radial = (x, z) => Math.max(0, ...vertices.map((a, i) => {
    const b = vertices[(i + 1) % vertices.length], dx = b.x - a.x, dz = b.z - a.z;
    return (dx * (z - at.z) - dz * (x - at.x)) / (dx * a.z - dz * a.x);
  }));
  return { ...at, width: 56, depth: 56, bottom: m.bottom, top: m.bottom + m.height, solid: true,
    contains: (x, z, pad = 0) => radial(x, z) <= 1 + pad / 24,
    topAt: (x, z) => m.bottom + m.height * (1 - radial(x, z)) };
}
export function spadeVolumes() {
  const boxes = [...SPADE_WALLS, ...SPADE_WINGS, ...SPADE_FIXTURES, ...SPADE_CURTAIN_MODULES, ...SPADE_RETAINING,
    ...SPADE_TOWERS.map(t => ({ ...t, depth: t.width, height: t.height + 15 })),
    ...SPADE_HOUSES.filter(h=>!h.refuge).map(h => ({ ...h, width: h.depth, depth: h.width, bottom: spadeHeight(-344 - h.u) - 3, height: h.height + 7 })),
    { u: 0, v: 0, width: 3, depth: 19, bottom: 14, height: 3 },
    { u: 123, v: 0, width: 2, depth: 12, bottom: 27, height: 9 },
    { u: 150, v: 0, width: 56, depth: 35, bottom: 36, height: 0.5 },
    { u: 149, v: 0, width: 78, depth: 102, bottom: 14.5, height: 1.62 },
    { u:165,v:0,width:19,depth:20,bottom:36.5,height:40,name:'central-keep' },
  ].map(p => {
    const at = spadePosition(p.u, p.v), bottom = p.bottom ?? spadeHeight(at.x);
    return { ...at, name: p.name, width: p.width, depth: p.depth, bottom, top: bottom + p.height, solid: true };
  });
  return [...boxes, ...SPADE_MOUNTAINS.map(spadeMountainVolume), ...castleVolumes(), ...storyVolumes(spadeHeight)];
}

export function spadeColliders(platforms = spadeVolumes()) {
  const colliders = spadeMountainColliders();
  for (const p of platforms) {
    // Upper decks and rails already have exact rectangular collision. Covering
    // them with circles would seal their stair openings and atrium below.
    if (p.topAt || p.name==='gallery' || p.name==='balustrade' || p.top < spadeHeight(p.x) + 0.3) continue;
    const wide = p.width >= p.depth, length = wide ? p.width : p.depth;
    const radius = Math.min(p.width, p.depth) / 2;
    // Lintels and roofs must keep their lower bound. Otherwise their navigation
    // circles become invisible walls reaching down across the open entrance.
    const vertical = p.bottom > spadeHeight(p.x) + 0.6 ? { minY: p.bottom } : {};
    for (let t = -length / 2 + radius; t <= length / 2 - radius; t += Math.max(1, radius)) {
      colliders.push({ x: p.x + (wide ? t : 0), z: p.z + (wide ? 0 : t), radius, maxY: p.top, ...vertical });
    }
  }
  return colliders;
}
