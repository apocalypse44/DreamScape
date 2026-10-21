import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/models/houndFire.js', import.meta.url), 'utf8');
const { createFireParticles, fireLife, FIRE_RATES } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const pose = (x = 0, intensity = 1) => ({ position: { x, y: 0, z: 0 }, intensity, wolf: 1 });

test('emission follows elapsed time rather than frame rate and respects the fixed budget', () => {
  for (const fps of [30, 60, 120]) {
    const fire = createFireParticles({ random: () => .5 });
    const pool = [...fire.particles];
    for (let i = 0; i < fps * 3; i++) fire.update(1 / fps, pose());
    assert.equal(fire.emitted, Object.values(FIRE_RATES).reduce((a, b) => a + b, 0) * 3);
    assert.equal(fire.particles.length, 256);
    assert.ok(fire.particles.every((p, i) => p === pool[i]));
    for (const kind of Object.keys(FIRE_RATES)) assert.ok(fire.particles.some(p => p.life > 0 && p.kind === kind));
  }
});

test('world-space trails persist while moving, but demo jumps and extinguishing clear old particles', () => {
  const fire = createFireParticles({ random: () => .5 });
  for (let i = 0; i < 30; i++) fire.update(1 / 60, pose());
  fire.update(1 / 60, pose(.2));
  assert.ok(fire.particles.some(p => p.life > 0 && p.x < .1));
  fire.update(1 / 60, pose(100));
  assert.ok(fire.particles.filter(p => p.life > 0).every(p => p.x > 99));
  fire.update(1 / 60, pose(100, 0));
  assert.ok(fire.particles.every(p => p.life === 0));
  fire.update(1 / 60, pose(100));
  assert.ok(fire.particles.some(p => p.life > 0));
  fire.reset();
  assert.ok(fire.particles.every(p => p.life === 0));
});

test('sprites grow and fade safely over life and zero-delta updates do not emit', () => {
  assert.equal(fireLife(0).alpha, 0);
  assert.equal(fireLife(1).alpha, 0);
  assert.ok(fireLife(.5).size > fireLife(.1).size);
  for (const age of [-1, 0, .25, .5, .75, 1, 2]) {
    const curve = fireLife(age);
    assert.ok(curve.alpha >= 0 && curve.alpha <= 1 && curve.size > 0);
  }
  const fire = createFireParticles();
  fire.update(0, pose());
  assert.equal(fire.emitted, 0);
});
