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
const { createHeartCampaign, heartLayout, HEART_QUAKE } = await load('../src/models/heartCampaign.js');
const { GRAPPLE, createGrapple } = await load('../src/models/grapple.js');
const { workingReleases } = await load('./heartSwing.mjs');
const layout = () => heartLayout({ x: 350, z: 0 });
const calm = { mode: 'calm', chaos: 0.06 };
const storm = { mode: 'chaos', chaos: 0.8 };

// The vision cutscene drives the quake; tests jump straight to its end.
function raise(model) { model.quakeTo(Infinity); }
function distance(path) {
  return path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.z - path[i].z), 0);
}
function openPassage(campaign, passage, player) {
  player.position = { ...passage.switch };
  campaign.update(0.01, player, storm, true); // reveals it
  assert.equal(campaign.interact(player.position, 'chaos', 0.8).kind, 'passage');
  campaign.update(0.01, player, calm, true);
}
const onLand = (kingdom, p) => kingdom.height(p.x, p.z) > 0;

test('the islands form a reachable ring: no overlaps, bridges land on islands, every swing crystal is in reach', () => {
  const kingdom = layout();
  const { islands } = kingdom;
  for (let i = 0; i < islands.length; i++) for (let j = i + 1; j < islands.length; j++) {
    const a = islands[i], b = islands[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > a.radius + b.radius + 4, `${a.id} and ${b.id} keep a gap`);
  }
  for (const bridge of kingdom.bridges) {
    assert.ok(kingdom.island(bridge.from).surface.contains(bridge.start.x, bridge.start.z), `${bridge.id} starts on its island`);
    assert.ok(kingdom.island(bridge.to).surface.contains(bridge.end.x, bridge.end.z), `${bridge.id} ends on its island`);
  }
  for (const swing of kingdom.swings) {
    const feet = swing.from === 'shore' ? 1.5 : kingdom.island(swing.from).top;
    const eye = { x: swing.at.x, y: feet + 2.05, z: swing.at.z };
    const reach = Math.hypot(swing.x - eye.x, swing.y - eye.y, swing.z - eye.z);
    assert.ok(reach < GRAPPLE.range, `${swing.id} crystal is ${reach.toFixed(1)} m away`);
    assert.ok(swing.y - eye.y >= 1, `${swing.id} crystal hangs above the launch`);
    assert.ok(kingdom.island(swing.to).surface.contains(swing.land.x, swing.land.z), `${swing.id} lands on its island`);
  }
  for (const p of [kingdom.spring, kingdom.core, ...kingdom.checkpoints, ...kingdom.passages.map(p => p.switch)])
    assert.ok(onLand(kingdom, p), 'quest points stand on an island');
});

test('islands tear free one after another, lowest first', () => {
  const campaign = createHeartCampaign({ layout: layout() });
  const { islands } = campaign.layout;
  campaign.quakeTo(HEART_QUAKE.burst - 0.1);
  assert.equal(campaign.craterOpen, false, 'the ground holds until the dust burst');
  assert.ok(islands.every(i => campaign.liftOf(i) === 0));
  campaign.quakeTo(HEART_QUAKE.burst + 0.6);
  assert.equal(campaign.craterOpen, true);
  assert.ok(campaign.liftOf(islands[0]) > campaign.liftOf(islands[islands.length - 1]));
  campaign.quakeTo(1);
  assert.equal(campaign.quakeTime, HEART_QUAKE.burst + 0.6, 'the quake never runs backwards');
  raise(campaign);
  assert.equal(campaign.reefReady, true);
  for (const island of islands) assert.equal(campaign.islandTop(island), island.top);
});

