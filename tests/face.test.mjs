import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickExpression, createBlinker, talkOpen, EXPRESSIONS } from '../src/models/faceExpression.js';

test('gameplay keeps a normal face; only cutscene overrides change it', () => {
  assert.equal(pickExpression({ speed: 12, sprinting: true, grounded: false, verticalSpeed: 8, chaos: .9 }), 'neutral');
  assert.equal(pickExpression({ speed: 0, chaos: .05, grounded: true }), 'smile');
  assert.equal(pickExpression({ speed: 12, override: 'surprised' }), 'surprised');
});

test('reactive mode follows what the traveller is doing', () => {
  const ground = { reactive: true, grounded: true, verticalSpeed: 0, speed: 0, chaos: .05 };
  assert.equal(pickExpression(ground), 'smile');                                   // calm and still
  assert.equal(pickExpression({ ...ground, speed: 4 }), 'neutral');
  assert.equal(pickExpression({ ...ground, speed: 12, sprinting: true }), 'effort');
  assert.equal(pickExpression({ ...ground, chaos: .8, speed: 4 }), 'determined');
  assert.equal(pickExpression({ ...ground, grounded: false, verticalSpeed: 8 }), 'joy');
  assert.equal(pickExpression({ ...ground, grounded: false, verticalSpeed: -15 }), 'surprised');
  assert.equal(pickExpression({ ...ground, combat: 'slash2' }), 'shout');
  assert.equal(pickExpression({ ...ground, combat: 'knockback' }), 'hurt');
  assert.equal(pickExpression({ ...ground, casting: true }), 'focus');
  assert.equal(pickExpression({ ...ground, petting: true, speed: 1 }), 'joy');
  assert.equal(pickExpression({ ...ground, combat: 'slash1', override: 'sad' }), 'sad'); // cutscenes win
  for (const name of ['smile', 'joy', 'effort', 'hurt', 'focus', 'determined', 'shout', 'surprised', 'sad', 'neutral']) assert.ok(EXPRESSIONS.includes(name), name);
});

test('blinks are brief and periodic, and never on already-closed eyes', () => {
  let n = 0; const random = () => [.5, .9, .5, .1][n++ % 4];
  const blinker = createBlinker(random); let closedFrames = 0, blinks = 0, wasClosed = false;
  for (let i = 0; i < 60 * 20; i++) {
    const closed = blinker.update(1 / 60, 'smile') > .5;
    if (closed) closedFrames++; if (closed && !wasClosed) blinks++; wasClosed = closed;
  }
  assert.ok(blinks >= 4 && blinks <= 10, `${blinks} blinks in 20 s`);
  assert.ok(closedFrames / blinks < 6, 'each blink lasts about a tenth of a second');
  const happy = createBlinker(() => 0); for (let i = 0; i < 600; i++) assert.equal(happy.update(1 / 60, 'joy'), 0);
});

test('the mouth moves only while speaking', () => {
  assert.equal(talkOpen(1.3, false), 0);
  const values = Array.from({ length: 120 }, (_, i) => talkOpen(i / 60, true));
  assert.ok(Math.max(...values) > .6 && Math.min(...values) === 0);
});
