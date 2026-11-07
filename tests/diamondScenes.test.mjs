import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
function load(file) {
  const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, q, path) => `from ${q}${load(new URL(path, file))}${q}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
// Minimal THREE and DOM doubles, as in cloverScenes.test.mjs: three.js's centripetal Catmull-Rom, so any
// overshoot between keys is what the game would show.
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
}
function catmull(x0, x1, x2, x3, dt0, dt1, dt2, t) {
  const t1 = ((x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1) * dt1;
  const t2 = ((x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2) * dt1;
  return x1 + t1 * t + (-3 * x1 + 3 * x2 - 2 * t1 - t2) * t * t + (2 * x1 - 2 * x2 + t1 + t2) * t * t * t;
}
globalThis.THREE = {
  Vector3, Quaternion: class { copy() { return this; } },
  CatmullRomCurve3: class {
    constructor(points) { this.points = points; }
    getPoint(u) {
      const pts = this.points, l = pts.length, p = (l - 1) * u;
      let i = Math.floor(p), w = p - i;
      if (i >= l - 1) { i = l - 2; w = 1; }
      const ext = (a, b) => new Vector3(2 * a.x - b.x, 2 * a.y - b.y, 2 * a.z - b.z);
      const p0 = i > 0 ? pts[i - 1] : ext(pts[0], pts[1]), p1 = pts[i], p2 = pts[i + 1], p3 = i + 2 < l ? pts[i + 2] : ext(pts[l - 1], pts[l - 2]);
      const d = (a, b) => Math.pow((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2, .25);
      let dt0 = d(p0, p1), dt1 = d(p1, p2), dt2 = d(p2, p3);
      if (dt1 < 1e-4) dt1 = 1; if (dt0 < 1e-4) dt0 = dt1; if (dt2 < 1e-4) dt2 = dt1;
      return new Vector3(...['x', 'y', 'z'].map(k => catmull(p0[k], p1[k], p2[k], p3[k], dt0, dt1, dt2, w)));
    }
  },
};
const element = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, querySelector: () => element(), offsetWidth: 0 });
globalThis.document = { createElement: element, body: { appendChild() {}, classList: { add() {}, remove() {} } } };
globalThis.window = { addEventListener() {} };
const { createCloverScenes } = await import(load(new URL('../src/controllers/cloverScenes.js', import.meta.url)));
const { createDiamondKingdom, DIAMOND_BASE, CITADEL, CITADEL_TOP } = await import(load(new URL('../src/models/diamond.js', import.meta.url)));
const { HALL } = await import(load(new URL('../src/models/diamondRow.js', import.meta.url)));
const { DIAMOND_SHOTS, shotKeys, chainOrderStage, CHAIN_ORDER_SMASH, diamondMapLocations, fingerposts } = await import(load(new URL('../src/models/diamondStory.js', import.meta.url)));

const k = createDiamondKingdom({ x: 9, z: 344 });
// Fly a shot through the real scene player and return every camera position (10 per second).
function fly(name) {
  const camera = { position: new Vector3(1, 2, 3), quaternion: new THREE.Quaternion(), lookAt() {} };
  const state = { cinematic: false }, scenes = createCloverScenes({ camera, state, keys: new Set(), campaign: {} });
  const shot = DIAMOND_SHOTS[name];
  scenes.define(name, { ...shot, keys: shotKeys(k, shot).map(([t, a, b]) => [t, new Vector3(a.x, a.y, a.z), new Vector3(b.x, b.y, b.z)]) });
  scenes.queue(name); scenes.observe(true);
  const path = [];
  for (let i = 0; i < 2000 && scenes.active; i++) { scenes.update(.1); if (scenes.active) path.push({ ...camera.position }); }
  assert.equal(scenes.active, false, `${name} ends`);
  assert.deepEqual({ ...camera.position }, { x: 1, y: 2, z: 3 }, `${name} restores the view`);
  return path;
}
const prism = (() => { const p = k.at(CITADEL.u - 25, 0); return { ...p, y: CITADEL_TOP + 17 }; })();

for (const name of ['arrival', 'power']) test(`the ${name} shot stays above the ground, off the citadel and clear of the Great Prism`, () => {
  for (const p of fly(name)) {
    const { u, v } = k.local(p.x, p.z);
    assert.ok(p.y > k.ground(p.x, p.z, DIAMOND_BASE) + 2, `${name}: camera at u=${u.toFixed(1)} v=${v.toFixed(1)} is ${(p.y - k.ground(p.x, p.z, DIAMOND_BASE)).toFixed(2)} m above ground`);
    assert.ok(Math.hypot(u - CITADEL.u, v) > 26 || p.y > CITADEL_TOP + 52, `${name}: camera inside the citadel at u=${u.toFixed(1)}`);
    assert.ok(Math.hypot(p.x - prism.x, p.y - prism.y, p.z - prism.z) > 12, `${name}: camera hits the Great Prism`);
    assert.ok(!(u > HALL.u0 - 1 && u < HALL.u1 + 1 && v > HALL.v0 - 1 && v < HALL.v1 + 1 && p.y < DIAMOND_BASE + HALL.h + 6), `${name}: camera in Orin's Hall`);
  }
});

