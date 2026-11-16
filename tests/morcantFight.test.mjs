import assert from 'node:assert/strict';
import { test } from 'node:test';
const { createMorcantFight, MORCANT_FIGHT: F } = await import(new URL('../src/models/morcantFight.js', import.meta.url));

const center = { x: 0, z: 0 }, pylons = [{ x: 7, z: 7 }, { x: -7, z: 7 }, { x: 7, z: -7 }, { x: -7, z: -7 }];
function arena(result = 'hit') {
  const fight = createMorcantFight({ center, radius: 16, pylons, random: () => .5 });
  const io = { player: { x: 0, y: 2.05, z: 8 }, feet: 0, grounded: true, hurt: () => io.result, result };
  const events = [];
  const run = (seconds, extra = {}, each) => {
    let s; for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
      s = fight.update(1 / 60, { ...io, ...extra }); events.push(...fight.takeEvents()); extra = { ...extra, chaosPress: false, cast: null }; each?.(s);
    } return s;
  };
  return { fight, io, run, events, types: () => events.map(e => e.type), count: type => events.filter(e => e.type === type).length };
}
const begin = a => { a.fight.start(); a.fight.skip(); a.run(1 / 60); assert.equal(a.fight.phase, 'gate'); };
// A rune cast from the traveller at a target point.
const cast = (a, rune, at) => { const p = a.io.player, from = { x: p.x, y: p.y - .6, z: p.z };
  return { rune, from, aim: at ?? from, facing: at ? Math.atan2(at.x - p.x, at.z - p.z) : 0 }; };
const chestOf = a => ({ ...a.fight.morcant, y: a.fight.morcant.y + 1.9 });
// Wait for his next attack of a kind to wind up (other attacks play out meanwhile).
function waitFor(a, kind, limit = 40) {
  for (let i = 0; i < limit * 60; i++) { const s = a.run(1 / 60); if (s.attack?.kind === kind) return s; }
  assert.fail(`no ${kind} attack`);
}

test('the intro opens his gate, walks him out, speaks two lines and starts the fight; Enter skips it', () => {
  const a = arena(); a.fight.start();
  let gate = 0; a.run(F.intro + .1, {}, s => { gate = Math.max(gate, s.gate); });
  assert.equal(gate, 1); assert.equal(a.fight.phase, 'gate');
  assert.equal(a.count('line'), 2); assert.ok(a.types().includes('fight'));
});

test('the bone lane cannot be jumped, but a Stone Wall stops it and earns charge', () => {
  const hit = arena(); begin(hit); hit.io.feet = 1.5; // mid-jump the whole time: spikes are taller than a jump
  waitFor(hit, 'forest'); hit.run(3);
  assert.ok(hit.events.some(e => e.type === 'playerHit' && e.kind === 'forest'));
  const walled = arena(); begin(walled);
  const s = waitFor(walled, 'forest'), m = s.morcant;
  walled.run(1 / 60, { cast: cast(walled, 'earth', { x: m.x, y: 2, z: m.z }) }); walled.run(3);
  assert.ok(walled.events.some(e => e.type === 'wallStop' && e.kind === 'forest'));
  assert.ok(!walled.events.some(e => e.type === 'playerHit' && e.kind === 'forest')); assert.ok(walled.fight.charge >= 1);
});

test('Tide Ward catches bone spears for charge; without it they hurt', () => {
  const bare = arena(); begin(bare); waitFor(bare, 'spears'); bare.run(2.5);
  assert.ok(bare.events.some(e => e.type === 'playerHit' && e.kind === 'spear'));
  const warded = arena(); begin(warded); waitFor(warded, 'spears'); warded.run(.4);
  warded.run(1 / 60, { cast: cast(warded, 'tide') }); warded.run(2);
  assert.ok(warded.events.some(e => e.type === 'blocked' && e.kind === 'spear')); assert.ok(warded.fight.charge >= 1);
});

test('a bone spider climbs out and hunts; a Flame Lance shatters it for charge', () => {
  const a = arena(); begin(a); waitFor(a, 'spider'); a.run(1);
  assert.equal(a.fight.snapshot().spiders.length, 1);
  const sp = a.fight.snapshot().spiders[0];
  a.run(1 / 60, { cast: cast(a, 'flame', { x: sp.x, y: .6, z: sp.z }) }); a.run(.6);
  assert.ok(a.types().includes('spiderShattered'));
});

test('Gale breaks his windup into a stagger; a Flame Lance in the opening does full damage, otherwise only chip', () => {
  const a = arena(); begin(a);
  waitFor(a, 'forest'); const before = a.fight.hp, m = a.fight.morcant;
  a.io.player = { x: m.x, y: 2.05, z: m.z + 5 }; // inside the gale's reach
  a.run(1 / 60, { cast: cast(a, 'wind', chestOf(a)) });
  assert.ok(a.types().includes('staggered')); assert.equal(a.fight.snapshot().open, true);
  a.run(1 / 60, { cast: cast(a, 'flame', chestOf(a)) }); a.run(.5);
  const flame = a.events.find(e => e.type === 'strike' && e.by === 'flame');
  assert.equal(flame.damage, F.spells.flame.damage); assert.ok(a.fight.hp < before);
  const b = arena(); begin(b); b.run(1 / 60, { cast: cast(b, 'flame', chestOf(b)) }); b.run(.5);
  assert.equal(b.events.find(e => e.type === 'strike').damage, F.spells.flame.chip);
});

