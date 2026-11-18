// The Ember Hound parkour, on the real terrain across many world seeds: the climb must start once the course
// appears in a strong sprint (~0.75 chaos, as before 6196fe7 lifted the shards), and the reshaping ground
// must never rise through a shard. Prints the per-seed start chaos when run directly.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const cache = new Map();
function moduleUrl(file) {
  if (!cache.has(file.href)) {
    const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,
      (_, q, path) => `from ${q}${moduleUrl(new URL(path, file))}${q}`);
    cache.set(file.href, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  return cache.get(file.href);
}
class Geometry {}
class Material { constructor(o) { Object.assign(this, o); } }
globalThis.THREE = { CylinderGeometry: Geometry, ConeGeometry: Geometry, MeshLambertMaterial: Material, MeshPhongMaterial: Material,
  MathUtils: { clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), lerp: (a, b, t) => (1 - t) * a + t * b,
    smoothstep: (x, lo, hi) => x <= lo ? 0 : x >= hi ? 1 : ((x - lo) / (hi - lo)) ** 2 * (3 - 2 * (x - lo) / (hi - lo)) } };
globalThis.history = { replaceState() {} };
const { createWorld } = await import(moduleUrl(new URL('../src/models/world.js', import.meta.url)));
const { createQuest } = await import(moduleUrl(new URL('../src/models/quest.js', import.meta.url)));

const JUMP = 10.5 ** 2 / 50; // apex, m
// Best take-off ground beside a shard: highest terrain in a ring just outside its rock.
const launch = (world, s, chaos) => {
  let best = -Infinity;
  for (let a = 0; a < 24; a++) for (const r of [2, 2.6, 3.2]) best = Math.max(best, world.heightAt(s.x + Math.cos(a / 24 * 2 * Math.PI) * r, s.z + Math.sin(a / 24 * 2 * Math.PI) * r, chaos));
  return best;
};
const COURSE_CHAOS = [0.66, 0.75, 0.88, 0.98];
test('the ember climb starts by ~0.8 chaos on almost every seed and no shard is ever swallowed', () => {
  const starts = [];
  for (let seed = 1000; seed < 1030; seed++) {
    globalThis.location = { search: `?seed=${seed}` };
    const world = createWorld({ scene: {}, state: { chaos: 0 }, player: { position: { x: 0, z: 0 } }, onChunk() {} });
    const p = createQuest({ world, state: { chaos: .06, mode: 'calm' }, player: { position: { x: 0, y: 2, z: 0 } } }).platforms;
    for (const s of p) for (const c of COURSE_CHAOS) for (const [dx, dz] of [[0, 0], ...s.outline]) {
      assert.ok(s.top - world.heightAt(s.x + dx, s.z + dz, c) >= .29, `seed ${seed}: ground rises through a shard at chaos ${c}`);
    }
    // Lowest chaos at which some shard is reachable from its ground and every later one from the last or its ground.
    const ok = (t, prev, c) => t.top - Math.max(prev ?? -Infinity, launch(world, t, c)) <= JUMP - .15;
    const reachable = c => p.some((s, i) => ok(s, null, c) && p.slice(i + 1).every((t, j) => ok(t, p[i + j].top, c)));
    let start = 1;
    for (let c = .66; c <= .981; c += .01) if (reachable(c)) { start = +c.toFixed(2); break; }
    starts.push(start);
  }
  starts.sort((a, b) => a - b);
  if (process.argv[1]?.endsWith('courseReach.test.mjs')) console.log('start chaos by seed:', starts.join(' '));
  assert.ok(starts[Math.floor(starts.length * .9)] <= .8, `90th percentile start chaos ${starts[Math.floor(starts.length * .9)]}`);
  assert.ok(starts.at(-1) <= .92, `worst seed needs ${starts.at(-1)}`);
});
