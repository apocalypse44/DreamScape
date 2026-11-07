import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const load = async path => import(`data:text/javascript;base64,${Buffer.from(readFileSync(new URL(path, import.meta.url), 'utf8')).toString('base64')}`);
const { createColliderIndex } = await load('../src/models/colliderIndex.js');
const { createAnimationCadence } = await load('../src/models/animationCadence.js');

test('collider queries match exhaustive circle collisions across cell boundaries', () => {
  const colliders = Array.from({ length: 2000 }, (_, i) => ({ x: (i % 50) * 8 - 200, z: Math.floor(i / 50) * 8 - 160, radius: 0.5 + i % 23 }));
  const index = createColliderIndex(colliders);
  for (let i = 0; i < 100; i++) {
    const x = Math.sin(i) * 190, z = Math.cos(i * 3) * 150, r = 0.55;
    const intersects = c => Math.hypot(c.x - x, c.z - z) < c.radius + r;
    const nearby = index.query(x, z, r);
    assert.deepEqual(new Set(nearby.filter(intersects)), new Set(colliders.filter(intersects)));
    assert.equal(nearby.length, new Set(nearby).size);
    assert.ok(nearby.length < colliders.length / 5);
  }
});

test('collider index preserves moving NPCs, newly appended props and live door states', () => {
  const npc = { x: 100, z: 100, radius: 1, npc: true }, door = { x: 0, z: 0, radius: 2, off: false };
  const colliders = [npc, door], index = createColliderIndex(colliders);
  assert.deepEqual(index.query(0, 0, 1), [door]);
  npc.x = npc.z = 0;
  assert.ok(index.query(0, 0, 1).includes(npc));
  door.off = true; assert.equal(index.query(0, 0, 1)[0].off, true);
  const added = { x: 0, z: 0, radius: 1 }; colliders.push(added);
  assert.ok(index.query(0, 0, 1).includes(added));
  colliders.splice(0); assert.deepEqual(index.query(0, 0, 1), []);
});

test('distant skeleton updates preserve elapsed animation time and near actors update every frame', () => {
  for (const distance of [5, 50, 200]) {
    const step = createAnimationCadence(0), values = [];
    for (let i = 0; i < 120; i++) { const dt = step(1 / 60, distance); if (dt) values.push(dt); }
    assert.ok(Math.abs(values.reduce((s, x) => s + x, 0) - 2) <= (distance > 100 ? 0.5 : distance > 35 ? 0.1 : 1e-8));
    assert.ok(values.length <= (distance > 100 ? 5 : distance > 35 ? 21 : 120));
    if (distance < 35) assert.equal(values.length, 120);
  }
  const step = createAnimationCadence(); step(20, 10, false);
  assert.equal(step(1 / 60, 10), 1 / 60);
});

