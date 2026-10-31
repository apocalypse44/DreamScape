import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/models/houndScene.js', import.meta.url), 'utf8');
const { createHoundScene, HOUND_LINES, HOUND_CURE_LINES, TRANSFORM_SECONDS, PHASE_SECONDS, houndTransformation, blendShot, smoother } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('curse scene waits for safe gameplay and plays once until the game resets', () => {
  const scene = createHoundScene();
  assert.equal(scene.observe('companion', true), false);
  assert.equal(scene.observe('cursed', false), false); // map, travel, airborne or menu
  assert.equal(scene.active, false);
  assert.equal(scene.observe('cursed', true), true);
  assert.equal(scene.phase, 'enter');
  scene.skip(); scene.update(PHASE_SECONDS.exit); scene.update(PHASE_SECONDS.return);
  assert.equal(scene.active, false);
  assert.equal(scene.observe('cursed', true), false);
  assert.equal(scene.observe('companion', true), false);
  assert.equal(scene.observe('cursed', true), false);
  scene.reset();
  assert.equal(scene.observe('cursed', true), true);
});

test('dialogue advances automatically, restores through a fade, and never changes the quest', () => {
  const scene = createHoundScene();
  scene.observe('cursed', true);
  scene.update(PHASE_SECONDS.enter);
  assert.equal(scene.phase, 'transform');
  scene.update(TRANSFORM_SECONDS);
  for (let index = 1; index < HOUND_LINES.length; index++) {
    assert.equal(scene.index, index);
    assert.equal(scene.phase, 'dialogue');
    scene.update(HOUND_LINES[index].seconds);
  }
  assert.equal(scene.phase, 'exit');
  scene.update(PHASE_SECONDS.exit);
  assert.equal(scene.phase, 'return');
  scene.update(PHASE_SECONDS.return);
  assert.equal(scene.active, false);
});

test('continue, skip, reset and zero-delta focus pauses are safe in every phase', () => {
  const scene = createHoundScene();
  scene.next(); scene.skip();
  assert.equal(scene.active, false);
  scene.observe('cursed', true);
  scene.next();
  scene.update(0);
  assert.equal(scene.time, 0);
  scene.next();
  assert.equal(scene.index, 1);
  scene.skip(); scene.skip();
  assert.equal(scene.phase, 'exit');
  scene.reset();
  assert.equal(scene.active, false);
  assert.equal(scene.index, 0);
  assert.equal(scene.observe('return', true), false);
});

test('only a completed cure triggers the keeper scene, reverses the transformation and explains the Spade lead', () => {
  const scene = createHoundScene();
  assert.equal(scene.observe('return', true), false); // all embers held, offering not yet finished
  assert.equal(scene.observe('cured', false), false); // queue until grounded, focused, and keeper ready
  assert.equal(scene.kind, 'cure');
  assert.deepEqual(scene.transformation, { fire: 1, wolf: 1 });
  assert.equal(scene.observe('cured', true), true);
  scene.update(PHASE_SECONDS.enter); scene.update(2);
  assert.ok(scene.transformation.fire < 1);
  assert.equal(scene.transformation.wolf, 1);
  scene.update(TRANSFORM_SECONDS - 2);
  assert.equal(scene.phase, 'dialogue');
  assert.deepEqual(scene.transformation, { fire: 0, wolf: 0 });
  for (let index = 1; index < HOUND_CURE_LINES.length; index++) {
    assert.equal(scene.index, index);
    assert.ok(['YOU', 'SHRINE KEEPER'].includes(scene.line.speaker));
    scene.update(scene.line.seconds);
  }
  scene.update(PHASE_SECONDS.exit); scene.update(PHASE_SECONDS.return);
  assert.equal(scene.active, false);
  assert.equal(scene.observe('cured', true), false);
  assert.match(HOUND_CURE_LINES.map(line => line.text).join(' '), /How did this.*shrine remembers/s); // leads into the memory
  scene.reset();
  assert.equal(scene.observe('cured', true), true);
});

test('curse and cure are independent once-per-run scenes and skipping either reaches the same completed state', () => {
  const scene = createHoundScene();
  for (const [stage, kind] of [['cursed', 'curse'], ['cured', 'cure']]) {
    assert.equal(scene.observe(stage, true), true);
    assert.equal(scene.kind, kind);
    scene.skip(); scene.update(PHASE_SECONDS.exit); scene.update(PHASE_SECONDS.return);
    assert.equal(scene.active, false);
    assert.equal(scene.observe(stage, true), false);
  }
});

test('the dog is normal first, slowly catches fire, then grows into a fully burning wolf', () => {
  assert.deepEqual(houndTransformation(0), { fire: 0, wolf: 0 });
  assert.deepEqual(houndTransformation(1.5), { fire: 0, wolf: 0 });
  const ignition = houndTransformation(3);
  assert.ok(ignition.fire > 0 && ignition.fire < 1);
  assert.equal(ignition.wolf, 0);
  assert.deepEqual(houndTransformation(4.5), { fire: 1, wolf: 0 });
  const growth = houndTransformation(6);
  assert.equal(growth.fire, 1);
  assert.ok(growth.wolf > 0 && growth.wolf < 1);
  assert.deepEqual(houndTransformation(TRANSFORM_SECONDS), { fire: 1, wolf: 1 });
});

test('a change of shot arcs the short way round and starts and stops gently', () => {
  const pose = az => ({ x: 0, y: 1, z: 0, az, pitch: .2, dist: 4, fov: 44, roll: 0 });
  const mid = blendShot(pose(3), pose(-3), .5);          // across ±π: through π, not back through 0
  assert.ok(Math.abs(Math.abs(mid.az) - Math.PI) < .01);
  assert.deepEqual(blendShot(pose(1), pose(2), 0), pose(1));
  assert.equal(blendShot(pose(1), pose(2), 1).az, 2);
  assert.equal(smoother(0), 0); assert.equal(smoother(1), 1); assert.equal(smoother(.5), .5);
  assert.ok(smoother(.02) < .001 && smoother(.98) > .999); // no lurch at either end
});
