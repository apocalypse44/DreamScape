import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/models/worldClock.js', import.meta.url), 'utf8');
const { createWorldClock } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('twenty real minutes advance a full day from the morning start', () => {
  const clock = createWorldClock();
  assert.equal(clock.label, '09:00');
  clock.advance(150);
  assert.equal(clock.label, '12:00');
  clock.advance(1050);
  near(clock.hour, 9);
  assert.equal(clock.day, 1);
});

test('time is independent of frame rate and wraps across midnight', () => {
  const slow = createWorldClock({ startHour: 23 });
  const fast = createWorldClock({ startHour: 23 });
  for (let i = 0; i < 1800; i++) slow.advance(1 / 30);
  for (let i = 0; i < 8640; i++) fast.advance(1 / 144);
  near(slow.hour, 0.2);
  near(fast.hour, slow.hour);
  assert.equal(slow.day, 1);
  assert.equal(fast.day, 1);
});

test('demo time changes and pause do not replace or restart the shared clock', () => {
  const clock = createWorldClock();
  clock.setHour(25.5);
  assert.equal(clock.label, '01:30');
  clock.setPaused(true);
  clock.advance(1200);
  assert.equal(clock.hour, 1.5);
  clock.setPaused(false);
  clock.advance(50);
  near(clock.hour, 2.5);
  clock.setHour(-1);
  assert.equal(clock.label, '23:00');
});

test('reset restores the configured morning and unpauses time', () => {
  const clock = createWorldClock({ startHour: 8, dayLengthSeconds: 600 });
  clock.advance(1250);
  assert.equal(clock.day, 2);
  clock.setPaused(true);
  clock.reset();
  assert.equal(clock.hour, 8);
  assert.equal(clock.day, 0);
  assert.equal(clock.paused, false);
  clock.advance(25);
  near(clock.dayProgress, 9 / 24);
});

test('invalid frame deltas cannot corrupt the clock', () => {
  const clock = createWorldClock();
  for (const dt of [-1, NaN, Infinity, undefined, 0]) clock.advance(dt);
  assert.equal(clock.hour, 9);
  assert.equal(clock.day, 0);
  for (const dayLengthSeconds of [0, -1, NaN, Infinity]) {
    assert.throws(() => createWorldClock({ dayLengthSeconds }), RangeError);
  }
  assert.throws(() => clock.setHour(NaN), RangeError);
  assert.throws(() => createWorldClock({ startHour: Infinity }), RangeError);
});
