import assert from 'node:assert/strict';
import { test } from 'node:test';
const { createSpellPractice, PRACTICE: P } = await import(new URL('../src/models/spellPractice.js', import.meta.url));

function ground() {
  const practice = createSpellPractice({ center: { x: 0, z: 0 } }), events = [];
  const io = { player: { x: 0, y: 2.05, z: 0 }, feet: 0, hurt: () => 'hit' };
  const run = (seconds, cast = null) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) { practice.update(1 / 60, { ...io, cast }); cast = null; events.push(...practice.takeEvents()); } };
  const spell = (rune, at) => { const p = io.player, from = { x: p.x, y: p.y - .6, z: p.z }, to = at ?? from; return { rune, from, aim: to, facing: Math.atan2(to.x - p.x, to.z - p.z) }; };
  return { practice, io, run, spell, events, has: type => events.some(e => e.type === type) };
}

test('flame lances burn a dummy down in three hits; it shatters and regrows', () => {
  const g = ground(), d = g.practice.snapshot().dummies[1];
  for (let i = 0; i < P.dummyHp; i++) { g.run(1 / 60, g.spell('flame', { x: d.x, y: 1.2, z: d.z })); g.run(1); }
  assert.ok(g.has('shatter')); assert.equal(g.practice.stats.burned, 1);
  g.run(P.regrow + .1); assert.ok(g.has('regrow'));
});

test('the totem throws spears: they hit you bare, the ward catches them, a wall stops them, gale shatters them', () => {
  const bare = ground(); bare.run(P.throwEvery + P.windup + 1.5); assert.ok(bare.has('throw')); assert.ok(bare.has('playerHit'));
  const warded = ground(); warded.run(P.throwEvery + P.windup - .2); warded.run(1 / 60, warded.spell('tide')); warded.run(1.5); assert.ok(warded.has('blocked'));
  const walled = ground(); walled.run(P.throwEvery); walled.run(1 / 60, walled.spell('earth', { x: 8, y: 2, z: -2 })); walled.run(2); assert.ok(walled.has('wallStop'));
  const blown = ground(); blown.run(P.throwEvery + P.windup + .2); blown.run(1 / 60, blown.spell('wind', { x: 8, y: 2, z: -2 })); assert.ok(blown.has('spearShattered'));
});
