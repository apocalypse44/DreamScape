// Diamond Kingdom · The Shatterglass March (DIAMOND_KINGDOM_TERRAIN.md). Pure logic, no Three.js.
// Authored ground for the whole kingdom: a level sandstone floor, the Shatterglass Quarry around the
// relay, a ring of mesas, the Citadel mesa with its causeway, and paved roads between them.
// Frame: u = metres into the kingdom from the gate, v = metres across (+v west when the gate faces
// south), the same frame as diamondLayout's at(along, side). The core is fixed ground: chaos never
// reshapes it, like Spade's city.
import { createQuarry } from './diamondQuarry.js';
import { diamondLayout } from './diamondCampaign.js';

export const DIAMOND_BASE = 1.5;
// Core where the ground is fully authored (no noise, no chaos), and the band it blends out over.
export const DIAMOND_CORE = { u0: 4, u1: 250, v: 80, fade: 18 };
// Mesas: [u, v, top radius, height]. A boundary ring like Spade's mountains.
export const DIAMOND_MESAS = [
  [16, 98, 14, 16], [70, 104, 18, 22], [125, 93, 15, 14], [180, 99, 20, 26], [235, 91, 16, 18],
  [18, -102, 16, 18], [85, -101, 17, 20], [140, -95, 14, 15], [195, -101, 19, 24], [240, -89, 15, 17],
  [276, 40, 22, 28], [281, -35, 20, 24],
].map(([u, v, r, h]) => ({ u, v, r, h }));
export const MESA_CLIFF = 6;
// The Prism Citadel's mesa and the causeway climbing to it from the north.
export const CITADEL = { u: 212, v: 0, r: 34, h: 18, cliff: 5 };
export const CITADEL_TOP = DIAMOND_BASE + CITADEL.h;
export const CAUSEWAY = { start: 110, end: CITADEL.u - CITADEL.r + 2, half: 3, soft: 4 };
// A break in the causeway, spanned by the royals' drawbridge: the only way up to the enclave.
export const CAUSEWAY_BREAK = { u: 152, half: 4 };
export const BRIDGE = { half: 2.2, rail: 2.5, overlap: 1.2 };   // deck half-width, rail line, deck reach onto each end
// Roads: a ring around the quarry rim and spokes to the gate, Row, Stockade and causeway.
export const RING_ROAD = { radius: 32.5, half: 2.5 };
export const ROAD_HALF = 2.5;
// The Tithe Yard: a paved circle on the road south of the quarry where the royals weigh and take
// what the workers dig, before it goes up the causeway.
export const TITHE_YARD = { u: 91, v: 0, r: 13 };
// Dustward: the workers' slum across the east lowland (u, v ranges), and the Triad's Stockade inside it.
export const DUSTWARD = { u0: 14, u1: 172, v0: -84, v1: -12 };
export const STOCKADE = { u0: 28, u1: 60, v0: -72, v1: -38 };
// Artificers' Row: the street, workshops and Orin's Hall (diamondRow.js), kept clear of scattered crystals.
export const ROW = { u0: 24, u1: 100, v0: 38, v1: 72 };
// Diamond's war machine (diamondSiege.js): the Siege Yard west of the causeway, the royal Barracks east of it.
export const SIEGE_YARD = { u0: 104, u1: 150, v0: 16, v1: 62, gate: 127 };
export const BARRACKS = { u0: 122, u1: 148, v0: -42, v1: -16, gate: 135 };
export const SPOKES = [
  [[-6, 0], [40 - RING_ROAD.radius, 0]],                         // gate to ring
  [[40 + RING_ROAD.radius, 0], [CAUSEWAY.start, 0]],             // ring to causeway
  [[40, -RING_ROAD.radius], [44, -48]],                          // to the Workers' Stockade (east)
  [[40, RING_ROAD.radius], [46, 55]],                            // to Artificers' Row (west)
  [[28, 55], [82, 55]],                                          // the Row's street, to Orin's Hall door
  [[CITADEL.u - CITADEL.r + 2, 0], [CITADEL.u - 12, 0]],         // citadel forecourt
];

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const segDistance = (u, v, [a, b]) => {
  const du = b[0] - a[0], dv = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((u - a[0]) * du + (v - a[1]) * dv) / (du * du + dv * dv)));
  return Math.hypot(u - a[0] - du * t, v - a[1] - dv * t);
};