test('Nim shows the vision once; skipping Nim plays it once at the Heart gate instead', () => {
  const scout = { x: 0, z: -360 }, player = { position: { ...scout }, grounded: true, velocity: { y: 0 } };
  let carrying = false;
  const campaign = createHeartCampaign({ layout: layout(), scout, ready: () => carrying });
  assert.equal(campaign.interact(scout, 'calm', calm.chaos), null, 'Nim stays out of sight until you carry the Tide Hook');
  carrying = true;
  assert.equal(campaign.interact(scout, 'chaos', 0.8).kind, 'nim-calm');
  assert.equal(campaign.interact(scout, 'calm', calm.chaos).kind, 'vision');
  assert.equal(campaign.interact(scout, 'calm', calm.chaos).kind, 'nim', 'asked once');
  assert.equal(campaign.update(0.1, player, calm, true).vision, null, 'no second vision at the gate');
  const skipped = createHeartCampaign({ layout: layout(), scout });
  assert.equal(skipped.update(0.1, player, calm, false).vision, null, 'nothing outside Heart');
  assert.equal(skipped.update(0.1, player, calm, true).vision, 'gate');
  assert.equal(skipped.update(0.1, player, calm, true).vision, null, 'once');
  skipped.quakeTo(Infinity);
  skipped.reset();
  assert.equal(skipped.awakened, false);
  assert.equal(skipped.craterOpen, false, 'R puts the reef back in the ground');
  assert.equal(skipped.update(0.1, player, calm, true).vision, 'gate', 'and the vision can play again');
});

test('the crater is a bowl under the ring that leaves Sera and the shore alone', () => {
  const kingdom = layout();
  assert.ok(kingdom.craterDepth(kingdom.core.x, kingdom.core.z) > 15);
  for (const p of [kingdom.sera, kingdom.shore, kingdom.gate]) assert.equal(kingdom.craterDepth(p.x, p.z), 0);
});

test('the open crater replaces spiky ground with a smooth basin that clears every island spike', () => {
  const kingdom = layout();
  const spiky = (x, z) => 1.5 + 20 * Math.abs(Math.sin(x * 1.7) * Math.cos(z * 2.3)); // worst-case Heart spikes
  const ground = (x, z) => kingdom.craterGround(x, z, spiky(x, z));
  for (const island of kingdom.islands.filter(i => i.top > 15)) {
    for (const [dx, dz] of [[0, 0], [3, 0], [0, 3], [-3, 0], [0, -3]]) {
      const x = island.x + dx, z = island.z + dz;
      assert.ok(ground(x, z) < island.top - island.depth, `ground under ${island.id} stays below its spike`);
    }
  }
  // Inside the inner basin the ground is smooth (no step over 1 m per metre).
  const { at } = kingdom;
  for (let along = kingdom.reefAlong - 35; along <= kingdom.reefAlong + 35; along += 1) for (let side = -25; side <= 25; side += 1) {
    const p = at(along, side), q = at(along + 1, side);
    assert.ok(Math.abs(ground(p.x, p.z) - ground(q.x, q.z)) < 1, `smooth at ${along}, ${side}`);
  }
  assert.equal(kingdom.craterGround(kingdom.sera.x, kingdom.sera.z, 7), 7, 'outside the rim the land is untouched');
});

test('the islands are solid rock: the spike blocks, but standing on top and stepping off a bridge are free', () => {
  const kingdom = layout(), listening = kingdom.island('listening');
  const body = (x, feet, z) => kingdom.islandSolid(x, feet, feet + 2.05, z);
  assert.equal(body(listening.x, listening.top, listening.z), false, 'standing on the top');
  assert.equal(body(listening.x, listening.top - 4, listening.z), true, 'inside the rock under the top');
  assert.equal(body(listening.x, listening.top - listening.depth * 0.9, listening.z), true, 'inside the spike near its tip');
  assert.equal(body(listening.x + listening.radius * 0.7, listening.top - listening.depth * 0.9, listening.z), false, 'beside the narrow tip');
  assert.equal(body(listening.x + listening.radius + 3, listening.top - 2, listening.z), false, 'clear of the rim');
  for (const bridge of kingdom.bridges) for (const end of [bridge.start, bridge.end])
    assert.equal(body(end.x, end.top - 0.3, end.z), false, `${bridge.id} steps on and off freely`);
});

