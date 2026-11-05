// Diamond · atmosphere and story (DIAMOND_KINGDOM_TERRAIN.md, Phase 6). Pure logic, no Three.js:
// the Atlas locations, the fingerpost signs, the camera shots (arrival flyover, relay power-up,
// "The Chain Order" flashback, Orin's lead), and the flashback's timeline and cast. Everything is laid
// out from the kingdom's u/v frame, because the gate sits on the noisy south trail.
import { DIAMOND_BASE, CAUSEWAY, CAUSEWAY_BREAK, CITADEL, CITADEL_TOP, TITHE_YARD, SIEGE_YARD, BARRACKS, STOCKADE } from './diamond.js';
import { STREET, HALL } from './diamondRow.js';
import { GATE_U, RELEASE } from './diamondStockade.js';

const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const pulse = (t, at, width) => Math.max(0, 1 - Math.abs(t - at) / width);

// --- Atlas locations (same shape as CLOVER_MAP_LOCATIONS) ---
export function diamondMapLocations(kingdom) {
  const loc = (id, name, [u, v], [du, dv], note, directions, labelY) => {
    const p = kingdom.at(u, v), d = kingdom.at(du, dv);
    return { id, name, x: p.x, z: p.z, note, directions, labelY, destination: { x: d.x, z: d.z, name } };
  };
  return [
    loc('diamond-quarry', 'SHATTERGLASS QUARRY', [40, 0], [40 - 30, 0], 'ORIN · THE RELAY ON THE PIT FLOOR',
      'Straight past the Diamond gate. Take the haul ramp down into the pit; Orin waits on the first bench.', .62),
    loc('diamond-row', 'ARTIFICERS’ HALL', [(HALL.u0 + HALL.u1) / 2, STREET.v], [HALL.u0 - 1, STREET.v], 'FRAGMENTS IN THE ROW’S WORKSHOPS',
      'From the quarry’s ring road, take the west branch onto Artificers’ Row. One fragment rests in each workshop; Orin’s Hall is at the end of the street.', .67),
    loc('diamond-stockade', 'WORKERS’ STOCKADE', [GATE_U, STOCKADE.v1 - 15], [GATE_U, STOCKADE.v1 + 3], 'THE TRIAD’S CHAINED CAMP',
      'From the quarry’s ring road, take the east branch. The relay’s escape gate opens it.', .72),
    loc('diamond-tithe', 'TITHE YARD', [TITHE_YARD.u, 0], [TITHE_YARD.u - TITHE_YARD.r - 1, 0], 'WHERE THE ROYALS WEIGH THE CRYSTAL',
      'South along the road from the quarry, before the causeway.', .77),
    loc('diamond-siege', 'SIEGE YARD', [(SIEGE_YARD.u0 + SIEGE_YARD.u1) / 2, (SIEGE_YARD.v0 + SIEGE_YARD.v1) / 2], [SIEGE_YARD.gate, SIEGE_YARD.v0 - 2], 'SABOTAGED ENGINES',
      'West of the causeway’s foot. The royal Barracks and the Triad sentry post are east of it.', .82),
    loc('diamond-citadel', 'PRISM CITADEL', [CITADEL.u, 0], [CITADEL.u - 25, 0], 'THE ROYAL ENCLAVE · GREAT PRISM',
      'Climb the causeway and cross the drawbridge. The Great Prism floats over the forecourt; the keep is sealed.', .87),
  ];
}

