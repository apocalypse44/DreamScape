// Diamond · the Workers' Stockade (DIAMOND_KINGDOM_TERRAIN.md, Phase 2). Pure logic, no Three.js.
// The Triad keeps the workers' families in a crystal-barred camp inside Dustward. When the relay's
// pulse leaves the escape-gate port, it runs along a buried conduit to the stockade gate; the Triad
// sigil breaks, the chains shatter, the gate swings open and the workers walk out to the road.
import { STOCKADE } from './diamond.js';
import { socketCenter, BOARD } from './diamondCampaign.js';

export const GATE_U = 44, GATE_HALF = 2.6;      // the gate sits where the Stockade road meets the north fence
export const POST_STEP = 4;                       // metres between fence posts
export const WALK_SPEED = 1.3;                    // matches the villagers' Walk_Loop
// The release, in seconds after the pulse reaches the escape gate.
export const RELEASE = { conduit: 4, sigil: 4.5, shatter: 1.6, gateOpen: [5, 7.4], firstWalker: 7.6, walkerGap: 1.3 };
export const WORKERS = 6;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.max(0, Math.min(1, t));

// kingdom: createDiamondKingdom(gate). Everything is returned in world x/z.
export function stockadeLayout(kingdom) {
  const { u0, u1, v0, v1 } = STOCKADE;
  const corners = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];   // v1 (-38) is the north fence facing the quarry
  // Fence posts round the rectangle, leaving the gate gap on the north side.
  const posts = [];
  corners.forEach(([ua, va], i) => {
    const [ub, vb] = corners[(i + 1) % 4], length = Math.hypot(ub - ua, vb - va);
    for (let s = 0; s < length; s += POST_STEP) {
      const u = lerp(ua, ub, s / length), v = lerp(va, vb, s / length);
      if (i === 0 && Math.abs(u - GATE_U) < GATE_HALF + 0.5) continue;
      posts.push({ u, v, ...kingdom.at(u, v), side: i });
    }
  });
  // Bars fill each fence run between neighbouring posts (same side, not across the gate).
  const runs = [];
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i], b = posts[(i + 1) % posts.length];
    if (Math.hypot(a.u - b.u, a.v - b.v) <= POST_STEP + 0.01) runs.push([a, b]);
  }
  const gate = { inside: kingdom.at(GATE_U, v1 - 3), centre: kingdom.at(GATE_U, v1), outside: kingdom.at(GATE_U, v1 + 3) };

  // The buried conduit: from the relay's escape-gate port (board cell 3,1, east side) to the gate.
  const cell = socketCenter(kingdom.layout, BOARD.size - 1, 1);
  const port = { x: cell.x + BOARD.socket * 0.95, z: cell.z };
  const conduit = [];
  const length = Math.hypot(gate.outside.x - port.x, gate.outside.z - port.z), steps = Math.ceil(length / 0.8);
  for (let s = 0; s <= steps; s++) conduit.push({ x: lerp(port.x, gate.outside.x, s / steps), z: lerp(port.z, gate.outside.z, s / steps) });

  // Workers wait inside near the gate, then gather on the open ground between the fence and the road.
  const workers = Array.from({ length: WORKERS }, (_, i) => {
    const from = kingdom.at(GATE_U - 7.5 + (i % 3) * 7.5 + (i > 2 ? 2 : 0), v1 - 7 - Math.floor(i / 3) * 5);
    const to = kingdom.at(GATE_U - 6 + i * 2.4, v1 + 2.6 + (i % 2) * 0.8);
    return { from, path: [from, gate.inside, gate.outside, to], delay: RELEASE.firstWalker + i * RELEASE.walkerGap };
  });
  return { posts, runs, gate, port, conduit, workers };
}

// Where a worker is at `t` seconds after release: { x, z, heading, walking, done }.
export function workerAt(worker, t) {
  let left = Math.max(0, t - worker.delay) * WALK_SPEED;
  const path = worker.path;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= seg) {
      const k = seg ? left / seg : 1;
      return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), heading: Math.atan2(b.x - a.x, b.z - a.z), walking: t > worker.delay, done: false };
    }
    left -= seg;
  }
  const a = path.at(-2), b = path.at(-1);
  return { x: b.x, z: b.z, heading: Math.atan2(b.x - a.x, b.z - a.z), walking: false, done: true };
}

// The release as a pure function of time since the pulse (null = still held).
export function releaseState(t) {
  if (t === null || t < 0) return { conduit: 0, sigil: 1, shatter: 0, gate: 0 };
  return {
    conduit: clamp01(t / RELEASE.conduit),                                   // lit fraction, port to gate
    sigil: 1 - clamp01((t - RELEASE.sigil) / 0.6),                           // the Triad sigil flares out
    shatter: clamp01((t - RELEASE.sigil) / RELEASE.shatter),                 // chain links fly and fade
    gate: clamp01((t - RELEASE.gateOpen[0]) / (RELEASE.gateOpen[1] - RELEASE.gateOpen[0])),
  };
}
