import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPace, readSeconds } from '../src/controllers/scenePace.js';

test('a cutscene line holds until read, and Space rushes to the next one', () => {
  assert.equal(readSeconds(''), 0);
  assert.equal(readSeconds('short line'), 2.5);                 // never under 2.5 s
  const pace = createPace();
  pace.show('one two three four five six seven eight nine ten'); // 3 s to read
  assert.equal(pace.step(0.04, 1, 5), 0.04);                     // next line not due: normal speed
  assert.ok(pace.step(0.04, 4.98, 5) < 0.01);                    // due but unread: nearly still
  pace.rush();
  assert.ok(pace.step(0.04, 4.98, 5) > 0.04);                    // Space: fast forward
  pace.show('next');
  assert.ok(pace.step(0.04, 6, 6.02) < 0.01);                    // a new line resets the rush
});

test('the scene clock never crosses the next line while the current one is still unread (or still spoken)', () => {
  const pace = createPace();
  pace.show('one two three four five six seven eight nine ten'); // needs 3 s; the next line is due at 1 s
  let time = 0, real = 0;
  while (real < 2.9) { time += pace.step(1 / 60, time, 1); real += 1 / 60; }
  assert.ok(time < 1, `held short of the next line (${time})`);  // the old 8% creep crossed after ~0.2 s
  for (let i = 0; i < 12; i++) time += pace.step(1 / 60, time, 1); // 3 s reached: play on
  assert.ok(time >= 1);
});
