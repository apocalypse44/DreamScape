import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
function load(file) {
  const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, q, path) => `from ${q}${load(new URL(path, file))}${q}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const { rewriteRoots, growRoots, ROOT_HEADINGS, ROOT_LANDINGS, ROOT_LIMITS, rootConnects, rootBridge, rootObstacleHit } =
  await import(load(new URL('../src/models/cloverGrowth.js', import.meta.url)));

test('bounded symbol rewriting expands branch buds and preserves road terminals', () => {
  assert.equal(rewriteRoots(0), 'X'); assert.equal(rewriteRoots(1), 'F[+B][-B]X');
  assert.equal((rewriteRoots(3).match(/F/g) || []).length, 3);
  assert.ok((rewriteRoots(3).match(/d/g) || []).length > (rewriteRoots(2).match(/d/g) || []).length);
  for (const rounds of [-1, 4, 100, 1.5, NaN]) assert.throws(() => rewriteRoots(rounds), RangeError);
});
test('every tested seed has a valid backbone and remains below the hard segment budget', () => {
  for (let seed = 1; seed <= 120; seed++) for (let rounds = 1; rounds <= 3; rounds++) {
    const growth = growRoots({ seed, rounds });
    assert.ok(growth.segments.length <= ROOT_LIMITS.segments);
    assert.equal(growth.backbone.length, rounds);
    growth.backbone.forEach((segment, i) => assert.ok(rootConnects(segment, ROOT_LANDINGS[i + 1])));
    assert.deepEqual(growth, growRoots({ seed, rounds }));
  }
  assert.notDeepEqual(growRoots({ seed: 1 }).segments, growRoots({ seed: 2 }).segments);
});
test('rewriting later generations never relocates an already completed road', () => {
  for (let rounds = 1; rounds < 3; rounds++) {
    assert.deepEqual(growRoots({ rounds }).backbone, growRoots({ rounds: rounds + 1 }).backbone.slice(0, rounds));
  }
});
test('a wrong heading meets an obstacle and cannot activate a crossing', () => {
  const guides = [...ROOT_HEADINGS]; guides[0] = 0;
  const first = growRoots({ rounds: 1, guides }).backbone[0];
  assert.equal(first.blocked, true); assert.equal(rootConnects(first, ROOT_LANDINGS[1]), false);
  assert.ok(Math.hypot(first.to.x - first.from.x, first.to.z - first.from.z) < 8);
  assert.equal(rootObstacleHit({ x: 0, z: 0 }, { x: 20, z: 0 }, [{ x: 10, z: 0, radius: 1 }], 0), .45);
});
test('only designated, completed horizontal road runs become support surfaces', () => {
  const segments = growRoots().backbone; let active = false;
  for (const segment of segments) {
    const platform = rootBridge(segment, () => active);
    assert.equal(platform.contains(platform.x, platform.z), false);
    active = true; assert.equal(platform.contains(platform.x, platform.z), true);
    assert.equal(platform.top, 12);
    assert.equal(platform.contains(platform.x + platform.width, platform.z + platform.depth), false);
    active = false;
  }
});
