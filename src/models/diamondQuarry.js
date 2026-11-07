// Diamond · the Shatterglass Quarry: a stepped open pit around the relay board, with a haul ramp
// cut toward the kingdom gate. Pure logic, no Three.js. The pit is fixed ground: chaos never
// reshapes it, so the relay, Orin and the fragments stay where the quest put them.
//
// Profile (distance r from the relay centre):  floor r < 11 · bench 1 r 13–18.4 · bench 2 r 20.4–24.5
// · rim r ≥ 26.5, blending back into the natural land by r = 34.5. Each wall is a 2 m smoothstep.

export const QUARRY = {
  levels: [-6, -3.5, -1, 1.5],  // floor, bench 1, bench 2, rim (world y)
  edges: [11, 18.4, 24.5],        // outer radius of the floor and each bench
  wall: 2,                      // metres each wall takes to climb to the next level
  blend: 8,                     // metres beyond the rim to return to natural ground
  ramp: { start: 9, end: 28, half: 2.2, soft: 1.5 }, // along the gate direction, from the centre
};
export const QUARRY_RIM = QUARRY.edges.at(-1) + QUARRY.wall;
export const QUARRY_OUTER = QUARRY_RIM + QUARRY.blend;

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Pit height by radius alone (no ramp).
export function pitHeight(r) {
  const { levels, edges, wall } = QUARRY;
  let y = levels[0];
  for (let i = 0; i < edges.length; i++) y += (levels[i + 1] - levels[i]) * smooth(edges[i], edges[i] + wall, r);
  return y;
}

// center: the relay centre { x, z }. gate: the kingdom gate { x, z } (the ramp climbs toward it).
export function createQuarry(center, gate) {
  const d = Math.hypot(gate.x - center.x, gate.z - center.z) || 1;
  const ux = (gate.x - center.x) / d, uz = (gate.z - center.z) / d;
  const { levels, ramp } = QUARRY;
  // u: metres from the centre toward the gate; v: metres across.
  const local = (x, z) => { const dx = x - center.x, dz = z - center.z; return { u: dx * ux + dz * uz, v: -dx * uz + dz * ux, r: Math.hypot(dx, dz) }; };

  function pit(x, z) {
    const { u, v, r } = local(x, z);
    let y = pitHeight(r);
    if (u > ramp.start - ramp.soft && u < ramp.end + ramp.soft) {
      const k = Math.max(0, Math.min(1, (u - ramp.start) / (ramp.end - ramp.start)));
      const rampY = levels[0] + (levels.at(-1) - levels[0]) * k;
      const across = 1 - smooth(ramp.half, ramp.half + ramp.soft, Math.abs(v));
      const ends = smooth(ramp.start - ramp.soft, ramp.start, u) * (1 - smooth(ramp.end, ramp.end + ramp.soft, u));
      // A steady grade: a trench through the walls, a low causeway across the benches.
      y += (rampY - y) * across * ends;
    }
    return y;
  }
  // Weight of the pit over natural ground: 1 inside the rim, 0 beyond QUARRY_OUTER.
  const weight = (x, z) => 1 - smooth(QUARRY_RIM, QUARRY_OUTER, Math.hypot(x - center.x, z - center.z));

  return {
    center: { ...center }, toward: { x: ux, z: uz },
    local, pit, weight,
    // Terrain wrapper, same shape as the other landmark *Ground(x, z, original) functions.
    ground(x, z, original) {
      const w = weight(x, z);
      return w <= 0 ? original : original + (pit(x, z) - original) * w;
    },
    area: (x, z, pad = 0) => Math.hypot(x - center.x, z - center.z) < QUARRY_OUTER + pad,
    // World position at u (toward the gate) and v (across) from the centre.
    at: (u, v) => ({ x: center.x + ux * u - uz * v, z: center.z + uz * u + ux * v }),
  };
}
