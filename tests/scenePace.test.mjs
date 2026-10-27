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
