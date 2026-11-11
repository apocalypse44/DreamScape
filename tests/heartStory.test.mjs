import assert from 'node:assert/strict';
import { test } from 'node:test';
const { heartPastStage, HEART_PAST, HEART_SHOTS, HEART_PAST_CAST } = await import(new URL('../src/models/heartStory.js', import.meta.url));

test('The Quiet Springs runs in order: alive town, drained springs, the queen taken, then the chains', () => {
  const at = t => heartPastStage(t);
  assert.equal(at(2).life, 1, 'Tidewell alive before the Triad');
  assert.equal(at(2).triad, 0);
  assert.ok(at(15).drain > 0 && at(15).drain < 1, 'the springs drain while Sile harvests');
  assert.equal(at(HEART_PAST.drain[1] + 0.5).life, 0, 'the town is dry once the springs are');
  assert.ok(at(HEART_PAST.hide[1]).hide === 1, 'the spirit is hidden before the queen comes');
  assert.ok(HEART_PAST.hide[1] < HEART_PAST.taken[0]);
  assert.equal(at(HEART_PAST.taken[1]).taken, 1);
  assert.ok(HEART_PAST.taken[1] <= HEART_PAST.chains[1] && HEART_PAST.rift[0] < HEART_PAST.taken[0]);
  assert.equal(at(33).chains > 0 && at(33).chains < 1, true, 'Veyr chains the islands last');
  assert.equal(at(HEART_PAST.duration).amount, 0, 'back to the present at the end');
});

test('the shot and the cast are well formed: keys in time order, the shot as long as the memory', () => {
  for (const shot of Object.values(HEART_SHOTS)) {
    const times = shot.keys.map(k => k[0]);
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
    assert.ok(shot.lines.every(([t]) => t < times.at(-1)), 'every caption before the shot ends');
  }
  assert.equal(HEART_SHOTS.past.keys.at(-1)[0] + 1, HEART_PAST.duration);
  for (const def of Object.values(HEART_PAST_CAST)) {
    const times = def.keys.map(k => k[0]);
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  }
});
