// Mana bar rules (MANA_PLAN.md): cost, no stacking, the 5 s hold, the cap and the reset floor.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMana, MANA } from '../src/models/mana.js';

test('a full bar is exactly three surges', () => {
  const mana = createMana();
  mana.add(1);
  assert.equal(mana.value, 1);
  for (let i = 0; i < 3; i++) { assert.ok(mana.surge('calm'), `surge ${i + 1}`); mana.tick(MANA.hold); }
  assert.equal(mana.blocked('calm'), 'NOT ENOUGH MANA');
  assert.equal(mana.surge('calm'), false);
});

test('no stacking: not in Chaos, not during a hold', () => {
  const mana = createMana();
  mana.add(1);
  assert.equal(mana.blocked('chaos'), 'ALREADY IN CHAOS');
  assert.ok(mana.surge('calm'));
  assert.equal(mana.surge('calm'), false);
  const left = mana.value;
  mana.tick(MANA.hold - 0.01);
  assert.ok(mana.holding);
  mana.tick(0.02);
  assert.equal(mana.holding, false);
  assert.equal(mana.value, left); // blocked tries cost nothing
});

test('reset ends the hold and floors the bar at one surge', () => {
  const mana = createMana();
  mana.surge('calm');
  assert.ok(mana.value < MANA.surgeCost);
  mana.reset();
  assert.equal(mana.holding, false);
  assert.equal(mana.blocked('calm'), null);
});

// The real pacing governor (chaosLook.js), with the same per-frame steps game.js runs: player.js pulls the
// score toward its movement target, the surge holds it at surgeLevel, then movement alone brings it down.
test('a surge reaches Chaos at once, holds 5 s, then decays to Calm by itself', async () => {
  const el = { textContent: '' };
  globalThis.document = { querySelector: () => el };
  globalThis.THREE ??= { Vector3: class {} }; // overlay.js (imported by hud.js) makes one at load
  const { createChaosLook } = await import('../src/controllers/chaosLook.js');
  const look = createChaosLook(), mana = createMana(), dt = 1 / 60;
  const state = { chaos: 0.62, mode: 'calm' }; // just under the switch: a jump < passThroughJump, so snap() must matter
  look.update(dt, state);
  mana.surge(state.mode); state.chaos = MANA.surgeLevel; look.snap();
  let inChaos = 0, t = 0;
  for (; t < 60; t += dt) {
    state.chaos += (0.03 - state.chaos) * dt * 0.16; // standing still (player.js)
    mana.tick(dt);
    if (mana.holding) state.chaos = Math.max(state.chaos, MANA.surgeLevel);
    look.update(dt, state);
    if (t < MANA.hold - dt) assert.ok(state.chaos >= MANA.surgeLevel - 1e-9, `held at ${t.toFixed(2)} s`);
    if (state.chaos > 0.4) inChaos = t; else break;
  }
  assert.ok(inChaos > 15 && inChaos < 24, `about 19 s in Chaos, got ${inChaos.toFixed(1)} s`);
});

test('motes: only in calm, at most three, a touch fills the bar, they fade after their life', async () => {
  const { createMoteField, MOTES } = await import('../src/models/manaMotes.js');
  let seed = 1; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const field = createMoteField({ groundAt: () => 0, random });
  const p = { x: 0, y: 2.05, z: 0 };
  for (let t = 0; t < 200; t += 1) field.update(1, p, false);
  assert.equal(field.motes.length, 0, 'nothing spawns in Chaos');
  for (let t = 0; t < 200; t += 1) field.update(1, p, true);
  assert.ok(field.motes.length > 0 && field.motes.length <= MOTES.max);
  for (const m of field.motes) { const d = Math.hypot(m.x, m.z); assert.ok(d >= MOTES.near - 1e-9 && d <= MOTES.far + 1e-9); }
  const m = field.motes[0];
  const gained = field.update(0, { x: m.x, y: 2.05, z: m.z }, false);
  assert.equal(gained, m.value);
  assert.ok(!field.motes.includes(m));
  const blocked = createMoteField({ groundAt: () => 0, canSpawnAt: () => false, random });
  for (let t = 0; t < 200; t += 1) blocked.update(1, p, true);
  assert.equal(blocked.motes.length, 0, 'never on landmarks');
  const cliff = createMoteField({ groundAt: () => 30, random });
  for (let t = 0; t < 200; t += 1) cliff.update(1, p, true);
  assert.equal(cliff.motes.length, 0, 'never out of reach above or below');
  for (let t = 0; t < MOTES.life + 1; t += 1) field.update(1, { x: 999, y: 2.05, z: 999 }, false);
  assert.equal(field.motes.length, 0, 'unclaimed motes fade');
});

test('quest milestones pay once per new high', async () => {
  const { createMilestones } = await import('../src/models/manaMotes.js');
  const m = createMilestones();
  assert.equal(m.reach('fragments', 1), 1);
  assert.equal(m.reach('fragments', 0), 0); // lifted
  assert.equal(m.reach('fragments', 1), 0); // refitted: no farming
  assert.equal(m.reach('fragments', 3), 2);
});

test('a fight starts with the charges the bar brings in', async () => {
  const { createSileFight } = await import('../src/models/sileFight.js');
  const { createMorcantFight } = await import('../src/models/morcantFight.js');
  const sile = createSileFight({ center: { x: 0, z: 0 }, anchors: [{ x: 8, z: 4 }], random: () => .5 });
  sile.start(1); assert.equal(sile.charge, 1);
  sile.start(); assert.equal(sile.charge, 0);
  const morcant = createMorcantFight({ center: { x: 0, z: 0 }, floor: 0, radius: 20, pylons: [] });
  morcant.start(1); assert.equal(morcant.charge, 1);
  // bossFights.js: a full bar is capped at one charge on the way in
  const mana = createMana(); mana.add(1); mana.cap(MANA.fightCap);
  assert.equal(Math.floor(mana.value / MANA.surgeCost + 1e-6), 1);
});
