import assert from 'node:assert/strict';
import { test } from 'node:test';
const { createSileFight, SILE_FIGHT: F } = await import(new URL('../src/models/sileFight.js', import.meta.url));

const center = { x: 0, z: 0 }, anchors = [{ x: 8, z: 4 }, { x: -8, z: 4 }, { x: 0, z: -9 }];
function arena({ result = 'hit' } = {}) {
  const fight = createSileFight({ center, anchors, random: () => .5 });
  const io = { player: { x: 0, y: 2.05, z: 14 }, feet: 0, grounded: true, hurt: () => io.result, result };
  const events = [];
  const run = (seconds, extra = {}, each) => {
    let s; for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
      s = fight.update(1 / 60, { ...io, ...extra }); events.push(...fight.takeEvents()); extra = { ...extra, chaosPress: false, attackPress: false, swordHit: null }; each?.(s);
    } return s;
  };
  return { fight, io, run, events, types: () => events.map(e => e.type) };
}
const intoHarvest = a => { a.fight.start(); a.run(F.intro + .05); assert.equal(a.fight.phase, 'harvest'); };

test('the intro turns the prism purple, raises Sile laughing and speaks both lines before the fight', () => {
  const a = arena(); a.fight.start();
  let purple = 0, high = -Infinity;
  a.run(F.intro + .1, {}, s => { purple = Math.max(purple, s.purple); high = Math.max(high, s.sile.y); });
  const types = a.types();
  assert.equal(purple, 1); assert.ok(high > 5, 'she rises above the forecourt');
  assert.ok(types.indexOf('rumble') < types.indexOf('laugh'));
  const lines = a.events.filter(e => e.type === 'line').map(e => e.text);
  assert.ok(lines.some(l => /fun/.test(l)) && lines.length === 2);
  assert.equal(types.filter(t => t === 'laugh').length, 2); assert.ok(types.includes('fight'));
  const b = arena(); b.fight.start(); b.fight.skip(); b.run(1 / 60); assert.equal(b.fight.phase, 'harvest');
});

test('defending a real attack charges Chaos once per blow; charge buys Chaos, a hit knocks you back to Calm', () => {
  const a = arena({ result: 'blocked' }); intoHarvest(a);
  a.run(6); // she closes in and attacks; every blow is blocked
  const gained = a.events.filter(e => e.type === 'charge').length, blows = a.events.filter(e => e.type === 'blocked').length;
  assert.ok(blows >= 2); assert.equal(gained, blows);
  assert.ok(a.fight.charge >= 1 && a.fight.charge <= F.maxCharge);
  const before = a.fight.charge; a.run(1 / 60, { chaosPress: true }); assert.equal(a.fight.chaos, true); assert.equal(a.fight.charge, before - 1);
  a.io.result = 'hit'; a.run(4); assert.equal(a.fight.chaos, false); assert.ok(a.fight.playerHp < F.playerHp);
  const broke = arena(); intoHarvest(broke); broke.run(1 / 60, { chaosPress: true }); assert.equal(broke.fight.chaos, false); assert.ok(broke.types().includes('noCharge'));
});

test('the sword only bites after a missed sweep; Chaos hits harder; at 60 hp she takes to the sky', () => {
  const a = arena({ result: 'dodged' }); intoHarvest(a);
  let id = 1; const swing = () => ({ id: id++, reach: 2.1, arc: 1.9, facing: Math.atan2(a.fight.sile.x - a.io.player.x, a.fight.sile.z - a.io.player.z) });
  a.io.player = { x: 0, y: 2.05, z: 9.6 };
  const near = () => { const s = a.fight.sile; a.io.player = { x: s.x, y: 2.05, z: s.z + 2.2 }; };
  a.run(.5); near(); a.run(1 / 60, { swordHit: swing() }); assert.ok(a.types().includes('deflect')); assert.equal(a.fight.hp, F.hp);
  for (let guard = 0; guard < 600 && !a.fight.snapshot().open; guard++) { near(); a.run(1 / 60); }
  assert.ok(a.fight.snapshot().open, 'a dodged sweep opens her up');
  assert.equal(a.fight.snapshot().shield, false, 'the shield visibly drops while she is open');
  { let t = 0; while (a.fight.snapshot().open && t < 5) { a.run(1 / 60); t += 1 / 60; } assert.ok(t > 2.4, `opening lasted ${t.toFixed(2)} s`); }
  for (let guard = 0; guard < 600 && !a.fight.snapshot().open; guard++) { near(); a.run(1 / 60); }
  near(); a.run(1 / 60, { swordHit: swing() }); assert.equal(a.fight.hp, F.hp - F.strike.open);
  for (let guard = 0; guard < 3000 && a.fight.phase === 'harvest'; guard++) {
    near(); const s = a.run(1 / 60, { chaosPress: !a.fight.chaos && a.fight.charge > 0 });
    if (s.open) a.run(1 / 60, { swordHit: swing() });
  }
  assert.equal(a.fight.phase, 'sky'); assert.ok(a.fight.hp <= F.skyAt); assert.ok(a.types().includes('takeoff'));
});

