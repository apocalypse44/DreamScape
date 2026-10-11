import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

globalThis.window = { THREE: { GLTFLoader: class {} } };

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
  assert.deepEqual([ember.x, ember.y, ember.z], [50, 5.3, -25]);
  assert.deepEqual(positions[positions.length - 1], [2, 50, 5.3, -25]);

  state.chaos = 0.06;
  player.position = { x: hound.x, y: ember.y + 1, z: hound.z };
  quest.updateHoundEmber(hound);
  assert.equal(quest.houndCarrying, false);
  quest.update();
  assert.equal(ember.taken, true);
});