test('spells have cooldowns', () => {
  const a = arena(); begin(a);
  a.run(1 / 60, { cast: cast(a, 'earth', { x: 0, y: 2, z: 0 }) }); a.run(1 / 60, { cast: cast(a, 'earth', { x: 0, y: 2, z: 0 }) });
  assert.equal(a.count('cast'), 1); assert.ok(a.types().includes('cooling'));
});

function toSeal(a) {
  begin(a);
  for (let i = 0; i < 9000 && a.fight.phase === 'gate'; i++) {
    const s = a.fight.snapshot();
    a.run(1 / 60, { cast: s.open ? cast(a, 'flame', chestOf(a)) : null });
  }
  assert.equal(a.fight.phase, 'seal'); a.run(F.rise + .1);
}
// Burn every pillar with Chaos lances, re-entering Chaos whenever charge allows (rolling through attacks gives charge).
function burnPillars(a) {
  a.io.result = 'dodged';
  for (let i = 0; i < 9000 && !a.fight.snapshot().exposed; i++) {
    const s = a.fight.snapshot(), target = s.pillars.find(p => p.hp > 0);
    if (!a.fight.chaos) { a.run(1 / 60, { chaosPress: a.fight.charge > 0 }); continue; }
    a.run(1 / 60, { cast: cast(a, 'flame', { x: target.x, y: 3, z: target.z }) });
  }
  assert.ok(a.fight.snapshot().exposed, 'all four pillars burned exposes him');
}

test('bone pillars only burn in Chaos; burning all four exposes him, then one regrows if he survives', () => {
  const a = arena('dodged'); toSeal(a);
  if (a.fight.chaos) a.run(1 / 60, { chaosPress: true });
  a.run(1 / 60, { cast: cast(a, 'flame', { x: 7, y: 3, z: 7 }) }); a.run(.6);
  assert.ok(a.types().includes('needChaos')); assert.equal(a.fight.snapshot().pillars[0].hp, F.pillar.hp);
  burnPillars(a);
  a.run(F.exposedFor + .1); assert.ok(a.types().includes('reseal')); assert.equal(a.fight.snapshot().shield, true);
});

test('burning him while exposed plays the ending to done; falling restores health at the checkpoint', () => {
  const a = arena('dodged'); toSeal(a); burnPillars(a);
  for (let i = 0; i < 9000 && a.fight.phase === 'seal'; i++) {
    if (a.fight.snapshot().exposed) a.run(1 / 60, { cast: cast(a, 'flame', chestOf(a)) }); else burnPillars(a);
  }
  assert.equal(a.fight.phase, 'ending');
  let gate = 0; a.run(F.ending + .1, {}, s => { gate = Math.max(gate, s.gate); });
  assert.equal(a.fight.phase, 'done'); assert.ok(gate > .9);
  assert.equal(a.events.filter(e => e.type === 'line' && /Elowen/.test(e.text)).length, 1);
  const b = arena('hit'); begin(b); b.run(60);
  assert.ok(b.types().includes('down')); assert.equal(b.fight.phase, 'gate'); assert.ok(b.fight.charge >= F.retryCharge);
});

test('he boasts: a gloat when he lands a blow, a sneer when burned hard, never two at once or too often', () => {
  const a = arena('hit'); begin(a); a.run(25);
  const taunts = a.events.filter(e => e.type === 'line' && (e.key === 'gloat' || e.key === 'sneer'));
  assert.ok(taunts.some(t => t.key === 'gloat'), 'he gloats when the blows land');
  const times = []; let t = 0;
  const b = arena('hit'); begin(b); let seen = b.events.length;
  b.run(30, {}, () => { t += 1 / 60; for (; seen < b.events.length; seen++) if (b.events[seen].type === 'line') times.push(t); });
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 6.9, 'taunts are spaced out');
  const c = arena(); begin(c); waitFor(c, 'forest'); const m = c.fight.morcant; c.io.player = { x: m.x, y: 2.05, z: m.z + 5 };
  c.run(1 / 60, { cast: cast(c, 'wind', chestOf(c)) }); c.run(1 / 60, { cast: cast(c, 'flame', chestOf(c)) }); c.run(.5);
  assert.ok(c.events.some(e => e.type === 'line' && e.key === 'sneer'), 'a full lance in his opening stings');
});

test('as he retreats he warns of Sile; once his portal shuts the grimoire forges the sigil-blade and Sera explains', () => {
  const a = arena('dodged'); toSeal(a); burnPillars(a);
  for (let i = 0; i < 9000 && a.fight.phase === 'seal'; i++) {
    if (a.fight.snapshot().exposed) a.run(1 / 60, { cast: cast(a, 'flame', chestOf(a)) }); else burnPillars(a);
  }
  a.run(F.ending + .1);
  const keys = a.events.filter(e => e.type === 'line').map(e => e.key), forge = a.types().indexOf('forge');
  assert.ok(keys.includes('retreat') && keys.includes('forged'));
  assert.ok(forge > a.types().indexOf('gateFlash'), 'the blade is forged after the portal shuts');
  assert.ok(a.events.some(e => e.type === 'line' && e.key === 'forged' && e.who === 'SERA'));
});
