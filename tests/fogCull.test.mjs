import assert from 'node:assert/strict';
import { test } from 'node:test';

// Just enough THREE for fogCull.js: points, spheres (translated by a position-only matrixWorld) and boxes.
class V { constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
  clone() { return new V(this.x, this.y, this.z); } copy(v) { return Object.assign(this, { x: v.x, y: v.y, z: v.z }); }
  addScalar(s) { this.x += s; this.y += s; this.z += s; return this; } subScalar(s) { return this.addScalar(-s); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); } }
class Sphere { constructor(center = new V(), radius = 0) { Object.assign(this, { center, radius }); }
  copy(s) { this.center = s.center.clone(); this.radius = s.radius; return this; }
  applyMatrix4(m) { this.center.x += m.x; this.center.y += m.y; this.center.z += m.z; return this; } }
class Box3 { makeEmpty() { this.min = new V(Infinity, Infinity, Infinity); this.max = new V(-Infinity, -Infinity, -Infinity); return this; }
  isEmpty() { return this.max.x < this.min.x; }
  expandByPoint(p) { for (const k of 'xyz') { this.min[k] = Math.min(this.min[k], p[k]); this.max[k] = Math.max(this.max[k], p[k]); } return this; }
  getBoundingSphere(s) { const c = new V((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2, (this.min.z + this.max.z) / 2);
    s.center = c; s.radius = c.distanceTo(this.max); return s; } }
globalThis.THREE = { Box3, Sphere };

const { createFogCull } = await import('../src/rendering/fogCull.js');

function node(children = [], extra = {}) {
  const n = { children, visible: true, userData: {}, ...extra,
    traverse(f) { f(n); for (const c of n.children) c.traverse(f); } };
  return n;
}
const mesh = (x, radius, extra = {}) => node([], { isMesh: true, castShadow: true, matrixWorld: { x, y: 0, z: 0 },
  geometry: { boundingSphere: new Sphere(new V(), radius) }, material: {}, ...extra });

test('scenery past the fog is hidden only for the draw; lights and glows never are; small meshes stop casting', () => {
  const far = node([mesh(500, 5)]), near = node([mesh(20, 5)]);
  const lit = node([mesh(500, 5), node([], { isLight: true })]);
  const glow = node([mesh(500, 5, { material: { fog: false } })]);
  const pebble = mesh(30, 0.3);
  const scene = { children: [far, near, lit, glow, node([pebble])], fog: { density: 0.012 } }; // hidden past ~192 m
  const cull = createFogCull(scene, { position: new V() });
  cull.rebuild();
  cull.hide();
  assert.equal(far.visible, false);
  assert.equal(near.visible, true);
  assert.equal(lit.visible, true);
  assert.equal(glow.visible, true);
  assert.equal(pebble.castShadow, false);
  cull.restore();
  assert.equal(far.visible, true);
});
