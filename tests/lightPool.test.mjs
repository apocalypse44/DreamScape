import test from 'node:test';
import assert from 'node:assert/strict';

class Light {
  constructor(color = 0, intensity = 1, distance = 0, decay = 1) {
    Object.assign(this, { intensity, distance, decay, visible: true, parent: null, layer: 0 });
    this.color = { value: color, copy(c) { this.value = c.value; } };
    this.position = { set: (x, y, z) => { this.pos = [x, y, z]; } };
    this.layers = { set: n => { this.layer = n; } };
    this.matrixWorld = { elements: Array(16).fill(0) };
  }
  updateWorldMatrix() {}
  place(x) { this.matrixWorld.elements[12] = x; return this; }
}
globalThis.THREE = { PointLight: Light };
const { createLightPool } = await import('../src/rendering/lightPool.js');

test('the nearest shown lamps get the real lights; the rest stay out of the shaders', () => {
  const scene = { visible: true, parent: null, children: [], add(o) { o.parent = this; this.children.push(o); } };
  const pool = createLightPool(scene, 2);
  const lamp = (x, color, reach = 10, parent = scene) => { const l = new THREE.PointLight(color, 1, reach).place(x); l.parent = parent; return l; };
  const hiddenRoom = { visible: false, parent: scene };
  const near = lamp(5, 'near'), far = lamp(100, 'far'), mid = lamp(30, 'mid'), off = lamp(1, 'hidden', 10, hiddenRoom);
  const elsewhere = lamp(0, 'other scene', 10, { visible: true, parent: null });
  const dark = lamp(2, 'dark'); dark.intensity = 0;

  pool.update({ x: 0, y: 0, z: 0 });
  assert.deepEqual(pool.slots.map(s => s.color.value), ['near', 'mid']);
  assert.deepEqual(pool.slots[1].pos, [30, 0, 0]);
  for (const l of [near, far, mid, dark]) assert.equal(l.layer, 31);
  assert.equal(off.layer, 0); assert.equal(elsewhere.layer, 0); // not this scene's to manage

  near.intensity = 0; // a lamp switched off frees its slot
  pool.update({ x: 0, y: 0, z: 0 });
  assert.deepEqual(pool.slots.map(s => s.color.value), ['mid', 'far']);
  far.intensity = 0; mid.intensity = 0;
  pool.update({ x: 0, y: 0, z: 0 });
  assert.equal(pool.slots[0].intensity, 0);
});