// --- Fingerposts: [u, v, [[label, target u, target v], ...]] ---
export const FINGERPOSTS = [
  [5, 7, [['SHATTERGLASS QUARRY', 40, 0], ['ARTIFICERS’ ROW', 46, STREET.v], ['WORKERS’ STOCKADE', GATE_U, STOCKADE.v1], ['PRISM CITADEL', CAUSEWAY.start, 0]]],
  [76, 5, [['TITHE YARD', TITHE_YARD.u, 0], ['SIEGE YARD', SIEGE_YARD.gate, SIEGE_YARD.v0], ['BARRACKS', BARRACKS.gate, BARRACKS.v1], ['PRISM CITADEL', CAUSEWAY.start, 0]]],
  [49, STREET.v - 4.5, [['ARTIFICERS’ HALL', HALL.u0, STREET.v], ['SHATTERGLASS QUARRY', 40, 0]]],
];
export function fingerposts(kingdom) {
  return FINGERPOSTS.map(([u, v, boards]) => ({ u, v, ...kingdom.at(u, v),
    boards: boards.map(([label, tu, tv]) => { const t = kingdom.at(tu, tv), p = kingdom.at(u, v); return { label, yaw: Math.atan2(t.x - p.x, t.z - p.z) }; }) }));
}

// --- Camera shots: keys are [seconds, [u, v, height above the floor], [u, v, height]] in the kingdom frame,
// converted to world positions by shotKeys(). ground: 'base' (desert floor), 'pit' (quarry), 'top' (mesa).
const Y = { base: DIAMOND_BASE, top: CITADEL_TOP };
export const DIAMOND_SHOTS = {
  // The first time you pass the gate: over the quarry, along the Row and the slum, up the causeway, over the
  // drawbridge and round the Great Prism and the spires, then back to the gate.
  arrival: {
    title: 'THE SHATTERGLASS MARCH', chapter: 'IV · THE DIAMOND KINGDOM',
    keys: [
      [0, [-4, 0, 9], [40, 0, -4]], [5, [22, 28, 26], [40, 0, -4]], [10, [56, 70, 30], [GATE_U, STOCKADE.v1 - 10, 0]],
      [15, [86, -36, 32], [TITHE_YARD.u, 0, 2]], [20, [CAUSEWAY_BREAK.u - 16, 24, 36], [CAUSEWAY_BREAK.u, 0, 10]],
      [25, [CITADEL.u - 58, -30, 62], [CITADEL.u - 25, 0, 40]], [30, [CITADEL.u - 40, 30, 80], [CITADEL.u, 0, 45]],
      [34, [40, 0, 70], [CITADEL.u, 0, 40]], [37, [-4, 0, 9], [40, 0, -4]],
    ],
    lines: [
      [0.6, 'THE DIAMOND KINGDOM', 'Diamond mines the crystal that powers every kingdom’s magic.'],
      [5, 'THE SHATTERGLASS QUARRY', 'The workers dig it here, in the pit, under the royals’ watchtowers.'],
      [10, 'DUSTWARD', 'They live down here, in the dust. The Triad keeps their families in a stockade.'],
      [15, 'THE TITHE YARD', 'Every crystal is weighed and taken, then hauled up the causeway.'],
      [20, 'THE CAUSEWAY', 'One road leads up, over the royals’ drawbridge.'],
      [25, 'THE PRISM CITADEL', 'Up there the royals keep the Great Prism, and the Triad holds the crown.'],
      [31, 'ORIN’S MESSAGE', 'Find Artificer Orin by the relay at the bottom of the quarry.'],
    ],
  },
  // The relay runs: follow the pulse along the buried conduit to the stockade, watch it open, ride the beam up.
  power: {
    title: 'THE SHATTERGLASS RELAY', chapter: 'IV · THE DIAMOND KINGDOM',
    keys: [
      [0, [35, -8, 6], [44, -14, -4]], [RELEASE.conduit / 2, [33, -24, 10], [44, -30, 0]],
      [RELEASE.conduit, [GATE_U - 7, STOCKADE.v1 + 9, 8], [GATE_U, STOCKADE.v1 - 2, 3]],
      [RELEASE.firstWalker + 3, [GATE_U - 9, STOCKADE.v1 + 8, 4], [GATE_U, STOCKADE.v1 - 2, 1.5]],
      [RELEASE.firstWalker + 6, [GATE_U - 14, STOCKADE.v1 + 12, 14], [40, 0, 6]],
      [RELEASE.firstWalker + 10, [70, -20, 40], [CITADEL.u, 0, 44]], [RELEASE.firstWalker + 14, [CITADEL.u - 45, -24, 56], [CITADEL.u, 0, 46]],
    ],
    lines: [
      [0.5, 'THE SHATTERGLASS RELAY', 'The pulse leaves the escape gate and runs along the buried conduit.'],
      [RELEASE.sigil + 0.2, 'WORKERS’ STOCKADE', 'The Triad’s seal breaks. The chains fall.'],
      [RELEASE.firstWalker + 0.5, 'ORIN', 'They’re free. Every family in that stockade is free.'],
      [RELEASE.firstWalker + 6.5, 'INVERSION CORE', 'The core’s light reaches the Citadel. The Triad’s hold on the crown is broken.'],
      [RELEASE.firstWalker + 11, 'ORIN', 'Come back to me in the quarry.'],
    ],
  },
  // "The Chain Order": Orin's Hall remembers. All keys stay inside the hall, below its ceiling.
  chainOrder: {
    title: 'A MEMORY · THE CHAIN ORDER', chapter: 'IV · THE DIAMOND KINGDOM', flashback: 'chainOrder',
    keys: [
      [0, [84.5, 52, 3.2], [96, 48.4, 1.5]], [6, [86, 50.5, 2.6], [95, 49, 1.3]],
      [7.5, [90, 59, 3.4], [83.5, 55, 2.4]], [11, [89, 58.5, 3], [85.5, 55, 2.4]],
      [15, [93, 58, 2.8], [89.5, 55, 1.3]], [19, [91.6, 52, 2.3], [90.4, 55.6, 1.2]],
      [23, [91, 53.6, 1.9], [89.8, 54.8, 1]], [27, [86, 60, 3.6], [91, 54, 1.2]],
      [31, [85, 55.5, 4.4], [94, 55, 2]], [33.6, [84.5, 55.5, 4.6], [94, 55, 2.2]],
    ],
    lines: [
      [0.9, 'THE HALL REMEMBERS', 'Before the Triad came, Diamond’s artificers built the Shatterglass Relay here.'],
      [7.6, 'MORCANT · THE DARK TRIAD', 'Chains. One for every family in the stockade.'],
      [10.4, 'MORCANT · THE DARK TRIAD', 'Forge them, or they wear them.'],
      [13.4, 'ORIN · YEARS AGO', '…We will forge them.'],
      [19.8, 'THE HALL REMEMBERS', 'When he had gone, a worker scratched a mark into a conduit.'],
      [22.6, 'WORKER · YEARS AGO', '“We built the chains under orders. Find the unbroken record.”'],
      [26.4, 'ORIN · YEARS AGO', 'Break the relay. Hide the pieces in our workshops. The Triad will never use it.'],
      [30.6, 'THE HALL REMEMBERS', 'The relay stayed broken until someone came who could mend it.'],
    ],
  },
  // Back in the present, in the quarry: Orin hands over the Prism Sigil and points to Spade.
  lead: {
    title: 'THE UNBROKEN PATTERN', chapter: 'IV · THE DIAMOND KINGDOM',
    keys: [[0, [25, -15, 4.5], [30, -11, 1.6]], [10, [25.5, -16, 4.3], [30, -11, 1.6]], [20, [24.5, -16.5, 4.6], [30, -11, 1.8]]],
    pit: true,
    lines: [
      [0.6, 'ORIN', 'That conduit you found in Heart was ours. Now you know who scratched the plea into it.'],
      [7, 'PRISM SIGIL', 'It shows where the Triad’s armour draws its power, so it can be cut.'],
      [12, 'ORIN', 'You carry all four sigils now. Go back to Spade. The Hollow Crown is waiting.'],
    ],
  },
};

