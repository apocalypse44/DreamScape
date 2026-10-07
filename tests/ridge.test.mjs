import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/models/ridge.js', import.meta.url), 'utf8');
const { RIDGE, RIDGE_PATH, RIDGE_MARKERS, createRidgeExploration, ridgeTerrain, ridgeArea } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('exploration requires approaching each crystal at its height and resets on restart', () => {
  const exploration = createRidgeExploration();
  const first = RIDGE_MARKERS[0];
  assert.deepEqual(exploration.update({ x: first.x, z: first.z, y: first.y + 12 }), []);
  RIDGE_MARKERS.forEach((p, i) => {
    const player = { x: p.x, z: p.z, y: p.y + 2.05 };
    assert.deepEqual(exploration.update(player), [i]);
    assert.deepEqual(exploration.update(player), []);
  });
  assert.equal(exploration.found.size, 3);
  exploration.reset();
  assert.equal(exploration.found.size, 0);
});

test('ridge preserves spawn, shrine, waterfall, NPC homes and distant ground', () => {
  for (const [x, z] of [[0, 0], [0, -11], [-18, -32], [24, 21], [-34, 30], [400, 200]]) {
    assert.equal(ridgeTerrain(x, z, 9), 9);
    assert.equal(ridgeArea(x, z), false);
  }
});
test('route and summit stay stable across underlying terrain heights', () => {
  for (const original of [-5, 1.5, 20]) {
    for (const p of RIDGE_PATH) assert.ok(Math.abs(ridgeTerrain(p.x, p.z, original) - p.y) < 1e-8);
    assert.ok(Math.abs(ridgeTerrain(RIDGE.x, RIDGE.z, original) - (RIDGE.base + RIDGE.rise)) < 1e-8);
  }
});
test('ridge blend and terrace edges are finite and continuous', () => {
  for (let x = RIDGE.x - 38; x <= RIDGE.x + 38; x += 0.75) for (let z = RIDGE.z - 38; z <= RIDGE.z + 38; z += 0.75) {
    const h = ridgeTerrain(x, z, 12);
    assert.ok(Number.isFinite(h));
    assert.ok(Math.abs(h - ridgeTerrain(x + 0.001, z, 12)) < 0.03);
    assert.ok(Math.abs(h - ridgeTerrain(x, z + 0.001, 12)) < 0.03);
  }
});
