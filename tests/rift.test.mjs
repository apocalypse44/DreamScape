import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/models/rift.js', import.meta.url), 'utf8');
const { riftOpenness, riftStrength } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const fixture = () => ({ quest: { stage: 'companion' },
  spade: { castle: { discovery: { count: 0, complete: false } }, echo: { recovered: false } } });

test('the rift opens only as the story advances and never shrinks along the way', () => {
  const { quest, spade } = fixture();
  const steps = [() => {}, () => quest.stage = 'cursed', () => quest.stage = 'return', () => quest.stage = 'cured',
    () => spade.castle.discovery.count = 1, () => spade.castle.discovery.count = 3,
    () => spade.echo.recovered = true, () => spade.castle.discovery.complete = true];
  let last = -1;
  for (const step of steps) { step(); const open = riftOpenness(quest, spade); assert.ok(open >= last); last = open; }
  assert.equal(riftOpenness(fixture().quest, fixture().spade), 0);  // sealed before the curse
  assert.ok(Math.abs(last - 1) < 1e-9);                              // fully open once the Crown is understood
  assert.equal(riftOpenness({ stage: 'cured' }, undefined), .4);     // works before Spade has loaded
});

test('chaos decides how strongly an opened rift shows; a sealed rift never shows', () => {
  assert.equal(riftStrength(0, 1), 0);
  assert.ok(Math.abs(riftStrength(1, 0) - .3) < 1e-9);  // lingers faintly in calm
  assert.equal(riftStrength(1, 1), 1);                   // roars in full evil mode
  assert.ok(riftStrength(.5, 1) < riftStrength(1, 1));
});
