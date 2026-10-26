import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
function load(file) {
  const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, q, path) => `from ${q}${load(new URL(path, file))}${q}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
// Minimal THREE and DOM doubles. The curve is three.js's centripetal Catmull-Rom (its default), so
// any overshoot between keys, e.g. near the Archive's west door, is what the game would show.
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
const element = () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, querySelector: () => element(), offsetWidth: 0 });
globalThis.document = { createElement: element, body: { appendChild() {}, classList: { add() {}, remove() {} } } };
const keydown = [];
globalThis.window = { addEventListener: (type, listener) => keydown.push(listener) };
const press = code => keydown.at(-1)({ code, preventDefault() {}, stopImmediatePropagation() {} });
const { createCloverScenes } = await import(load(new URL('../src/controllers/cloverScenes.js', import.meta.url)));
const { CLOVER_STORY, ARCHIVE_HALL, ARCHIVE_WALLS } = await import(load(new URL('../src/models/cloverCampaign.js', import.meta.url)));
const { shrineLayout } = await import(load(new URL('../src/rendering/cloverArchiveProps.js', import.meta.url)));

test('story events queue their shot once ready, it flies to the chest and restores the player view', () => {
  const camera = { position: new Vector3(1, 2, 3), quaternion: new THREE.Quaternion(), lookAt() {} };
  const state = { cinematic: false }, keys = new Set(), effects = [];
  const campaign = { scarReveal: k => effects.push(['scar', k]), hookRise: k => effects.push(['hook', k]) };
  const scenes = createCloverScenes({ camera, state, keys, campaign });
  scenes.queue('growing'); // ordinary events have no shot
  scenes.queue('sigil');
  scenes.observe(false);
  assert.equal(scenes.active, false);
  scenes.observe(true);
  assert.equal(scenes.active, true);
  assert.equal(state.cinematic, true);
  for (let t = 0; t < 18.5 - 1e-9; t += .1) scenes.update(.1);
  const { chest } = CLOVER_STORY;
  assert.ok(Math.hypot(camera.position.x - (chest.x - 4), camera.position.z - (chest.z + 9)) < .5, 'last key is reached at its second');
  for (let i = 0; i < 20 && scenes.active; i++) scenes.update(.1);
  assert.equal(scenes.active, false);
  assert.equal(state.cinematic, false);
  assert.deepEqual([camera.position.x, camera.position.y, camera.position.z], [1, 2, 3]);
  assert.deepEqual(effects.at(-1), ['scar', Infinity]);
  scenes.observe(true);
  assert.equal(scenes.active, false, 'nothing else was queued');
});

test('X skips and reset clears both a playing and a queued shot', () => {
  const camera = { position: new Vector3(), quaternion: new THREE.Quaternion(), lookAt() {} };
  const state = { cinematic: false }, keys = new Set();
  const scenes = createCloverScenes({ camera, state, keys, campaign: { scarReveal() {}, hookRise() {} } });
  scenes.queue('meet'); scenes.queue('hook');
  scenes.observe(true); scenes.update(.1);
  press('KeyX'); // input.js drops keys during cinematics, so the scene's own listener must skip
  assert.equal(scenes.active, false);
  scenes.observe(true);
  assert.equal(scenes.active, true);
  scenes.reset();
  assert.equal(scenes.active, false);
  assert.equal(state.cinematic, false);
});

test('no Clover shot puts the camera inside the Archive walls, its ceiling or a shrine pillar', () => {
  const camera = { position: new Vector3(), quaternion: new THREE.Quaternion(), lookAt() {} };
  const state = { cinematic: false }, keys = new Set(), near = .2; // camera near plane plus margin
  const campaign = { scarReveal() {}, hookRise() {}, heartBeacon() {} };
  const hall = ARCHIVE_HALL, over = p => p.x > hall.west - .3 && p.x < hall.east + .3 && p.z > hall.north - .3 && p.z < hall.south + .3;
  // Shrine pillars (crowned with an orb and clover up to 4.7 m) and arch pillars, as upright cylinders.
  const { pillars, archPillars } = shrineLayout();
  const columns = [...pillars.map(p => ({ ...p, radius: .6, top: p.floor + 4.7 })), ...archPillars.map(p => ({ ...p, radius: .5, top: p.floor + 4.5 }))];
  let inside = 0;
  // The chest shot turns toward the Heart gate, whose direction depends on the world seed: fly it
  // toward eight compass directions so the perch pillars are cleared whatever the seed.
  const { chest } = CLOVER_STORY;
  const runs = [[null, 'meet'], [null, 'sigil'], ...Array.from({ length: 8 }, (_, i) =>
    [{ x: chest.x + Math.cos(i * Math.PI / 4) * 600, y: 6, z: chest.z + Math.sin(i * Math.PI / 4) * 600 }, 'hook'])];
  for (const [heart, kind] of runs) {
    const scenes = createCloverScenes({ camera, state, keys, campaign, heart });
    scenes.queue(kind); scenes.observe(true);
    for (let i = 0; i < 3000 && scenes.active; i++) {
      scenes.update(1 / 100);
      if (!scenes.active) break;
      const p = camera.position;
      assert.ok([p.x, p.y, p.z].every(Number.isFinite), `${kind} shot camera is not finite`);
      for (const w of ARCHIVE_WALLS) assert.ok(!(Math.abs(p.x - w.x) < w.width / 2 + near && Math.abs(p.z - w.z) < w.depth / 2 + near &&
        p.y > w.bottom - near && p.y < w.top + near), `${kind} shot enters an Archive wall at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`);
      for (const c of columns) assert.ok(!(Math.hypot(p.x - c.x, p.z - c.z) < c.radius + near && p.y < c.top + near),
        `${kind} shot enters a shrine pillar at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`);
      if (over(p) && p.y < hall.top + 4) { inside++; assert.ok(p.y < hall.top - near, `${kind} shot pierces the Archive ceiling at y ${p.y.toFixed(2)}`); }
    }
  }
  assert.ok(inside > 0, 'the meet shot starts inside the hall with Iven');
});

test('the chest shot swoops to the Heart gate and back, streaming terrain there only while away', () => {
  const camera = { position: new Vector3(), quaternion: new THREE.Quaternion(), lookAt() {} };
  const heart = { x: 400, y: 9, z: -120 }, state = { cinematic: false };
  const scenes = createCloverScenes({ camera, state, keys: new Set(), campaign: { scarReveal() {}, hookRise() {} }, heart });
  assert.equal(scenes.focus, null);
  scenes.queue('hook'); scenes.observe(true);
  let nearest = Infinity, focused = 0, focusAtEnd = null;
  while (scenes.active) {
    scenes.update(1 / 50);
    if (!scenes.active) break;
    nearest = Math.min(nearest, Math.hypot(camera.position.x - heart.x, camera.position.z - heart.z));
    if (scenes.focus) { focused++; assert.equal(scenes.focus, heart); }
    focusAtEnd = scenes.focus;
  }
  assert.ok(nearest < 40, `the camera reached the Heart gate (closest ${nearest.toFixed(1)} m)`);
  assert.ok(focused > 0 && focusAtEnd === null, 'streaming follows the camera to Heart, then returns to the player');
  assert.equal(scenes.focus, null);
});
