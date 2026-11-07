import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuarry, QUARRY, QUARRY_OUTER } from '../src/models/diamondQuarry.js';
import { diamondLayout, socketCenter, BOARD } from '../src/models/diamondCampaign.js';

// A gate slightly off-axis, like the real noisy trail, so the ramp direction is exercised.
const gate = { x: 9, z: 344 };
const layout = diamondLayout(gate);
const q = createQuarry(layout.center, gate);
const slope = (p, e = 0.5) => Math.max(Math.abs(q.pit(p.x + e, p.z) - q.pit(p.x - e, p.z)), Math.abs(q.pit(p.x, p.z + e) - q.pit(p.x, p.z - e))) / (2 * e);

test('relay board sits on a flat floor', () => {
  for (let i = 0; i < BOARD.size ** 2; i++) {
    const c = socketCenter(layout, i % BOARD.size, Math.floor(i / BOARD.size));
    assert.equal(q.pit(c.x, c.z), QUARRY.levels[0]);
  }
});

test('Orin and every fragment stand on flat bench ground', () => {
  for (const p of [layout.orin, ...layout.fragments]) assert.ok(slope(p) < 0.05, `${JSON.stringify(p)} slope ${slope(p)}`);
});

test('haul ramp climbs steadily from the floor to the rim toward the gate', () => {
  let prev = -Infinity;
  for (let u = QUARRY.ramp.start; u <= QUARRY.ramp.end; u += 0.5) {
    const p = q.at(u, 0), y = q.pit(p.x, p.z);
    assert.ok(y >= prev - 1e-9, `ramp dips at u=${u}`);
    if (prev > -Infinity) assert.ok(y - prev <= 0.25, `ramp step too steep at u=${u}`);
    prev = y;
  }
  assert.ok(Math.abs(prev - QUARRY.levels.at(-1)) < 1e-6);
});

test('pit blends back to natural ground outside the quarry', () => {
  const far = q.at(-(QUARRY_OUTER + 1), 0);
  assert.equal(q.ground(far.x, far.z, 7.25), 7.25);
  assert.ok(!q.area(far.x, far.z));
});
