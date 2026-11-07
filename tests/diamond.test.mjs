import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiamondKingdom, DIAMOND_BASE, DIAMOND_MESAS, MESA_CLIFF, CITADEL, CITADEL_TOP, CAUSEWAY, SPOKES, RING_ROAD, TITHE_YARD, CAUSEWAY_BREAK, BRIDGE } from '../src/models/diamond.js';
import { QUARRY } from '../src/models/diamondQuarry.js';

// Off-axis like the real noisy trail. `original` stands in for noise: a stable area must ignore it.
const k = createDiamondKingdom({ x: 9, z: 344 });
const groundUV = (u, v, original = 7) => { const p = k.at(u, v); return k.ground(p.x, p.z, original); };

test('the core ignores the noise underneath (fixed ground, unchanged by chaos)', () => {
  for (const [u, v] of [[100, 40], [150, -60], [60, 0], [CITADEL.u, 5]]) {
    const p = k.at(u, v);
    assert.ok(k.stable(p.x, p.z), `${u},${v} should be stable`);
    assert.equal(k.ground(p.x, p.z, -20), k.ground(p.x, p.z, 30));
  }
});

test('roads are level sandstone floor, clear of mesas', () => {
  const ring = [];
  for (let a = 0; a < Math.PI * 2; a += 0.1) ring.push([40 + Math.cos(a) * RING_ROAD.radius, Math.sin(a) * RING_ROAD.radius]);
  const spokes = SPOKES.slice(0, 4).flatMap(([[u0, v0], [u1, v1]]) => Array.from({ length: 11 }, (_, i) => [u0 + (u1 - u0) * i / 10, v0 + (v1 - v0) * i / 10]));
  for (const [u, v] of [...ring, ...spokes].filter(([u]) => u >= 4)) {
    for (const side of [-2, 0, 2]) assert.ok(Math.abs(groundUV(u, v + side) - DIAMOND_BASE) < 0.05, `road at ${u.toFixed(1)},${v.toFixed(1)}`);
  }
});

test('the Tithe Yard is a level paved circle', () => {
  for (let a = 0; a < Math.PI * 2; a += 0.4) for (const r of [0, 6, TITHE_YARD.r]) {
    const p = k.at(TITHE_YARD.u + Math.cos(a) * r, Math.sin(a) * r);
    assert.equal(k.ground(p.x, p.z, 9), DIAMOND_BASE);
    assert.ok(k.road(p.x, p.z));
  }
});

test('mesas stay off the zones the plan reserves', () => {
  const zones = [[40, 55, 24, 100, 38, 72], [40, -55, 25, 60, -75, -35]]; // Artificers' Row, Workers' Stockade (u0,u1,v0,v1)
  for (const m of DIAMOND_MESAS) {
    for (const [, , u0, u1, v0, v1] of zones) {
      const cu = Math.max(u0, Math.min(u1, m.u)), cv = Math.max(v0, Math.min(v1, m.v));
      assert.ok(Math.hypot(m.u - cu, m.v - cv) > (m.r + MESA_CLIFF) * 1.11, `mesa ${m.u},${m.v} intrudes`);
    }
  }
});

test('the causeway climbs steadily to a flat citadel top (walking surface: ground or drawbridge deck)', () => {
  const walk = u => { const p = k.at(u, 0); return k.bridge.platform.contains(p.x, p.z) ? Math.max(k.bridge.platform.topAt(p.x, p.z), groundUV(u, 0)) : groundUV(u, 0); };
  let prev = walk(CAUSEWAY.start - 2);
  for (let u = CAUSEWAY.start - 1.5; u <= CITADEL.u; u += 0.5) {
    const y = walk(u);
    assert.ok(y >= prev - 1e-9 && y - prev <= 0.16, `causeway step at u=${u}: ${prev} -> ${y}`);
    prev = y;
  }
  for (const [du, dv] of [[0, 0], [20, 15], [-25, -10], [10, -28]]) assert.equal(groundUV(CITADEL.u + du, dv), CITADEL_TOP);
});

test('the quarry keeps its floor, benches and ramp inside the kingdom', () => {
  const c = k.layout.center;
  assert.equal(k.ground(c.x, c.z, 7), QUARRY.levels[0]);
  assert.ok(k.ground(k.layout.orin.x, k.layout.orin.z, 7) < DIAMOND_BASE - 1);                // Orin waits in the pit
  for (const p of k.layout.fragments) assert.equal(k.ground(p.x, p.z, 7), DIAMOND_BASE);         // fragments are up on the Row
  assert.ok(k.clear(c.x, c.z) && !k.clear(k.at(150, 50).x, k.at(150, 50).z));
});

test('outside the kingdom the ground is untouched', () => {
  const p = k.at(-80, 0);
  assert.equal(k.ground(p.x, p.z, 4.2), 4.2);
});

test('the drawbridge spans a real break in the causeway', () => {
  const mid = k.at(CAUSEWAY_BREAK.u, 0);
  assert.equal(k.ground(mid.x, mid.z, 9), DIAMOND_BASE);                                    // cut to the desert floor
  assert.ok(k.bridge.platform.contains(mid.x, mid.z) && k.bridge.platform.topAt(mid.x, mid.z) > DIAMOND_BASE + 8);
  for (const s of [-1, 1]) {                                                                  // the deck meets solid causeway at both ends
    const end = k.at(CAUSEWAY_BREAK.u + s * (CAUSEWAY_BREAK.half + 1 + BRIDGE.overlap - 0.3), 0);
    assert.ok(Math.abs(k.ground(end.x, end.z, 9) - k.bridge.platform.topAt(end.x, end.z)) < 0.05);
  }
  const side = k.at(CAUSEWAY_BREAK.u, BRIDGE.half + 0.5);
  assert.ok(!k.bridge.platform.contains(side.x, side.z));
  assert.ok(k.bridge.rails.every(r => r.minY > DIAMOND_BASE + 5), 'rails never block the desert floor under the bridge');
});
