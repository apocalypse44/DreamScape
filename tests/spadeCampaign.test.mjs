import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSpadeCampaign, segmentHitsSphere, LANTERN_SITES, WARD, LANTERN, STRIKE } from '../src/models/spadeCampaign.js';

const REFUGE = { x: -366, y: 3, z: -23 };
const ANCHOR_VIEW = { x: WARD.x + 10, y: 0, z: WARD.z };
const DT = 0.1;
const flockAt = (p, n) => Array.from({ length: n }, () => ({ ...p }));
const swarmOf = (positions, previous = positions) => ({ enabled: true, positions, previous });
const run = (campaign, seconds, ...args) => { let last = null; for (let t = 0; t < seconds; t += DT) last = campaign.update(DT, ...args) ?? last; return last; };

function atAnchor() {
  const c = createSpadeCampaign();
  c.update(DT, REFUGE, 0, null);
  for (const site of LANTERN_SITES) run(c, LANTERN.hold + 0.3, REFUGE, 0, swarmOf(flockAt({ x: site.x, y: 0, z: site.z }, 20)));
  assert.equal(c.stage, 'anchor');
  return c;
}
// n wisps crossing the ward this frame (segment from one side to the other).
const pass = n => swarmOf(flockAt({ x: WARD.x, y: 0, z: WARD.z + 5 }, n), flockAt({ x: WARD.x, y: 0, z: WARD.z - 5 }, n));

test('swept test catches a fast crossing that both endpoints miss', () => {
  const c = { x: 0, y: 0, z: 0 };
  assert.ok(segmentHitsSphere({ x: -5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, c, 1));
  assert.ok(!segmentHitsSphere({ x: -5, y: 3, z: 0 }, { x: 5, y: 3, z: 0 }, c, 1));
});

test('Neris is met only in calm, and lanterns need a gathered flock in calm', () => {
  const c = createSpadeCampaign();
  assert.equal(c.update(DT, REFUGE, 0.8, null), null);
  assert.equal(c.update(DT, REFUGE, 0, null).kind, 'neris');
  const site = LANTERN_SITES[0], at = { x: site.x, y: 0, z: site.z };
  run(c, 3, REFUGE, 0, swarmOf(flockAt(at, LANTERN.wisps - 1)));   // too few wisps
  run(c, 3, REFUGE, 0.8, swarmOf(flockAt(at, 30)));                 // chaos
  assert.equal(c.lit, 0);
  assert.equal(run(c, LANTERN.hold + 0.2, REFUGE, 0, swarmOf(flockAt(at, 30))).kind, 'lantern');
  assert.equal(c.lit, 1);
});

test('strikes need chaos, enough distinct wisps, and break the anchor after three', () => {
  const c = atAnchor();
  assert.equal(c.update(DT, ANCHOR_VIEW, 0, pass(40)), null);                       // calm: ward closed
  assert.equal(c.strikeTarget(ANCHOR_VIEW, 0), null);
  assert.ok(c.strikeTarget(ANCHOR_VIEW, 0.8));
  assert.equal(c.strikeTarget({ x: WARD.x + WARD.range + 5, y: 0, z: WARD.z }, 0.8), null); // too far to aim
  assert.equal(c.update(DT, ANCHOR_VIEW, 0.8, pass(STRIKE.wisps - 1)), null);      // stray handful
  assert.equal(c.strikes, 0);
  for (let k = 1; k <= STRIKE.needed; k++) {
    run(c, Math.max(STRIKE.window, STRIKE.cooldown) + 0.2, ANCHOR_VIEW, 0.8, swarmOf([])); // window lapses / cooldown ends
    const event = c.update(DT, ANCHOR_VIEW, 0.8, pass(STRIKE.wisps));
    assert.equal(event.kind, k < STRIKE.needed ? 'strike' : 'broken');
    assert.equal(c.update(DT, ANCHOR_VIEW, 0.8, pass(40)), null);                   // cooldown: no double count
  }
  assert.equal(c.stage, 'report');
  const sigil = c.update(DT, REFUGE, 0, null);
  assert.equal(sigil.kind, 'sigil');
  assert.match(sigil.text, /castle/);   // bindings not yet understood: the castle comes before Clover
  assert.ok(c.sigil);
  assert.match(c.goal, /CASTLE/);
  c.reset();
  assert.equal(c.stage, 'meet');
  assert.equal(c.strikes, 0);
});

test('Neris turns the player away until the hound is cured, once per visit', () => {
  let cured = false;
  const c = createSpadeCampaign({ ready: () => cured });
  assert.equal(c.update(DT, REFUGE, 0, null).kind, 'waiting');
  assert.equal(c.update(DT, REFUGE, 0, null), null);            // not repeated while inside
  c.update(DT, { x: 0, y: 0, z: 0 }, 0, null);                  // leave the refuge
  assert.equal(c.update(DT, REFUGE, 0, null).kind, 'waiting');  // said again on the next visit
  assert.equal(c.stage, 'meet');
  cured = true;
  assert.equal(c.update(DT, REFUGE, 0, null).kind, 'neris');
  assert.equal(c.stage, 'lanterns');
});

test('castle doors stay sealed until the chapter is complete and the gate is opened', () => {
  const c = atAnchor(), door = c.doorVolume;
  assert.ok(door.contains(door.x, 0));
  c.openGate();                                   // too early: no effect
  assert.ok(door.contains(door.x, 0) && !c.gateOpen && /SEALED/.test(c.gateMessage));
  for (let k = 0; k < STRIKE.needed; k++) { run(c, STRIKE.cooldown + 0.2, ANCHOR_VIEW, 0.8, swarmOf([])); c.update(DT, ANCHOR_VIEW, 0.8, pass(STRIKE.wisps)); }
  c.update(DT, REFUGE, 0, null);
  assert.equal(c.stage, 'complete');
  assert.ok(door.contains(door.x, 0));            // still closed until the cutscene opens it
  c.openGate();
  assert.ok(!door.contains(door.x, 0) && c.gateMessage === null);
  c.reset();
  assert.ok(door.contains(door.x, 0));
});
