import test from 'node:test';
import assert from 'node:assert/strict';
import { skipStillPoses } from '../src/rendering/anim.js';

test('bones re-upload only after a pose step or a move', () => {
  const uploads = [];
  const skeletons = ['body', 'cape'].map(name => ({ update() { uploads.push(name); } }));
  const root = { matrixWorld: { elements: Array.from({ length: 16 }, (_, i) => +(i % 5 === 0)) } };
  const markPosed = skipStillPoses(skeletons, root);
  const render = () => { uploads.length = 0; skeletons.forEach(s => s.update()); return [...uploads]; };

  assert.deepEqual(render(), ['body', 'cape']); // first frame always uploads
  assert.deepEqual(render(), []);               // nothing changed: skipped
  markPosed();
  assert.deepEqual(render(), ['body', 'cape']); // the animation stepped: both skeletons upload
  assert.deepEqual(render(), []);
  root.matrixWorld.elements[12] += 0.1;         // walked without a pose step (distant NPC between steps)
  assert.deepEqual(render(), ['body', 'cape']); // world-space bones must follow the body
  assert.deepEqual(render(), []);
});