// Mesa top at height h within r, falling over MESA_CLIFF; the outline wobbles so it is not a circle.
function mesaHeight(m, u, v) {
  const du = u - m.u, dv = v - m.v, a = Math.atan2(dv, du);
  const d = Math.hypot(du, dv) * (1 + 0.07 * Math.sin(5 * a + m.u) + 0.04 * Math.sin(9 * a - m.v));
  return d > m.r + MESA_CLIFF ? -Infinity : DIAMOND_BASE + m.h * (1 - smooth(m.r, m.r + MESA_CLIFF, d));
}

// gate: the real Diamond gate { x, z } (it sits on the noisy south trail).
export function createDiamondKingdom(gate) {
  const layout = diamondLayout(gate);
  const quarry = createQuarry(layout.center, gate);
  const d = Math.hypot(gate.x, gate.z) || 1, ox = gate.x / d, oz = gate.z / d;
  const local = (x, z) => { const dx = x - gate.x, dz = z - gate.z; return { u: dx * ox + dz * oz, v: -dx * oz + dz * ox }; };
  const at = (u, v) => ({ x: gate.x + ox * u - oz * v, z: gate.z + oz * u + ox * v });

  // 1 in the core, 0 outside the kingdom.
  function coreWeight(u, v) {
    const { u0, u1, v: half, fade } = DIAMOND_CORE;
    return smooth(u0 - fade, u0, u) * (1 - smooth(u1, u1 + fade, u)) * (1 - smooth(half, half + fade, Math.abs(v)));
  }
  // Distance from the nearest road centre line (ring road included).
  function roadDistance(u, v) {
    let best = Math.abs(Math.hypot(u - 40, v) - RING_ROAD.radius);
    for (const s of SPOKES) best = Math.min(best, segDistance(u, v, s));
    if (u > CAUSEWAY.start - 1 && u < CAUSEWAY.end + 1) best = Math.min(best, Math.abs(v));
    best = Math.min(best, Math.max(0, Math.hypot(u - TITHE_YARD.u, v - TITHE_YARD.v) - TITHE_YARD.r));
    return best;
  }
  function causewayY(u) {
    const k = Math.max(0, Math.min(1, (u - CAUSEWAY.start) / (CAUSEWAY.end - CAUSEWAY.start)));
    return DIAMOND_BASE + CITADEL.h * k;
  }

  // The authored height over `original` (the noise ground underneath).
  function ground(x, z, original) {
    const { u, v } = local(x, z);
    if (u < DIAMOND_CORE.u0 - DIAMOND_CORE.fade - 50 || u > 340 || Math.abs(v) > 160) return original;
    let y = original + (DIAMOND_BASE - original) * coreWeight(u, v);
    for (const m of DIAMOND_MESAS) y = Math.max(y, mesaHeight(m, u, v));
    const dc = Math.hypot(u - CITADEL.u, v - CITADEL.v); // the citadel mesa: a true circle, steeper than the others
    if (dc < CITADEL.r + CITADEL.cliff) y = Math.max(y, DIAMOND_BASE + CITADEL.h * (1 - smooth(CITADEL.r, CITADEL.r + CITADEL.cliff, dc)));
    const { start, end, half, soft } = CAUSEWAY;
    if (u > start - soft && u < end + soft && Math.abs(v) < half + soft) {
      const w = (1 - smooth(half, half + soft, Math.abs(v))) * smooth(start - soft, start, u) * (1 - smooth(end, end + soft, u));
      y += (causewayY(u) - y) * w;
      // The break: the embankment is cut down to the desert floor under the drawbridge.
      const cut = (1 - smooth(CAUSEWAY_BREAK.half, CAUSEWAY_BREAK.half + 1, Math.abs(u - CAUSEWAY_BREAK.u))) * (1 - smooth(half, half + soft, Math.abs(v)));
      y += (DIAMOND_BASE - y) * cut;
    }
    return quarry.ground(x, z, y);
  }

  // The drawbridge deck: a walkable platform at causeway height across the break, and rail colliders
  // that only block up on the deck (minY), not on the desert floor beneath it.
  const reach = CAUSEWAY_BREAK.half + 1 + BRIDGE.overlap;
  const bridge = {
    platform: {
      name: 'diamond-drawbridge', width: 2 * BRIDGE.half,
      contains: (x, z, pad = 0) => { const p = local(x, z); return Math.abs(p.u - CAUSEWAY_BREAK.u) < reach + pad && Math.abs(p.v) < BRIDGE.half + pad; },
      topAt: (x, z) => causewayY(local(x, z).u),
    },
    rails: [],
  };
  for (let u = CAUSEWAY_BREAK.u - reach; u <= CAUSEWAY_BREAK.u + reach; u += 0.8)
    for (const side of [-1, 1]) bridge.rails.push({ ...at(u, side * BRIDGE.rail), radius: 0.3, minY: causewayY(u) - 2 });

  return {
    gate: { ...gate }, layout, quarry, local, at, ground, roadDistance, causewayY, bridge,
    // Fixed ground: the whole authored core, minus the fade band. Height there ignores `original`.
    stable: (x, z) => { const { u, v } = local(x, z); return coreWeight(u, v) >= 1; },
    area: (x, z, pad = 0) => { const { u, v } = local(x, z); return u > DIAMOND_CORE.u0 - DIAMOND_CORE.fade - pad && u < 300 + pad && Math.abs(v) < 125 + pad; },
    // The royal enclave: the citadel mesa's flat top.
    royal: (x, z) => { const { u, v } = local(x, z); return Math.hypot(u - CITADEL.u, v - CITADEL.v) < CITADEL.r; },
    road: (x, z, pad = 0) => { const { u, v } = local(x, z); return roadDistance(u, v) < ROAD_HALF + pad; },
    // Ground kept free of scattered decor: roads, the quarry, the causeway and the citadel mesa.
    // Where scattered crystal clusters may not grow: everything clear(), plus the authored districts.
    // (Dustward's slum has been mined bare.)
    decorFree(x, z, pad = 0) {
      const { u, v } = local(x, z), within = r => u > r.u0 - pad && u < r.u1 + pad && v > r.v0 - pad && v < r.v1 + pad;
      return this.clear(x, z, pad) || within(ROW) || within(STOCKADE) || within(DUSTWARD) || within(SIEGE_YARD) || within(BARRACKS);
    },
    clear: (x, z, pad = 0) => {
      const { u, v } = local(x, z);
      return roadDistance(u, v) < ROAD_HALF + 2 + pad || quarry.area(x, z, pad) ||
        Math.hypot(u - CITADEL.u, v - CITADEL.v) < CITADEL.r + CITADEL.cliff + pad;
    },
  };
}

// Sandstone strata: horizontal bands by height, repeating every 11 m, so quarry walls, mesa
// cliffs and the citadel's flanks all read as the same layered rock.
const STRATA = [0x7d6a52, 0xa98450, 0xc9a266, 0x9a7444, 0xd6b47a];
export function strataColor(y) {
  const i = Math.floor((y + 100) / 2.2) % STRATA.length;
  return STRATA[i];
}
export const PAVING = 0xe2cc98;
export const MARBLE = 0xf1ead8; // the royal enclave's paving on the citadel mesa
