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
const { createHeartCampaign, heartLayout, HEART_REEF_TOP } = await load('../src/models/heartCampaign.js');
const layout = () => heartLayout({ x: 350, z: 0 });
const calm = { mode: 'calm', chaos: 0.06 };

function raise(model, player) {
  const chaos = { mode: 'chaos', chaos: 0.8 };
  for (let i = 0; i < 42; i++) model.update(0.1, player, chaos, true);
}

function distance(path) {
  return path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.z - path[i].z), 0);
}

test('Heart waits for the Root Sigil and Tide Hook before starting', () => {
  const campaign = createHeartCampaign({ layout: layout(), ready: () => false });
  assert.equal(campaign.available, false);
  assert.equal(campaign.interact(campaign.layout.sera, 'calm').kind, 'locked');
  assert.equal(campaign.stage, 'meet');
});

test('Sera starts the escort and a calm checkpoint advances the spirit route', () => {
  const campaign = createHeartCampaign({ layout: layout() });
  assert.equal(campaign.interact(campaign.layout.sera, 'calm', calm.chaos).kind, 'meet');
  assert.equal(campaign.stage, 'escort');
  const player = { position: { ...campaign.layout.sera }, grounded: true, velocity: { y: 0 } };
  raise(campaign, player);
  assert.equal(campaign.reefReady, true);
  assert.ok(campaign.route, 'A* plans a route to the first spring');
  campaign.update(0.1, player, calm, false);
  const checkpoint = campaign.layout.checkpoints[0];
  assert.equal(campaign.interact(checkpoint, 'calm', calm.chaos).kind, 'waiting',
    'the checkpoint cannot advance until the spirit reaches it');
});

test('opening a crystal passage replans a shorter A* route', () => {
  const kingdom = layout();
  const campaign = createHeartCampaign({ layout: kingdom });
  campaign.setTestStage('escort');
  const player = { position: { ...kingdom.spring }, grounded: true, velocity: { y: 0 } };
  campaign.update(0.01, player, calm, false);
  const before = distance(campaign.route.path);
  const passage = kingdom.passages[0];
  player.position = { ...passage.switch };
  campaign.update(0.01, player, { mode: 'chaos', chaos: 0.8 }, true);
  assert.equal(campaign.interact(player.position, 'chaos', 0.8).kind, 'passage');
  campaign.update(0.01, player, calm, true);
  assert.ok(distance(campaign.route.path) < before, 'the open crystal passage removes the detour');
});

test('a blocked route safely waits, then resumes when its crystal passage opens', () => {
  const kingdom = layout();
  kingdom.passages[0].radius = 1000;
  const campaign = createHeartCampaign({ layout: kingdom });
  campaign.setTestStage('escort');
  const player = { position: { ...kingdom.spring }, grounded: true, velocity: { y: 0 } };
  const start = campaign.spirit;
  campaign.update(0.1, player, calm, false);
  assert.equal(campaign.route, null);
  assert.deepEqual(campaign.spirit, start, 'the spirit does not move without a valid route');
  player.position = { ...kingdom.passages[0].switch };
  campaign.update(0.01, player, { mode: 'chaos', chaos: 0.8 }, true);
  campaign.interact(player.position, 'chaos', 0.8);
  campaign.update(0.01, player, calm, true);
  assert.ok(campaign.route, 'opening the switch restores a valid path');
});

test('the Tide Hook raises the reef, carries the player between safe landings, and recovers falls', () => {
  const campaign = createHeartCampaign({ layout: layout() });
  const player = { position: { ...campaign.layout.sera }, grounded: true, velocity: { y: 0 } };
  raise(campaign, player);
  assert.equal(campaign.reefHeight, HEART_REEF_TOP);
  assert.equal(campaign.recovery({
    position: { ...campaign.layout.sera, y: 3.55 }, grounded: true, velocity: { y: -0.5 },
  }), null, 'a grounded Heart approach must not trigger fall recovery');
  const result = campaign.interact(campaign.layout.shoreAnchor, 'chaos', 0.8);
  assert.equal(result.kind, 'grapple');
  assert.equal(campaign.traversing, true);
  let landing = null;
  for (let i = 0; i < 50; i++) {
    const frame = campaign.update(0.05, player, calm, true);
    if (frame.target) landing = frame.target;
  }
  assert.ok(landing);
  assert.ok(Math.abs(landing.top - campaign.layout.height(landing.x, landing.z)) < 1e-8);
  const fallen = { position: { x: campaign.layout.spring.x, y: 5, z: campaign.layout.spring.z },
    velocity: { y: -3 } };
  assert.ok(Math.abs(campaign.recovery(fallen).top - landing.top) < 1e-8);
});

test('releasing the siphon grants the Tide Sigil stage and closes the Heart chapter at Sera', () => {
  const campaign = createHeartCampaign({ layout: layout() });
  campaign.setTestStage('core');
  assert.equal(campaign.interact(campaign.layout.core, 'calm', calm.chaos).kind, 'sigil');
  assert.equal(campaign.sigil, true);
  assert.equal(campaign.interact(campaign.layout.sera, 'calm', calm.chaos).kind, 'complete');
  assert.equal(campaign.complete, true);
  campaign.reset();
  assert.equal(campaign.complete, false);
  assert.equal(campaign.passages.some(p => p.open), false);
});
