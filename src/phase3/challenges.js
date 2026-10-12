// 3.4: each ember is its own challenge.
//   course : at the end of a parkour course   (positions from Phase 2)
//   chasm  : on the far side of a chasm        (positions from Phase 2)
//   hound  : carried by the fleeing hound      (drops it if you come close CALMLY)
import { THREE } from './deps.js';
import { CHAOS_CALM } from './config.js';

export const EMBER_DEFS = [
  { id: 0, type: 'course' },
  { id: 1, type: 'chasm' },
  { id: 2, type: 'hound' },
];

// Where each ember goes. `spots` comes from Phase 2 when ready:
//   spots = { course: Vector3, chasm: Vector3 }
// Until then we use seeded placeholder points 45-70 m from the Crossing.
export function emberPositions(rng, terrainHeight, houndPos, spots = {}) {
  const placeholder = (angle) => {
    const r = 45 + rng() * 25;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    return new THREE.Vector3(x, terrainHeight(x, z), z);
  };
  const base = rng() * Math.PI * 2;
  return EMBER_DEFS.map((def, i) => {
    if (def.type === 'hound') return houndPos.clone();
    return spots[def.type]?.clone() ?? placeholder(base + i * 2.1);
  });
}

// Decide what the hound does with the ember it carries this frame.
//   'flee' : player close and NOT calm -> hound runs away (your hound code moves it)
//   'drop' : player close and calm     -> hound stops and drops the ember
//   'keep' : otherwise
export function houndEmberRule(playerPos, houndPos, chaos) {
  const d = Math.hypot(playerPos.x - houndPos.x, playerPos.z - houndPos.z);
  if (d < 3 && chaos < CHAOS_CALM) return 'drop';
  if (d < 12 && chaos >= CHAOS_CALM) return 'flee';
  return 'keep';
}
