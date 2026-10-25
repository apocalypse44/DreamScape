import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
function load(file) {
  const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, q, path) => `from ${q}${load(new URL(path, file))}${q}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const { createCloverCampaign, CLOVER_STORY, livingRoadGround } = await import(load(new URL('../src/models/cloverCampaign.js', import.meta.url)));
const { ROOT_HEADINGS, ROOT_LANDINGS } = await import(load(new URL('../src/models/cloverGrowth.js', import.meta.url)));
const position = p => ({ x: p.x, y: p.top + 2.05, z: p.z });
function start(model) { return model.interact(position(CLOVER_STORY.iven), 'calm'); }
function crossing(model) {
  const index = model.generation, p = position(ROOT_LANDINGS[index]);
  while (model.guides[index] !== ROOT_HEADINGS[index]) model.interact(p, 'calm');
  assert.equal(model.interact(p, 'chaos').kind, 'growing');
  for (let i = 0; i < 150; i++) model.update(1 / 60);
}
function restored() { const model = createCloverCampaign(); start(model); for (let i = 0; i < 3; i++) crossing(model); return model; }

test('the chapter waits for both earlier-story prerequisites and a calm conversation', () => {
  let ready = false; const model = createCloverCampaign({ ready: () => ready });
  assert.equal(start(model).kind, 'locked'); assert.equal(model.stage, 'meet');
  ready = true;
  assert.equal(model.interact(position(CLOVER_STORY.iven), 'chaos').kind, 'calm');
  assert.equal(start(model).kind, 'meet'); assert.equal(model.stage, 'road');
});
test('uncommitted roots stop at stone and retries never remove completed crossings', () => {
  const model = createCloverCampaign(); start(model);
  assert.equal(model.interact(position(ROOT_LANDINGS[0]), 'chaos').kind, 'blocked');
  assert.equal(model.generation, 0); assert.equal(model.pending, null);
  crossing(model);
  const first = model.platforms.find(p => p.name === 'living-road');
  assert.equal(first.contains(first.x, first.z), true);
  assert.equal(model.interact(position(ROOT_LANDINGS[1]), 'chaos').kind, 'blocked');
  assert.equal(model.generation, 1); assert.equal(first.contains(first.x, first.z), true);
});
test('growth is time-based, becomes solid only when finished, and survives changing modes', () => {
  const model = createCloverCampaign(); start(model);
  const p = position(ROOT_LANDINGS[0]);
  while (model.guides[0] !== ROOT_HEADINGS[0]) model.interact(p, 'calm');
  model.interact(p, 'chaos');
  const bridge = model.platforms.find(p => p.name === 'living-road');
  model.update(.1); assert.equal(bridge.contains(bridge.x, bridge.z), false);
  model.update(0); assert.equal(model.generation, 0);
  assert.equal(model.interact(p, 'calm'), null); // no rotation during a generation
  for (let i = 0; i < 150; i++) model.update(1 / 60);
  assert.equal(bridge.contains(bridge.x, bridge.z), true);
  assert.equal(model.interact(p, 'chaos'), null); // old guide is no longer active
  assert.equal(bridge.contains(bridge.x, bridge.z), true);
});
test('sigil requires reaching the Scar at its height in calm after restoring the whole road', () => {
  const model = createCloverCampaign(); start(model);
  assert.equal(model.interact(position(CLOVER_STORY.scar), 'calm'), null);
  for (let i = 0; i < 3; i++) crossing(model);
  assert.equal(model.sigil, false); assert.equal(model.stage, 'scar');
  assert.equal(model.interact({ ...position(CLOVER_STORY.scar), y: 2 }, 'calm'), null);
  assert.equal(model.interact(position(CLOVER_STORY.scar), 'chaos').kind, 'calm');
  assert.equal(model.interact(position(CLOVER_STORY.scar), 'calm').kind, 'sigil');
  assert.equal(model.sigil, true); assert.equal(model.interact(position(CLOVER_STORY.scar), 'calm'), null);
});
test('the Sky Garden ledge chest requires the Scar and perch height, and awards exactly once', () => {
  const model = restored(), at = position(CLOVER_STORY.chest);
  assert.equal(model.interact(at, 'calm').kind, 'sealed');
  model.interact(position(CLOVER_STORY.scar), 'calm');
  assert.equal(CLOVER_STORY.chest.top, 68);
  for (const top of [12,24,64,66]) assert.equal(model.interact({ ...at, y: top + 2.05 }, 'calm'), null, 'the chest requires the highest perch, not terrain or the lower ledges');
  assert.equal(model.interact(at, 'chaos').kind, 'calm');
  assert.equal(model.interact(at, 'calm').kind, 'hook'); assert.equal(model.hook, true);
  assert.equal(model.interact(at, 'calm').kind, 'taken');
  assert.match(model.goal, /HEART/);
});

test('Scar and Iven give the full chest route before the reward and the Heart lead afterward', () => {
  const model=restored();
  const scar=model.interact(position(CLOVER_STORY.scar),'calm');
  const iven=model.interact(position(CLOVER_STORY.iven),'calm');
  assert.equal(scar.ms,8000);assert.equal(iven.ms,8000);
  for(const text of [scar.text,iven.text,model.goal,model.hint(position(CLOVER_STORY.scar),'calm')]) {
    assert.match(text,/terraces/i);assert.match(text,/teleporter/i);assert.match(text,/Sky Garden/i);assert.match(text,/Starlight Ledges/i);
  }
  model.interact(position(CLOVER_STORY.chest),'calm');
  const completion=model.interact(position(CLOVER_STORY.iven),'calm');
  assert.equal(completion.ms,8000);
  const completed=completion.text;
  assert.match(completed,/complete/);assert.match(completed,/east to Heart/);assert.match(completed,/Sera/);
  assert.doesNotMatch(completed,/climb|highest|open my chest/i);
});
test('falls return to a visited safe junction and cannot erase growth or earned rewards', () => {
  const model = restored(); model.interact(position(CLOVER_STORY.scar), 'calm');
  const player = { position: position(ROOT_LANDINGS[2]), grounded: true, velocity: { y: 0 } };
  model.update(.01, player); player.position.y = 8; player.velocity.y = -10; player.grounded = false;
  const checkpoint = model.recovery(player);
  assert.equal(checkpoint.x, ROOT_LANDINGS[2].x); assert.equal(checkpoint.top, 12);
  assert.notEqual(checkpoint.z, ROOT_LANDINGS[2].z); // clear of the guide's collider
  assert.equal(model.generation, 3); assert.equal(model.sigil, true);
});
test('companion visits the bend instead of cutting diagonally across the ravine', () => {
  const model = restored(), dog = { x: -55, z: -420 }, player = position(ROOT_LANDINGS[2]);
  assert.deepEqual(model.companionTarget(dog, player), ROOT_LANDINGS[1]);
  assert.equal(model.companionTarget({ x: -68, z: -420 }, player).x, -68);
});
test('reset clears all chapter state and deactivates the same registered platform objects', () => {
  const model = restored(); model.interact(position(CLOVER_STORY.scar), 'calm'); model.interact(position(CLOVER_STORY.chest), 'calm');
  const first = model.platforms.find(p => p.name === 'living-road'); model.reset();
  assert.equal(model.generation, 0); assert.equal(model.sigil, false); assert.equal(model.hook, false);
  assert.equal(model.stage, 'meet'); assert.equal(first.contains(first.x, first.z), false);
});
test('reserved ground preserves the original summit, Sky Garden, spawn and other kingdoms', () => {
  for (const [x, z] of [[0, 0], [0, -437], [-18, -473], [2, -499], [88, -552], [-400, 0], [400, 0], [0, 400]]) {
    assert.equal(livingRoadGround(x, z, 7.5), 7.5);
  }
  assert.equal(livingRoadGround(-68, -440, 22), -7);
  for (let x = -127; x < -17; x += .5) assert.ok(Math.abs(livingRoadGround(x, -425, 20) - livingRoadGround(x + .001, -425, 20)) < .02);
});
