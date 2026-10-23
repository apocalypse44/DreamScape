import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const cache = new Map();
function moduleUrl(file) {
  const key = file.href;
  if (!cache.has(key)) {
    const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,
      (_, quote, path) => `from ${quote}${moduleUrl(new URL(path, file))}${quote}`);
    cache.set(key, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  return cache.get(key);
}

const { createQuest, SHRINE } = await import(moduleUrl(new URL('../src/models/quest.js', import.meta.url)));

function setup(callbacks = {}) {
  const world = {
    hash(a, b) {
      const value = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return value - Math.floor(value);
    },
    heightAt(x, z, score) { return score * 20 + Math.sin(x * 0.2) + Math.cos(z * 0.2); },
    isLandmarkArea() { return false; },
  };
  const state = { chaos: 0.06, mode: 'calm' };
  const player = { position: { x: 0, y: 2.05, z: 0 } };
  return { quest: createQuest({ world, state, player, ...callbacks }), state, player };
}

test('the explicit Clover demo preset keeps the companion cured through chaos and repeated resets', () => {
  const {quest,state}=setup({demoCured:true});quest.reset();
  assert.equal(quest.stage,'cured');assert.ok(quest.embers.every(e=>e.taken));
  state.chaos=.95;quest.update();assert.equal(quest.stage,'cured');
  quest.reset();assert.equal(quest.stage,'cured');assert.equal(quest.houndCarrying,false);
});

test('Phase 3 pickups orbit through an offering before curing and reset to their start positions', () => {
  const pickups = [];
  let completeOffering;
  const { quest, state, player } = setup({
    onEmberPickup: (...args) => pickups.push(args),
    onOfferEmbers: done => { completeOffering = done; },
  });
  const starts = quest.embers.map(({ x, y, z }) => ({ x, y, z }));

  state.chaos = 0.7;
  quest.update();
  assert.equal(quest.stage, 'cursed');

  // A calm approach makes the hound drop its ember where it stands.
  const hound = { x: 40, y: 3, z: 20 };
  state.chaos = 0.06;
  player.position = { x: hound.x, y: 2.05, z: hound.z };
  quest.updateHoundEmber(hound);
  assert.equal(quest.houndCarrying, false);
  state.chaos = 0.7;

  for (const ember of quest.embers) {
    player.position = { x: ember.x, y: ember.y + 1, z: ember.z };
    quest.update();
  }
  assert.deepEqual(pickups, [[0, 1, 3], [1, 2, 3], [2, 3, 3]]);
  assert.equal(quest.stage, 'return');

  state.chaos = 0.06;
  player.position = { x: SHRINE.x, y: 2.05, z: SHRINE.z };
  quest.update();
  assert.equal(quest.stage, 'return');
  assert.equal(typeof completeOffering, 'function');
  completeOffering();
  assert.equal(quest.stage, 'cured');

  quest.reset();
  assert.equal(quest.stage, 'companion');
  assert.deepEqual(quest.embers.map(({ x, y, z }) => ({ x, y, z })), starts);
  assert.ok(quest.embers.every(ember => !ember.taken));
});

test('the hound carries its ember, flees in chaos, and drops it for a calm approach', () => {
  const positions = [];
  const { quest, state, player } = setup({
    onEmberPosition: (index, position) => positions.push([index, position.x, position.y, position.z]),
  });
  state.chaos = 0.7;
  quest.update();
  assert.equal(quest.houndCarrying, true);
  assert.notEqual(quest.nextEmber().challenge, 'hound');

  const hound = { x: 50, y: 4, z: -25 };
  quest.updateHoundEmber(hound);
  const ember = quest.embers.find(item => item.challenge === 'hound');
  assert.deepEqual([ember.x, ember.y, ember.z], [50, 5.8, -25]);
  assert.deepEqual(positions[positions.length - 1], [2, 50, 5.8, -25]);

  // Reaching the hound while chaotic does not take the ember it still carries.
  player.position = { x: hound.x, y: ember.y + 1, z: hound.z };
  quest.update();
  assert.equal(ember.taken, false);

  state.chaos = 0.06;
  player.position = { x: hound.x, y: ember.y + 1, z: hound.z };
  quest.updateHoundEmber(hound);
  assert.equal(quest.houndCarrying, false);
  quest.update();
  assert.equal(ember.taken, true);
});

test('the ember parkour exists only in chaos and never vanishes under a player mid-climb', () => {
  const { quest, state, player } = setup();
  const shard = quest.platforms[3];
  const standOn = s => { Object.assign(player.position, { x: s.x, y: s.top + 2.05, z: s.z }); player.grounded = true; };
  quest.update();
  assert.equal(quest.courseActive, false);
  assert.equal(shard.contains(shard.x, shard.z), false);          // calm: no shard to stand on
  state.chaos = 0.9; quest.update();
  assert.equal(quest.courseActive, true);
  assert.equal(shard.contains(shard.x, shard.z), true);
  standOn(shard); quest.update();
  state.chaos = 0.2; quest.update();                              // calm returns while standing on a shard
  assert.equal(state.mode, 'calm');
  assert.equal(quest.courseActive, true);
  player.grounded = false; player.position.y += 1; quest.update(); // mid-jump between shards
  assert.equal(quest.courseActive, true);
  Object.assign(player.position, { x: 0, y: 2.05, z: 0 }); player.grounded = true; quest.update();
  assert.equal(quest.courseActive, false);                        // back on solid ground in calm: it fades
  state.chaos = 0.9; quest.update();
  Object.assign(state, { chaos: 0.06, mode: 'calm' }); quest.reset(); // as game reset(): state first
  assert.equal(quest.courseActive, false);
});

test('every parkour shard is convex and at least as forgiving as a 2.75 m landing', () => {
  const { quest } = setup();
  for (const s of quest.platforms) {
    s.outline.forEach((a, i) => {                                // left turn at every corner: convex
      const b = s.outline[(i + 1) % s.outline.length], c = s.outline[(i + 2) % s.outline.length];
      assert.ok((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0);
    });
    const inside = (x, z) => s.outline.every((a, i) => {
      const b = s.outline[(i + 1) % s.outline.length];
      return (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0;
    });
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; assert.ok(inside(Math.cos(a) * 1.38, Math.sin(a) * 1.38)); }
  }
});