test('in the sky only air strikes land; three bring her down; shards fall where you stood', () => {
  const a = arena(); intoHarvest(a);
  const fight = a.fight; // jump straight to the sky phase through the public flow
  while (fight.phase === 'harvest') { fight.update(1 / 60, { ...a.io, hurt: () => 'dodged' }); const s = fight.snapshot(); if (s.open) fight.update(1 / 60, { ...a.io, player: { x: s.sile.x, y: 2, z: s.sile.z + 2 }, swordHit: { id: Math.random(), reach: 2.1, arc: 1.9, facing: Math.PI }, chaosPress: !fight.chaos }); else a.io.player = { x: s.sile.x, y: 2.05, z: s.sile.z + 2.4 }; }
  assert.equal(fight.phase, 'sky');
  a.run(3); assert.ok(a.types().includes('shardImpact'));
  const hp = fight.hp; const at = () => ({ x: fight.sile.x, y: fight.sile.y + 1.1, z: fight.sile.z });
  a.run(1 / 60, { attackPress: true, grounded: true, player: at() }); assert.equal(fight.hp, hp, 'no strike from the ground');
  for (let i = 0; i < 3; i++) { a.run(.7); a.run(1 / 60, { attackPress: true, grounded: false, player: at(), feet: 9 }); }
  assert.equal(fight.phase, 'invert'); assert.ok(a.types().includes('crashStart'));
});

test('anchors invert only in Calm; all three drop the shield; the finish starts the ending and she flees', () => {
  const a = arena({ result: 'blocked' }); const fight = a.fight;
  fight.start(); fight.skip(); a.run(1 / 60);
  // Force the later phases quickly: win Harvest and Sky with the same moves as above.
  for (let g = 0; g < 20000 && fight.phase === 'harvest'; g++) { const s = fight.snapshot(); a.io.player = { x: s.sile.x, y: 2.05, z: s.sile.z + 2.2 }; a.io.result = 'dodged'; a.run(1 / 60, s.open ? { swordHit: { id: g, reach: 2.1, arc: 1.9, facing: Math.PI }, chaosPress: !fight.chaos } : {}); }
  for (let i = 0; i < 3 && fight.phase === 'sky'; i++) { a.run(.7); a.run(1 / 60, { attackPress: true, grounded: false, feet: 9, player: { x: fight.sile.x, y: fight.sile.y + 1, z: fight.sile.z } }); }
  assert.equal(fight.phase, 'invert'); a.run(F.crash + .5);
  a.io.result = 'blocked';
  if (!fight.chaos && fight.charge) a.run(1 / 60, { chaosPress: true });
  a.io.player = { x: anchors[0].x, y: 2.05, z: anchors[0].z };
  if (fight.chaos) { a.run(1); assert.equal(fight.snapshot().anchors[0].progress, 0, 'Chaos does not invert'); a.run(1 / 60, { chaosPress: true }); }
  a.io.feet = 1; // hop the siphon waves while standing at each anchor
  for (const p of anchors) { a.io.player = { x: p.x, y: 2.05, z: p.z }; a.run(F.invert.seconds + .2); }
  a.io.feet = 0;
  const s = fight.snapshot(); assert.ok(s.anchors.every(x => x.inverted)); assert.equal(s.shield, false); assert.ok(a.types().includes('shieldShatter'));
  for (let g = 0; g < 40 && fight.phase === 'invert'; g++) { const at = fight.sile; a.io.player = { x: at.x, y: 2.05, z: at.z + 2 }; a.run(.4, {}); a.run(1 / 60, { swordHit: { id: 9000 + g, reach: 2.1, arc: 1.9, facing: Math.PI } }); }
  assert.equal(fight.phase, 'ending'); assert.ok(a.events.some(e => e.type === 'line' && /toy/.test(e.text)));
  let rift = 0; a.run(F.ending + .1, {}, x => { rift = Math.max(rift, x.rift); });
  assert.equal(fight.phase, 'done'); assert.ok(rift > .9); assert.equal(fight.snapshot().purple, 0, 'the prism clears');
});

test('falling in battle restores health and the phase checkpoint without losing progress', () => {
  const a = arena(); intoHarvest(a);
  a.io.player = { x: 0, y: 2.05, z: 9 };
  a.run(40); // every blow lands
  assert.ok(a.types().includes('down')); assert.equal(a.fight.phase, 'harvest'); assert.ok(a.fight.playerHp > 0);
  assert.ok(a.fight.charge >= F.retryCharge, 'a retry always has a charge');
});

