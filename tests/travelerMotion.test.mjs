import assert from 'node:assert/strict';
import { test } from 'node:test';
const { createTravelerMotion } = await import(new URL('../src/models/travelerMotion.js', import.meta.url));
const dt = 1 / 60;
const step = (m, frames, input) => { let pose; for (let i = 0; i < frames; i++) pose = m.update(dt, { speed: 3, grounded: true, ...input }); return pose; };

test('a stair or a slope lip (a few frames off the ground, no jump) keeps walking, with no landing', () => {
  const m = createTravelerMotion();
  step(m, 10, {});
  for (let k = 0; k < 6; k++) {
    const off = step(m, 4, { grounded: false, verticalSpeed: -2 });
    assert.equal(off.name, 'jogging', 'still walking down the stairs');
    const on = step(m, 1, {});
    assert.equal(on.landed, false, 'no landing pose on each stair');
  }
});

test('stepping off a real edge falls after a moment and lands; a jump jumps at once', () => {
  const m = createTravelerMotion();
  step(m, 10, {});
  assert.equal(step(m, 20, { grounded: false, verticalSpeed: -6 }).name, 'falling');
  assert.equal(step(m, 1, {}).landed, true);
  step(m, 20, {});
  const jump = m.update(dt, { speed: 3, grounded: false, verticalSpeed: 8 });
  assert.equal(jump.name, 'jumping');
});

test('going down steep natural ground slides; gentle slopes walk; easing off the slope stops the slide', () => {
  const m = createTravelerMotion();
  assert.equal(step(m, 10, { descent: 3 * 0.2 }).name, 'jogging', 'a gentle slope');
  const slide = step(m, 10, { descent: 3 * 0.45 });
  assert.equal(slide.name, 'sliding'); assert.equal(slide.sliding, true);
  assert.equal(step(m, 5, { descent: 3 * 0.3 }).name, 'sliding', 'hysteresis: no flicker just under the threshold');
  assert.equal(step(m, 5, { descent: 3 * 0.1 }).name, 'jogging');
  assert.equal(step(m, 5, { descent: 0.6, speed: 0.5 }).name, 'walking', 'standing almost still on a slope is not a slide');
});
