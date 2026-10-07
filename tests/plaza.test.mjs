import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const ridge = `data:text/javascript;base64,${Buffer.from(readFileSync(new URL('../src/models/ridge.js', import.meta.url), 'utf8')).toString('base64')}`;
const source = readFileSync(new URL('../src/models/plaza.js', import.meta.url), 'utf8').replace("'./ridge.js'", `'${ridge}'`);
const { plazaTerrain } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('spawn paving, furniture and shrine footing stay level for every underlying height', () => {
  for (const original of [-5, 1.5, 8, 20]) {
    for (let x = -10; x <= 10; x += 0.5) for (let z = -10; z <= 10; z += 0.5) {
      if (Math.hypot(x, z) <= 12) assert.equal(plazaTerrain(x, z, original), 1.5);
    }
    for (const [x, z] of [[0, -11], [3, -14], [-3, -14], [0, -16]]) assert.equal(plazaTerrain(x, z, original), 1.5);
  }
});
test('levelling preserves waterfall, ridge and terrain beyond the plaza transition', () => {
  for (const [x, z] of [[-18, -32], [-6.2, -26], [41, 48], [72, 48], [24, 21], [50, 0]]) {
    assert.equal(plazaTerrain(x, z, 8), 8);
  }
});
test('plaza boundary blends continuously into existing terrain', () => {
  for (let x = -23; x < 23; x += 0.5) for (let z = -23; z < 23; z += 0.5) {
    const y = plazaTerrain(x, z, 12);
    assert.ok(Math.abs(y - plazaTerrain(x + 0.001, z, 12)) < 0.01);
    assert.ok(Math.abs(y - plazaTerrain(x, z + 0.001, 12)) < 0.01);
  }
});
