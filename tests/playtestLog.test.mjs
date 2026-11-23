import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const load = file => import(`data:text/javascript;base64,${Buffer.from(readFileSync(new URL(file, import.meta.url),'utf8')).toString('base64')}`);
const { createLog } = await load('../src/models/playtestLog.js');

test('low-FPS samples in a row merge into one dip; step times and summary add up', () => {
  let t = 0; const log = createLog(() => t);
  log.step('Calm the pup');
  for (const fps of [60, 25, 18, 28, 60, 22, 60]) { log.sample(fps, { kingdom: 'SPADE' }); t += 0.5; }
  log.step('Calm the pup'); // same step: ignored
  log.step('Find Neris');
  const r = log.report();
  const dips = r.events.filter(e => e.type === 'fps-dip');
  assert.equal(dips.length, 2);
  assert.deepEqual([dips[0].minFps, dips[0].seconds, dips[0].kingdom], [18, 1.5, 'SPADE']);
  assert.equal(r.events.find(e => e.title === 'Calm the pup').took, 3.5);
  assert.equal(r.steps, 2);
  assert.equal(r.fps.percentUnder30, 57);
});