test('phase 3: siphon waves hit you on the ground (and set back an inversion), jumping them charges; the last stand ends in a reclaim', () => {
  const a = arena({ result: 'blocked' }); const fight = a.fight;
  fight.start(); fight.skip(); a.run(1 / 60);
  for (let g = 0; g < 20000 && fight.phase === 'harvest'; g++) { const s = fight.snapshot(); a.io.player = { x: s.sile.x, y: 2.05, z: s.sile.z + 2.2 }; a.io.result = 'dodged'; a.run(1 / 60, s.open ? { swordHit: { id: g, reach: 2.1, arc: 1.9, facing: Math.PI }, chaosPress: !fight.chaos } : {}); }
  for (let i = 0; i < 3 && fight.phase === 'sky'; i++) { a.run(.7); a.run(1 / 60, { attackPress: true, grounded: false, feet: 9, player: { x: fight.sile.x, y: fight.sile.y + 1, z: fight.sile.z } }); }
  assert.equal(fight.phase, 'invert');
  if (fight.chaos) a.run(1 / 60, { chaosPress: true });
  a.io.result = 'blocked'; a.io.player = { x: anchors[2].x, y: 2.05, z: anchors[2].z }; a.io.feet = 0; // stand on the floor
  const hp = fight.playerHp;
  a.run(9);
  assert.ok(a.events.some(e => e.type === 'playerHit' && e.kind === 'wave'), 'a wave hits you on the floor'); assert.ok(fight.playerHp < hp);
  assert.ok(a.types().includes('waveWindup'), 'waves are telegraphed');
  a.io.feet = 1; const before = a.events.filter(e => e.type === 'jumped').length; a.run(8);
  assert.ok(a.events.filter(e => e.type === 'jumped').length > before, 'jumping a wave counts as a defence');
  // Invert all three, then wait out the last stand without striking.
  for (const p of anchors) { a.io.player = { x: p.x, y: 2.05, z: p.z }; a.run(F.invert.seconds + .5); }
  assert.ok(fight.snapshot().exposed); a.io.player = { x: 0, y: 2.05, z: 14 };
  a.run(F.exposedFor + .3);
  const s = fight.snapshot(); assert.equal(s.exposed, false); assert.equal(s.shield, true); assert.equal(s.anchors.filter(x => x.inverted).length, 2);
  assert.ok(a.types().includes('reshield'));
});

test('the ending: Sile is gone before the vortex shuts, it shuts with one flash, and the prism clears after it', () => {
  const fight = createSileFight({ center, anchors });
  fight.start(); fight.skip(); fight.update(1 / 60, { player: { x: 0, y: 2.05, z: 14 }, feet: 0, grounded: true, hurt: () => 'dodged' });
  // Jump to the ending through the public state: run the model until it ends with forced wins.
  let g = 0; while (fight.phase !== 'ending' && g++ < 60000) {
    const s = fight.snapshot(), sp = s.sile, sky = fight.phase === 'sky';
    const io = { player: { x: sp.x, y: sky ? sp.y + 1 : 2.05, z: sp.z + 2.2 }, feet: sky ? 9 : 1, grounded: !sky, hurt: () => 'dodged', attackPress: sky && g % 50 === 0,
      chaosPress: !fight.chaos && fight.charge > 0 && (s.open || s.exposed), swordHit: s.open || s.exposed ? { id: g, reach: 2.1, arc: 1.9, facing: Math.PI } : null };
    if (fight.phase === 'invert' && s.shield && fight.time > 1.3) { const a = s.anchors.find(x => !x.inverted); if (a) { io.player = { x: a.x, y: 2.05, z: a.z }; io.chaosPress = fight.chaos; io.swordHit = null; } }
    fight.update(1 / 60, io); fight.takeEvents();
  }
  assert.equal(fight.phase, 'ending');
  const timeline = []; let flashes = 0;
  for (let i = 0; i < 700 && fight.phase === 'ending'; i++) {
    const s = fight.update(1 / 60, { player: { x: 0, y: 2.05, z: 14 }, feet: 0, grounded: true });
    for (const e of fight.takeEvents()) if (e.type === 'riftFlash') { flashes++; timeline.push(['flash', s.time, s.gone, s.purple]); }
    if (s.gone && !timeline.some(x => x[0] === 'gone')) timeline.push(['gone', s.time]);
  }
  const gone = timeline.find(x => x[0] === 'gone'), flash = timeline.find(x => x[0] === 'flash');
  assert.equal(flashes, 1); assert.ok(gone[1] < flash[1], 'she is inside before it shuts'); assert.equal(flash[2], true);
  assert.ok(flash[3] > .95, 'the prism is still purple at the flash'); assert.equal(fight.snapshot().purple, 0, 'and clear by the end');
});