test('"The Chain Order" camera never leaves Orin’s Hall or rises through its ceiling', () => {
  for (const p of fly('chainOrder')) {
    const { u, v } = k.local(p.x, p.z);
    assert.ok(u > HALL.u0 + .6 && u < HALL.u1 - .6 && v > HALL.v0 + .6 && v < HALL.v1 - .6, `outside the hall at u=${u.toFixed(2)} v=${v.toFixed(2)}`);
    assert.ok(p.y > DIAMOND_BASE + .8 && p.y < DIAMOND_BASE + HALL.h - .5, `height ${p.y.toFixed(2)}`);
  }
});

test('Orin’s lead shot looks down on him from above the quarry’s crystal stumps', () => {
  for (const p of fly('lead')) assert.ok(p.y > k.quarry.pit(p.x, p.z) + 3);
});

test('"The Chain Order" returns fully to the present, in story order', () => {
  const end = chainOrderStage(40);
  assert.deepEqual([end.amount, end.morcant, end.binding, end.storm, end.smoke], [0, 0, 0, 0, 0]);
  const first = name => { for (let t = 0; t < 40; t += .05) if (chainOrderStage(t)[name] > 0) return t; return Infinity; };
  assert.ok(first('morcant') < first('binding') && first('binding') <= first('chains'), 'Morcant arrives, then binds the forge, then the chains pile up');
  assert.ok(chainOrderStage(first('mark')).morcant === 0, 'the plea is scratched after Morcant has gone');
  assert.ok(first('mark') < CHAIN_ORDER_SMASH && chainOrderStage(CHAIN_ORDER_SMASH - .01).smash < 0 && chainOrderStage(CHAIN_ORDER_SMASH).smash === 0);
  assert.ok(DIAMOND_SHOTS.chainOrder.keys.at(-1)[0] + 1 > 33.8, 'the shot outlasts the memory');
});

test('Atlas destinations and fingerposts stand on walkable ground off the roads', () => {
  const places = diamondMapLocations(k);
  assert.equal(new Set(places.map(p => p.id)).size, 6);
  for (const p of places) {
    assert.ok(p.name && p.directions && p.labelY > .5 && p.labelY < 1);
    assert.ok(Number.isFinite(k.ground(p.destination.x, p.destination.z, DIAMOND_BASE)));
  }
  for (const post of fingerposts(k)) {
    assert.equal(k.ground(post.x, post.z, 9), DIAMOND_BASE);
    assert.ok(!k.road(post.x, post.z, .3), `fingerpost at u=${post.u} stands on the road`);
    assert.ok(post.boards.length >= 2);
  }
});
