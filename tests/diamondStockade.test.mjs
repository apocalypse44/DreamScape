import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiamondKingdom, STOCKADE } from '../src/models/diamond.js';
import { stockadeLayout, workerAt, releaseState, RELEASE, GATE_U, GATE_HALF, POST_STEP } from '../src/models/diamondStockade.js';

const k = createDiamondKingdom({ x: 9, z: 344 });
const s = stockadeLayout(k);
const uv = p => k.local(p.x, p.z);

test('the fence closes all round except the gate gap', () => {
  // Every run is one post step or less; the only longer gap between neighbours is the gate.
  const gaps = s.posts.map((a, i) => [a, s.posts[(i + 1) % s.posts.length]]).filter(([a, b]) => Math.hypot(a.u - b.u, a.v - b.v) > POST_STEP + 0.01);
  assert.equal(gaps.length, 1);
  const [a, b] = gaps[0];
  assert.ok(a.v === STOCKADE.v1 && b.v === STOCKADE.v1 && a.u < GATE_U && b.u > GATE_U);
  assert.equal(s.runs.length, s.posts.length - 1);
});

test('the stockade sits on level ground off the roads, except its own lane', () => {
  for (const p of s.posts) assert.ok(Math.abs(k.ground(p.x, p.z, 9) - 1.5) < 1e-9);
});

test('the conduit runs from the escape-gate port to the stockade gate', () => {
  assert.deepEqual(s.conduit[0], s.port);
  const end = s.conduit.at(-1);
  assert.ok(Math.hypot(end.x - s.gate.outside.x, end.z - s.gate.outside.z) < 1e-9);
});

test('the release runs conduit, sigil, chains, gate, walkers in order', () => {
  assert.deepEqual(releaseState(null), { conduit: 0, sigil: 1, shatter: 0, gate: 0 });
  const mid = releaseState(RELEASE.conduit / 2);
  assert.ok(mid.conduit > 0 && mid.conduit < 1 && mid.sigil === 1 && mid.gate === 0);
  const end = releaseState(30);
  assert.deepEqual(end, { conduit: 1, sigil: 0, shatter: 1, gate: 1 });
  for (const w of s.workers) assert.ok(w.delay >= RELEASE.gateOpen[1], 'nobody walks before the gate is open');
});

test('workers start inside, pass through the gate gap, and end outside apart', () => {
  const ends = s.workers.map(w => workerAt(w, 120));
  s.workers.forEach((w, i) => {
    assert.ok(uv(w.from).v < STOCKADE.v1 && uv(w.from).u > STOCKADE.u0 && uv(w.from).u < STOCKADE.u1, `worker ${i} starts inside`);
    assert.ok(!workerAt(w, w.delay - 0.1).walking);
    assert.ok(ends[i].done && uv(ends[i]).v > STOCKADE.v1 + 1, `worker ${i} ends outside`);
    // Every crossing of the fence line is inside the gate gap.
    for (let t = w.delay; t < w.delay + 40; t += 0.1) {
      const a = uv(workerAt(w, t)), b = uv(workerAt(w, t + 0.1));
      if ((a.v - STOCKADE.v1) * (b.v - STOCKADE.v1) < 0) assert.ok(Math.abs(a.u - GATE_U) < GATE_HALF, `worker ${i} crosses the fence at u=${a.u}`);
    }
  });
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++)
    assert.ok(Math.hypot(ends[i].x - ends[j].x, ends[i].z - ends[j].z) > 1.2, `workers ${i} and ${j} overlap`);
});
