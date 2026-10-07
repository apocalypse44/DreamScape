import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/models/waterfall.js', import.meta.url), 'utf8');
const { WATERFALL, waterfallArea, waterfallTerrain } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('Crossing and distant terrain keep their original heights', () => {
  for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
    for (const r of [0, 10, 20, 25]) {
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      assert.equal(waterfallTerrain(x, z, 9.4), 9.4);
    }
  }
  assert.equal(waterfallTerrain(400, -200, 7), 7);
});

test('pool remains shallow and below its water surface across different seeds and chaos heights', () => {
  for (const original of [-5, 1.5, 8, 20]) {
    for (let r = 0; r <= WATERFALL.poolRadius; r += 0.5) {
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const height = waterfallTerrain(WATERFALL.x + Math.cos(a) * r, WATERFALL.z + Math.sin(a) * r, original);
        assert.ok(height >= WATERFALL.base - 0.45 - 1e-8);
        assert.ok(height <= WATERFALL.base + 1e-8);
      }
    }
  }
});

test('cliff footing stays level and landmark is reserved without blocking spawn or shrine', () => {
  assert.equal(waterfallTerrain(WATERFALL.x, WATERFALL.z - 8, 20), WATERFALL.base);
  assert.equal(waterfallArea(WATERFALL.x, WATERFALL.z, 8), true);
  assert.equal(waterfallArea(WATERFALL.x, WATERFALL.z - 8, 8), true);
  assert.equal(waterfallArea(0, 0, 8), false);
  assert.equal(waterfallArea(0, -11, 8), false);
});

test('terrain shaping is deterministic, finite and continuous through the outer blend', () => {
  const samples = [];
  for (let x = -45; x <= 15; x += 0.5) for (let z = -65; z <= 0; z += 0.5) {
    const y = waterfallTerrain(x, z, 4);
    assert.ok(Number.isFinite(y));
    assert.ok(Math.abs(y - waterfallTerrain(x + 0.001, z, 4)) < 0.02);
    assert.ok(Math.abs(y - waterfallTerrain(x, z + 0.001, 4)) < 0.02);
    samples.push([x, z, y]);
  }
  for (const [x, z, y] of samples) assert.equal(waterfallTerrain(x, z, 4), y);
});
