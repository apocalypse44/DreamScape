import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/models/startup.js', import.meta.url), 'utf8');
const { createStartupReadiness, observeStartupLoading } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('entry waits for assets, instance preparation, shader warmup and rendered frames', () => {
  const gate = createStartupReadiness({ quietMs: 10, settleFrames: 3 });
  const frame = (now, prepared = true, frameMs = 16) => gate.update({ now, prepared, frameMs });
  gate.begin(0);
  assert.equal(frame(100), 'loading');
  gate.end(100);
  assert.equal(frame(105), 'preparing');
  assert.equal(frame(120, false), 'preparing');
  assert.equal(frame(121), 'warmup');
  assert.equal(frame(122), 'settling');
  assert.equal(frame(123, true, 1500), 'settling'); // upload hitch resets settling
  assert.equal(frame(124), 'settling');
  assert.equal(frame(125), 'settling');
  assert.equal(frame(126), 'ready');
  assert.equal(gate.ready, true);
});

test('late and nested asset requests invalidate warmup, including failed downloads', () => {
  const gate = createStartupReadiness({ quietMs: 0, settleFrames: 1 });
  let now = 1;
  const events = [];
  const manager = {
    itemStart(url) { events.push(`start:${url}`); },
    itemEnd(url) { events.push(`end:${url}`); },
  };
  const originalStart = manager.itemStart, originalEnd = manager.itemEnd;
  const restore = observeStartupLoading(manager, gate, () => now++);
  const frame = () => gate.update({ now: now++, frameMs: 16, prepared: true });
  manager.itemStart('tree');
  manager.itemStart('texture');
  manager.itemEnd('tree');
  assert.equal(frame(), 'loading');
  manager.itemEnd('texture');
  assert.equal(frame(), 'warmup');
  manager.itemStart('missing-model');
  assert.equal(frame(), 'loading');
  manager.itemEnd('missing-model'); // Three's loaders end failed items too
  assert.equal(frame(), 'warmup');
  assert.equal(frame(), 'ready');
  assert.equal(events.length, 6);
  restore();
  assert.equal(manager.itemStart, originalStart);
  assert.equal(manager.itemEnd, originalEnd);
});
