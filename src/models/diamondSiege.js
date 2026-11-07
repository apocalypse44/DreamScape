// Diamond · Siege Yard and Barracks (DIAMOND_KINGDOM_TERRAIN.md, Phase 4). Pure logic, no Three.js.
// The kingdom's war machine, sabotaged by the workers: intact engines beside wrecked ones in a
// palisaded yard west of the causeway, and the royal Barracks with a Triad sentry post east of it.
// Positions are in the kingdom's u/v frame; facing is where the model's front points.
import { SIEGE_YARD, BARRACKS } from './diamond.js';

const KENNEY = 'kenney_castle-kit/Models/GLB format/';
const HEX = 'KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/';
const PROPS = 'Fantasy Props MegaKit[Standard]/Exports/glTF/';
// [path under assets/, u, v, height, facing ('+u' | '-u' | '+v' | '-v'), collider radius, flags]
// track: an intact ballista that turns to follow the player in chaos.
export const SIEGE_ITEMS = [
  [`${KENNEY}siege-ballista.glb`, 112, 25, 2, '+v', 1.3, { track: true }],
  [`${KENNEY}siege-ballista.glb`, 120, 25, 2, '+v', 1.3, { track: true }],
  [`${KENNEY}siege-ballista-demolished.glb`, 128, 25, 1.4, '+v', 1.3],
  [`${KENNEY}siege-catapult.glb`, 138, 26, 3, '+v', 1.9],
  [`${KENNEY}siege-catapult-demolished.glb`, 145, 34, 2, '-u', 1.9],
  [`${KENNEY}siege-trebuchet.glb`, 113, 38, 7, '+v', 3],
  [`${KENNEY}siege-trebuchet-demolished.glb`, 124, 38, 4, '+v', 3],
  [`${KENNEY}siege-ram.glb`, 136, 42, 2.4, '-u', 1.7],
  [`${HEX}buildings/neutral/building_scaffolding.gltf`, 143, 46, 5, '-u', 2.3],
  [`${KENNEY}siege-ram-demolished.glb`, 134, 51, 1.6, '+u', 1.7],
  [`${KENNEY}siege-tower-demolished.glb`, 118, 54, 6, '+v', 3],
  [`${KENNEY}siege-tower.glb`, 108, 50, 9, '+v', 2.6],
  // Practice targets the engines face, and the yard's stores.
  ...[[110, 59.6], [114, 59.6], [118, 59.6]].map(([u, v]) => [`${PROPS}Dummy.gltf`, u, v, 1.8, '-v', 0.45]),
  ...[[147.5, 20], [147.5, 24]].map(([u, v]) => [`${HEX}decoration/props/target.gltf`, u, v, 1.6, '-u', 0.6]),
  [`${HEX}decoration/props/weaponrack.gltf`, 106.5, 19, 1.6, '+v', 0.7],
  [`${HEX}decoration/props/bucket_arrows.gltf`, 108.4, 19, 0.8, '+v', 0.4],
  [`${HEX}decoration/props/resource_lumber.gltf`, 128, 47, 1, '+u', 1.1],
  [`${HEX}decoration/props/crate_long_A.gltf`, 146.5, 41, 0.9, '+v', 0.8],
  [`${HEX}decoration/props/crate_B_big.gltf`, 146.5, 55, 1, '+v', 0.6],
  [`${HEX}decoration/props/crate_open.gltf`, 126, 56, 0.9, '+v', 0.6],
];
export const BARRACKS_ITEMS = [
  [`${HEX}buildings/yellow/building_barracks_yellow.gltf`, 128, -35, 6, '+v', 3.6],
  [`${HEX}buildings/yellow/building_barracks_yellow.gltf`, 141, -35, 6, '+v', 3.6],
  [`${HEX}buildings/yellow/building_archeryrange_yellow.gltf`, 127, -23, 4, '+v', 3.2],
  [`${HEX}buildings/red/building_tower_A_red.gltf`, 144, -22, 9, '+v', 2.2, { triad: true }],
  [`${HEX}decoration/props/weaponrack.gltf`, 134.5, -27, 1.6, '+v', 0.7],
  [`${HEX}decoration/props/crate_A_big.gltf`, 136.5, -25.5, 1, '+v', 0.6],
  [`${HEX}decoration/props/barrel.gltf`, 133, -24.5, 1, '+v', 0.5],
];
// Gold Diamond flags at both compound gates; violet Triad flags at the sentry post.
export const FLAGS = [
  [SIEGE_YARD.gate - 4, SIEGE_YARD.v0 - 0.8, 'gold'], [SIEGE_YARD.gate + 4, SIEGE_YARD.v0 - 0.8, 'gold'],
  [BARRACKS.gate - 4, BARRACKS.v1 + 0.8, 'gold'], [BARRACKS.gate + 4, BARRACKS.v1 + 0.8, 'gold'],
  [140.5, -19.5, 'triad'], [147, -26, 'triad'],
];
export const GATE_HALF = 3;
const STEP = 1;

// Perimeter points of a compound, with a gate gap on the side facing the causeway road (v near 0).
export function perimeter(zone, gateSide) {
  const { u0, u1, v0, v1, gate } = zone, out = [];
  const edge = (a, b, gateEdge) => {
    const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP);
    for (let s = 0; s < n; s++) {
      const u = a[0] + (b[0] - a[0]) * s / n, v = a[1] + (b[1] - a[1]) * s / n;
      if (gateEdge && Math.abs(u - gate) < GATE_HALF) continue;
      out.push({ u, v });
    }
  };
  edge([u0, v0], [u1, v0], gateSide === 'v0'); edge([u1, v0], [u1, v1]);
  edge([u1, v1], [u0, v1], gateSide === 'v1'); edge([u0, v1], [u0, v0]);
  return out;
}

export function siegeLayout(kingdom) {
  const place = list => list.map(([path, u, v, height, facing, radius, flags = {}]) => ({ path, u, v, height, facing, radius, ...flags, ...kingdom.at(u, v) }));
  return {
    yard: place(SIEGE_ITEMS), barracks: place(BARRACKS_ITEMS),
    palisade: perimeter(SIEGE_YARD, 'v0').map(p => ({ ...p, ...kingdom.at(p.u, p.v) })),
    wall: perimeter(BARRACKS, 'v1').map(p => ({ ...p, ...kingdom.at(p.u, p.v) })),
    flags: FLAGS.map(([u, v, kind]) => ({ u, v, kind, ...kingdom.at(u, v) })),
  };
}
