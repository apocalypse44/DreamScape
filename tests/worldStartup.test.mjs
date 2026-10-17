import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const cache = new Map();
function moduleUrl(file) {
  if (!cache.has(file.href)) {
    const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,
      (_, quote, path) => `from ${quote}${moduleUrl(new URL(path, file))}${quote}`);
    cache.set(file.href, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  return cache.get(file.href);
}
const { createWorld } = await import(moduleUrl(new URL('../src/models/world.js', import.meta.url)));

test('world startup returns live material profiles after legacy scenery removal', () => {
  class Geometry {}
  class Material { constructor(options) { Object.assign(this, options); } }
  globalThis.THREE = {
    CylinderGeometry: Geometry, ConeGeometry: Geometry,
    MeshLambertMaterial: Material, MeshPhongMaterial: Material,
  };
  globalThis.location = { search: '?seed=1234' };
  globalThis.history = { replaceState() {} };
  // Exercise the real constructor and its return value, without a WebGL renderer.
  const world = createWorld({ scene: {}, state: { chaos: 0 }, player: { position: { x: 0, z: 0 } }, onChunk() {} });
  assert.equal(world.seed, 1234);
  assert.equal(world.chunks.size, 0);
  assert.equal(world.terrainHeight(-400,0),1.5); // stable city bypasses noise/MathUtils
  assert.ok(world.materialProfiles.length > 0);
  for (const [material, profile] of world.materialProfiles) {
    assert.ok(material instanceof Material);
    assert.ok(Number.isFinite(profile.roughness));
  }
});
