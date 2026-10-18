import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/models/companionSpacing.js', import.meta.url), 'utf8');
const { companionScenePosition, HOUND_CLEARANCE } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('scene staging gives the larger wolf clearance even when dog and player coincide', () => {
  for (const position of [{ x: 1.5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }]) {
    const at = companionScenePosition(position, { x: 0, z: 0 }, () => 0);
    assert.ok(Math.hypot(at.x, at.z) >= HOUND_CLEARANCE - 1e-9);
  }
});
test('staging tries another direction around walls and refuses cliffs or blocked routes', () => {
  const position = { x: 1, y: 0, z: 0 }, player = { x: 0, z: 0 };
  const at = companionScenePosition(position, player, () => 0, (x, z) => x > 2 && Math.abs(z) < 1);
  assert.ok(at && Math.abs(at.z) >= 1);
  assert.equal(companionScenePosition(position, player, (x, z) => Math.hypot(x, z) > 2 ? -20 : 0), null);
  assert.equal(companionScenePosition(position, player, () => 0, () => true), null);
});
