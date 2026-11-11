import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const cache = new Map();
function moduleUrl(file) {
  if (!cache.has(file.href)) {
    const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,
      (_, quote, path) => `from ${quote}${moduleUrl(new URL(path, file))}${quote}`);
    cache.set(file.href, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  return cache.get(file.href);
}
const load = path => import(moduleUrl(new URL(path, import.meta.url)));
const { TEST_STARTS, applyTestStart, getTestStart } = await load('../src/models/testStarts.js');
const { createSpadeCampaign } = await load('../src/models/spadeCampaign.js');
const { createCastleDiscovery } = await load('../src/models/spadeCastle.js');
const { createCastleEcho } = await load('../src/models/castleEcho.js');
const { createCloverCampaign } = await load('../src/models/cloverCampaign.js');
const { createHeartCampaign, heartLayout } = await load('../src/models/heartCampaign.js');
const { createDiamondCampaign } = await load('../src/models/diamondCampaign.js');
const { createInventory } = await load('../src/models/inventory.js');
const { createQuest } = await load('../src/models/quest.js');

function fixture(id) {
  const events = [], inventory = createInventory({ onAdd: item => events.push(item) });
  const state = { chaos: .06, mode: 'calm' }, player = { position: { x: 0, y: 2.05, z: 0 } };
  const world = { hash: (a, b) => Math.abs(Math.sin(a + b)) % 1, heightAt: () => 0, isLandmarkArea: () => false };
  const quest = createQuest({ world, state, player, demoCured: id !== 'ember-hound' }); quest.reset();
  const echo = createCastleEcho(), discovery = createCastleDiscovery({ hasEcho: () => echo.recovered });
  const spade = { echo, castle: { discovery }, campaign: createSpadeCampaign({ ready: () => quest.stage === 'cured', crownKnown: () => discovery.complete }) };
  const clover = createCloverCampaign({ ready: () => inventory.has('lantern-sigil') && discovery.complete });
  const heart = createHeartCampaign({ layout: heartLayout({ x: 350, z: 0 }), ready: () => inventory.has('root-sigil') && inventory.has('tide-hook') });
  const diamond = createDiamondCampaign({ ready: () => inventory.has('tide-sigil') });
  return { quest, inventory, spade, clover, heart, diamond, events };
}

for (const start of TEST_STARTS) test(`${start.id}: completes prerequisites and leaves the chosen quest playable`, () => {
  const f = fixture(start.id), spawn = applyTestStart(start.id, f);
  assert.ok(Number.isFinite(spawn.x) && Number.isFinite(spawn.z));
  assert.equal(f.quest.stage, start.chapter === 0 ? 'companion' : 'cured');
  assert.equal(f.spade.campaign.sigil, start.chapter >= 2);
  assert.equal(f.spade.campaign.gateOpen, start.chapter >= 2);
  assert.equal(f.spade.castle.discovery.complete, start.chapter >= 3);
  assert.equal(f.spade.echo.recovered, start.chapter >= 3);
  assert.equal(f.inventory.has('lantern-sigil'), start.chapter >= 2);
  assert.equal(f.inventory.has('root-sigil'), start.chapter >= 4 || start.id === 'sky-hook');
  assert.equal(f.inventory.has('tide-hook'), start.chapter >= 4);
  assert.equal(f.inventory.has('tide-sigil'), start.chapter >= 5);
  assert.equal(f.inventory.has('prism-sigil'), false);
  assert.equal(f.diamond.available, start.chapter >= 5);
  assert.equal(f.diamond.sigil, false);
  if (start.spade) assert.equal(f.spade.campaign.stage, start.spade);
  if (start.clover) { assert.equal(f.clover.stage, start.clover); assert.equal(f.clover.hook, false); }
  if (start.heart) assert.equal(f.heart.stage, start.heart === 'core' ? 'escort' : start.heart);
  if (start.diamond) assert.equal(f.diamond.stage, start.diamond);
  assert.deepEqual(f.events, [], 'preset rewards do not trigger normal acquisition callbacks');
});

test('Heart starts include the Clover prerequisites; Diamond starts include the Tide Sigil', () => {
  const heart = fixture('heart'), approach = applyTestStart('heart', heart);
  assert.equal(heart.heart.available, true);
  assert.equal(heart.inventory.has('tide-sigil'), false);
  assert.ok(Math.hypot(approach.x - heart.heart.layout.sera.x, approach.z - heart.heart.layout.sera.z) > 2);
  assert.ok(Math.hypot(approach.x - heart.heart.layout.sera.x, approach.z - heart.heart.layout.sera.z) < 5);
  const meet = fixture('diamond'); applyTestStart('diamond', meet);
  assert.ok(meet.diamond.update(0, meet.diamond.layout.orin, .06));
  assert.equal(meet.diamond.stage, 'collect');
  const repair = fixture('diamond-repair'); applyTestStart('diamond-repair', repair);
  assert.equal(repair.diamond.collected, 4); assert.equal(repair.diamond.fitted, 0);
  assert.equal(repair.diamond.isCollected(repair.diamond.layout.fragments[0].id), true);
  assert.ok(repair.diamond.fit(repair.diamond.layout.center, .06));
  assert.equal(repair.diamond.fitted, 1);
});

test('restored Clover prerequisites produce three connected, walkable root bridges', () => {
  const f = fixture('diamond'); applyTestStart('diamond', f);
  assert.equal(f.clover.generation, 3); assert.equal(f.clover.growth.backbone.length, 3);
  const bridges = f.clover.platforms.filter(p => p.name === 'living-road');
  assert.equal(bridges.length, 3);
  for (const bridge of bridges) assert.equal(bridge.contains(bridge.x, bridge.z), true);
});

test('resetting then applying the same checkpoint restores its original test state', () => {
  const f = fixture('diamond-repair');
  const first = applyTestStart('diamond-repair', f);
  f.diamond.fit(f.diamond.layout.center, .06);
  f.spade.campaign.reset(); f.spade.echo.reset(); f.spade.castle.discovery.reset();
  f.clover.reset(); f.diamond.reset(); f.inventory.reset(); f.quest.reset();
  assert.deepEqual(applyTestStart('diamond-repair', f), first);
  assert.equal(f.diamond.fitted, 0); assert.equal(f.diamond.collected, 4);
  assert.equal(f.spade.castle.discovery.complete, true); assert.equal(f.clover.hook, true);
});

test('unknown test checkpoints fail before modifying progress', () => {
  const f = fixture('ember-hound');
  assert.throws(() => getTestStart('not-a-quest'), /Unknown/);
  assert.throws(() => applyTestStart('not-a-quest', f), /Unknown/);
  assert.deepEqual(f.inventory.items, []); assert.equal(f.spade.campaign.stage, 'meet');
});

test('normal campaign construction still locks later chapters', () => {
  const f = fixture('ember-hound');
  assert.equal(f.clover.available, false); assert.equal(f.diamond.available, false);
  assert.match(f.diamond.update(0, f.diamond.layout.orin, .06).text, /Sera|Tide Sigil|Heart/);
});
