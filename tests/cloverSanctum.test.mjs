// The Clover sanctum (src/models/cloverSanctum.js): nothing solid blocks a route, everything stands on summit
// ground, and the soft dressing keeps off the walking line.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanctumColliders, sanctumDressing, keepClear, SANCTUM_FLOOR, STONES, TREES } from '../src/models/cloverSanctum.js';
import { CLOVER_VALLEY } from '../src/models/cloverTerrain.js';
import { SUMMIT_DOOR, SUMMIT_ARRIVAL } from '../src/models/skyIsland.js';

const summitTop = CLOVER_VALLEY.filter(p => p.top === SANCTUM_FLOOR);
const onSummit = (x, z, inset = 0) => summitTop.some(p => p.contains ? p.contains(x, z, 0) && (!inset || p.contains(x, z, 0)) :
  Math.abs(x - p.x) < p.width / 2 - inset && Math.abs(z - p.z) < p.depth / 2 - inset);
const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };

test('no solid piece blocks the walk, the gateway, the return point, the jumps or the overlook walkways', () => {
  for (const c of sanctumColliders()) assert.equal(keepClear(c.x, c.z, c.radius), false, `collider at ${c.x.toFixed(1)}, ${c.z.toFixed(1)} blocks a route`);
  // The routes really are open: the gateway, the Sky Garden return and the path itself.
  for (const [x, z] of [[SUMMIT_DOOR.x, SUMMIT_DOOR.z - 1], [SUMMIT_ARRIVAL.x, SUMMIT_ARRIVAL.z]])
    assert.ok(sanctumColliders().every(c => Math.hypot(x - c.x, z - c.z) > c.radius + .6));
});

test('every piece stands on summit ground, not over a cliff', () => {
  for (const c of sanctumColliders()) assert.ok(onSummit(c.x, c.z), `collider off the summit at ${c.x}, ${c.z}`);
  for (const d of sanctumDressing(hash)) assert.ok(onSummit(d.x, d.z), `${d.model} off the summit at ${d.x.toFixed(1)}, ${d.z.toFixed(1)}`);
});

test('flower beds keep off the walking line', () => {
  const items = sanctumDressing(hash);
  for (const d of items)
    assert.ok(!keepClear(d.x, d.z) || !onPathLine(d), `${d.model} on the path at ${d.x.toFixed(1)}, ${d.z.toFixed(1)}`);
  assert.ok(STONES.length >= 6 && TREES.length >= 6);
});

// A bed item may sit in a keep-clear box (soft, walk-through) but not on the stepping-stone line itself.
import { PATH } from '../src/models/cloverSanctum.js';
function onPathLine({ x, z }) {
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < 1) return true;
  }
  return false;
}