test('Heart waits for the Root Sigil and Tide Hook before starting', () => {
  const campaign = createHeartCampaign({ layout: layout(), ready: () => false });
  assert.equal(campaign.available, false);
  assert.equal(campaign.interact(campaign.layout.sera, 'calm').kind, 'locked');
  assert.equal(campaign.interact({ x: -400, z: 0 }, 'calm'), null, 'pressing E elsewhere in the world says nothing');
  assert.equal(campaign.stage, 'meet');
});

test('with every bridge down the spirit waits; raising bridge A lets A* reach the first spring', () => {
  const kingdom = layout();
  const campaign = createHeartCampaign({ layout: kingdom });
  assert.equal(campaign.interact(kingdom.sera, 'calm', calm.chaos).kind, 'meet');
  const player = { position: { ...kingdom.sera }, grounded: true, velocity: { y: 0 } };
  raise(campaign);
  campaign.update(0.1, player, calm, false);
  assert.equal(campaign.route, null, 'no bridge reaches the first spring yet');
  const start = campaign.spirit;
  campaign.update(0.5, player, calm, false);
  assert.deepEqual(campaign.spirit, start, 'the spirit does not move without a route');
  assert.equal(campaign.interact(kingdom.checkpoints[0], 'calm', calm.chaos).kind, 'waiting');
  openPassage(campaign, kingdom.passages[0], player);
  assert.ok(campaign.route, 'bridge A opens the way');
  assert.ok(campaign.route.path.every(p => onLand(kingdom, p)), 'the route never leaves the islands and bridges');
});

test('with bridge C down the spirit goes the long way round; raising C makes A* replan a shorter route', () => {
  const kingdom = layout();
  // Start the spirit at Spring Two with Spring Three as its goal; bridges A and B are already up.
  kingdom.spring = { ...kingdom.checkpoints[1] };
  kingdom.checkpoints[0] = { ...kingdom.checkpoints[2] };
  kingdom.passages.splice(0, 2);
  const campaign = createHeartCampaign({ layout: kingdom });
  campaign.setTestStage('escort');
  const player = { position: { ...kingdom.sera }, grounded: true, velocity: { y: 0 } };
  campaign.update(0.01, player, calm, false);
  assert.ok(campaign.route, 'the causeway still connects the ring');
  const before = distance(campaign.route.path);
  openPassage(campaign, kingdom.passages[0], player);
  const after = distance(campaign.route.path);
  assert.ok(after < before * 0.5, `bridge C shortens the route (${before.toFixed(0)} m -> ${after.toFixed(0)} m)`);
});

test('every Tide Hook crossing works with the real pendulum: hold Q, let go anywhere in a wide window', () => {
  const kingdom = layout();
  for (const swing of kingdom.swings) {
    const ok = workingReleases({ createGrapple, layout: kingdom, swing });
    // At 0.05 s steps, 10 working release times is a forgiving half-second window.
    assert.ok(ok.length >= 10, `${swing.id}: lands for releases ${ok.join(', ') || 'never'}`);
  }
});

test('coming down is allowed: no fall recovery over the reef, and no scripted drop (swing or jump down)', () => {
  const campaign = createHeartCampaign({ layout: layout() });
  raise(campaign);
  assert.equal(campaign.recovery, undefined, 'a fall off an island is a way down, not a failure');
  assert.equal(campaign.layout.exit, undefined);
});

test('after the Tide Hook, the goal sends you to Nim until the vision has played, then to Sera', () => {
  const campaign = createHeartCampaign({ layout: layout(), scout: { x: 0, z: -360 } });
  assert.match(campaign.goal, /NIM/);
  campaign.quakeTo(1);
  assert.match(campaign.goal, /SERA/);
  assert.match(createHeartCampaign({ layout: layout() }).goal, /SERA/, 'no Nim in the world: straight to Sera');
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
