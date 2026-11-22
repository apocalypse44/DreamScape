import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLessons, LESSONS } from '../src/models/lessons.js';

test('steps run in order; only the current step counts; counts reach the need', () => {
  const l = createLessons();
  assert.equal(l.current.id, 'swing');
  assert.equal(l.record('block'), false); assert.equal(l.current.id, 'swing'); // not yet
  l.record('swing'); l.record('swing'); assert.equal(l.count('swing'), 2);
  assert.equal(l.record('swing'), true); assert.equal(l.current.id, 'block');
});

test('the spells step needs four different runes; repeats do not count', () => {
  const l = createLessons(LESSONS.filter(s => s.id === 'spells'));
  l.record('cast:flame'); l.record('cast:flame'); l.record('cast:tide'); l.record('cast:wind');
  assert.equal(l.done, false); assert.equal(l.count('spells'), 3);
  assert.equal(l.record('cast:earth'), true); assert.equal(l.done, true); assert.equal(l.current, null);
});

test('casts before the spells step do not pre-fill it; skip moves on; done after the last step', () => {
  const l = createLessons();
  l.record('cast:flame');
  while (l.current.id !== 'spells') l.skip();
  assert.equal(l.count('spells'), 0);
  for (let i = 0; i < LESSONS.length; i++) l.skip();
  assert.equal(l.done, true); assert.equal(l.record('chaos'), false);
});
