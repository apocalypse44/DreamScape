import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
function load(file) {
  const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, q, path) => `from ${q}${load(new URL(path, file))}${q}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const { guideYaw, visibleRoadSegments } = await import(load(new URL('../src/rendering/cloverRoadLayout.js', import.meta.url)));
const { growRoots, ROOT_LANDINGS } = await import(load(new URL('../src/models/cloverGrowth.js', import.meta.url)));
const inside = p => ROOT_LANDINGS.some(pad => Math.abs(p.x - pad.x) < pad.width / 2 - 1e-6 && Math.abs(p.z - pad.z) < pad.depth / 2 - 1e-6);

test('all four rendered arrow tips match the turtle cardinal headings', () => {
  for (const [heading, [x, z]] of [[0,[0,-1]],[1,[1,0]],[2,[0,1]],[3,[-1,0]]]) {
    const yaw = guideYaw(heading);
    assert.ok(Math.abs(-Math.sin(yaw) - x) < 1e-8);
    assert.ok(Math.abs(-Math.cos(yaw) - z) < 1e-8);
  }
});
test('road render bodies meet landing edges without painting over their grass', () => {
  const roads = growRoots().backbone, original = JSON.stringify(roads);
  for (const road of roads) {
    const parts = visibleRoadSegments(road); assert.equal(parts.length, 1);
    for (const part of parts) for (let i = 1; i < 100; i++) {
      const t = i / 100;
      assert.equal(inside({x: part.from.x + (part.to.x - part.from.x) * t, z: part.from.z + (part.to.z - part.from.z) * t}), false);
    }
  }
  assert.equal(JSON.stringify(roads), original, 'render trimming must not change support or growth coordinates');
  assert.equal(visibleRoadSegments(roads[0])[0].from.x, -43);
  assert.equal(visibleRoadSegments(roads[0])[0].to.x, -62);
});
test('growth hidden beneath its starting landing emerges at the correct animated tip', () => {
  const road = growRoots().backbone[0];
  assert.deepEqual(visibleRoadSegments(road, 0), []);
  assert.deepEqual(visibleRoadSegments(road, .1), []);
  const [part] = visibleRoadSegments(road, .5);
  assert.equal(part.from.x, -43); assert.equal(part.to.x, -51);
});
test('render clipping remains bounded for wrong cardinal headings and arbitrary seeds', () => {
  for (let seed = 0; seed < 20; seed++) for (let heading = 0; heading < 4; heading++) {
    const [road] = growRoots({rounds:1, seed, guides:[heading]}).backbone;
    for (const p of [.1,.5,1]) for (const part of visibleRoadSegments(road,p)) {
      for (const endpoint of [part.from,part.to]) for (const value of Object.values(endpoint)) assert.ok(Number.isFinite(value));
      assert.equal(inside({x:(part.from.x+part.to.x)/2,z:(part.from.z+part.to.z)/2}),false);
    }
  }
});