// World keys for a shot: each [t, [u, v, h], [u, v, h]] becomes [t, {x, y, z}, {x, y, z}]. Heights are
// above the desert floor, or above the mesa top inside the citadel's radius; `pit` shots are above the
// quarry floor around Orin's bench.
export function shotKeys(kingdom, shot) {
  const point = ([u, v, h]) => {
    const p = kingdom.at(u, v);
    const onMesa = Math.hypot(u - CITADEL.u, v) < CITADEL.r;
    const floor = shot.pit ? kingdom.quarry.pit(p.x, p.z) : shot.flashback ? DIAMOND_BASE : onMesa ? Y.top : Y.base;
    return { x: p.x, y: floor + h, z: p.z };
  };
  return shot.keys.map(([t, from, to]) => [t, point(from), point(to)]);
}

// --- "The Chain Order": the past as a pure function of time (s). The shot is 34.6 s long. ---
export const CHAIN_ORDER_SMASH = 29;
export function chainOrderStage(t) {
  return {
    amount: ramp(t, 0, 1.2) * (1 - ramp(t, 32.2, 33.8)),
    shimmer: Math.max(pulse(t, .5, .6), pulse(t, 33.2, .8)),
    storm: .6 * ramp(t, 7, 9) * (1 - ramp(t, 19.5, 21.5)),
    morcant: t >= 7 && t < 21 ? ramp(t, 7, 8.4) * (1 - ramp(t, 19.6, 21)) : 0,
    smoke: Math.max(ramp(t, 6.8, 7.4) * (1 - ramp(t, 8.4, 9.6)), ramp(t, 19.4, 20) * (1 - ramp(t, 20.8, 22))),
    binding: ramp(t, 12, 12.5) * (1 - ramp(t, 17.5, 18)),
    chains: ramp(t, 12.4, 18.6),                 // the pile of violet chain on the table grows
    mark: ramp(t, 21.6, 24),                     // the plea glows on the conduit
    smash: t >= CHAIN_ORDER_SMASH ? t - CHAIN_ORDER_SMASH : -1,
  };
}
// Blocking in hall coordinates [time, u, v, clip from this time on]; chainOrderCast() makes them world keys.
const CAST = {
  smith: { body: 'M', tint: 0x5a4a3a, face: [96.2, 48.4], keys: [
    [0, 93.8, 51.4, 'Fixing_Kneeling'], [26.6, 93.8, 51.4, 'Walk_Loop'], [28, 91, 53.6, 'Spell_Simple_Shoot'], [30.4, 91, 53.6, 'Idle_Loop']] },
  scribe: { body: 'F', tint: 0x4d4a44, face: [89.8, 54.8], keys: [
    [0, 90.8, 56.2, 'Idle_Loop'], [20.6, 90.8, 56.2, 'Fixing_Kneeling'], [25, 90.8, 56.2, 'Walk_Loop'], [26.4, 88.6, 57.6, 'Idle_Loop']] },
  orin: { body: 'M', tint: 0x6a5f4a, robe: 0x3f4656, face: [85.5, 55], keys: [
    [0, 87.6, 50.4, 'Idle_FoldArms_Loop'], [9, 87.6, 50.4, 'Idle_No_Loop'], [14, 87.6, 50.4, 'Idle_Loop'], [25.6, 87.6, 50.4, 'Walk_Loop'],
    [27, 89, 52.4, 'Spell_Simple_Idle_Loop'], [31, 89, 52.4, 'Idle_Loop']] },
};
export const MORCANT_AT = { u: 85.4, v: 55, h: 0.5 };
export const CHAIN_TABLE = { u: 89.5, v: 55, h: 0.95 };
export function chainOrderCast(kingdom) {
  const out = {};
  for (const [name, def] of Object.entries(CAST)) {
    const f = kingdom.at(...def.face);
    out[name] = { ...def, face: { x: f.x, z: f.z }, keys: def.keys.map(([t, u, v, clip]) => { const p = kingdom.at(u, v); return [t, p.x, p.z, clip]; }) };
  }
  return out;
}

