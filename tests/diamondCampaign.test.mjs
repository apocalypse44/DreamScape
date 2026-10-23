import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiamondCampaign, diamondLayout, socketCenter, socketAt, FRAGMENTS, BOARD } from '../src/models/diamondCampaign.js';

const DT = 0.1;
const CALM = 0, CHAOS = 0.8;
const layout = diamondLayout();
const ORIN = { ...layout.orin, y: 0 };
const AWAY = { x: 0, y: 0, z: 0 };
const cell = (x, y) => ({ ...socketCenter(layout, x, y), y: 0 });

function collecting() {
  const c = createDiamondCampaign();
  assert.equal(c.update(DT, ORIN, CALM).kind, 'orin');
  return c;
}
function gathered() {
  const c = collecting();
  for (const f of layout.fragments) c.update(DT, { ...f, y: 0 }, CALM);
  assert.equal(c.stage, 'repair');
  return c;
}
function fitted(c = gathered()) {
  for (const [x, y] of [[0, 0], [3, 3], [1, 2], [3, 0]]) {
    assert.equal(c.fit(cell(x, y), CALM).kind, 'fit');
    assert.notEqual(c.relay.tileAt(x, y), 0, 'a fragment is a conduit, never a blank');
  }
  assert.equal(c.fitted, FRAGMENTS);
  return c;
}

test('layout: sockets map back to themselves and the board sits clear of Orin and the fragments', () => {
  for (let y = 0; y < BOARD.size; y++) for (let x = 0; x < BOARD.size; x++) assert.deepEqual(socketAt(layout, socketCenter(layout, x, y)), { x, y });
  assert.equal(socketAt(layout, AWAY), null);
  for (const p of [layout.orin, ...layout.fragments]) assert.equal(socketAt(layout, p), null);
  // The relay lies inside the kingdom, beyond the gate (farther from the tower than the gate).
  assert.ok(Math.hypot(layout.center.x, layout.center.z) > Math.hypot(layout.gate.x, layout.gate.z));
});

test('Orin waits for the Tide Sigil and says so once per visit', () => {
  let tide = false;
  const c = createDiamondCampaign({ ready: () => tide });
  assert.equal(c.update(DT, ORIN, CALM).kind, 'waiting');
  assert.equal(c.update(DT, ORIN, CALM), null);
  c.update(DT, AWAY, CALM);
  assert.equal(c.update(DT, ORIN, CALM).kind, 'waiting');
  assert.equal(c.stage, 'meet');
  tide = true;
  assert.equal(c.update(DT, ORIN, CHAOS), null, 'Orin will not talk in chaos');
  assert.equal(c.update(DT, ORIN, CALM).kind, 'orin');
  assert.equal(c.stage, 'collect');
});

test('fragments are gathered in calm only', () => {
  const c = collecting();
  const f = { ...layout.fragments[0], y: 0 };
  assert.equal(c.update(DT, f, CHAOS), null);
  assert.equal(c.collected, 0);
  assert.equal(c.update(DT, f, CALM).kind, 'fragment');
  assert.equal(c.update(DT, f, CALM), null, 'a fragment is taken once');
  for (const g of layout.fragments.slice(1)) c.update(DT, { ...g, y: 0 }, CALM);
  assert.equal(c.collected, FRAGMENTS);
  assert.equal(c.stage, 'repair');
});

test('fitting needs calm, a socket underfoot and a loose fragment', () => {
  const c = collecting();
  assert.equal(c.fit(cell(0, 0), CALM).kind, 'empty');
  c.update(DT, { ...layout.fragments[0], y: 0 }, CALM);
  assert.equal(c.fit(AWAY, CALM).kind, 'hint');
  assert.equal(c.fit(cell(0, 0), CHAOS).kind, 'unstable');
  assert.equal(c.fit(cell(0, 0), CALM).kind, 'fit', 'a fragment can be fitted while still gathering');
  assert.equal(c.fit(cell(1, 1), CALM).kind, 'empty', 'only one fragment carried');
});

test('a fit narrows the neighbouring sockets', () => {
  const c = gathered();
  const before = c.relay.optionCount(1, 0);
  const version = c.version;
  c.fit(cell(0, 0), CALM);
  assert.ok(c.version > version);
  assert.ok(c.narrowed.some(([x, y]) => x === 1 && y === 0));
  assert.ok(c.relay.optionCount(1, 0) < before);
});

test('V on the last fitted socket turns it; earlier ones must be lifted first', () => {
  const c = gathered();
  c.fit(cell(1, 2), CALM);
  const first = c.relay.tileAt(1, 2);
  assert.equal(c.fit(cell(1, 2), CALM).kind, 'turn');
  assert.notEqual(c.relay.tileAt(1, 2), first);
  assert.equal(c.fitted, 1, 'turning does not spend another fragment');
  c.fit(cell(3, 3), CALM);
  assert.equal(c.fit(cell(1, 2), CALM).kind, 'buried');
});

test('X lifts the last fragment and never loses it', () => {
  const c = gathered();
  const start = c.relay.domains.slice();
  c.fit(cell(0, 0), CALM);
  assert.equal(c.lift().kind, 'lift');
  assert.equal(c.fitted, 0);
  assert.equal(c.collected, FRAGMENTS);
  assert.deepEqual(c.relay.domains, start);
  assert.equal(c.lift().kind, 'none');
});

test('chaos at a fully fitted relay powers it and opens the gate and core', () => {
  const c = gathered();
  c.fit(cell(0, 0), CALM);
  assert.equal(c.update(DT, cell(1, 1), CHAOS), null, 'needs every fragment fitted');
  c.lift();
  fitted(c);
  assert.equal(c.update(DT, cell(1, 1), CALM), null, 'needs chaos');
  assert.equal(c.update(DT, AWAY, CHAOS), null, 'needs the player near the relay');
  const event = c.update(DT, cell(1, 1), CHAOS);
  assert.equal(event.kind, 'powered');
  assert.equal(c.stage, 'report');
  assert.ok(c.relay.isSolved());
  assert.ok(c.flow.complete && c.flow.reached.has('escape-gate') && c.flow.reached.has('inversion-core'));
  assert.equal(c.fit(cell(2, 2), CALM), null, 'the board is final once powered');
  assert.equal(c.lift(), null);
});

test('a jam keeps the fragments; the next attempt is braced with the fallback pattern', () => {
  const c = fitted();
  const real = c.relay.solve.bind(c.relay);
  // Stand-in for a contradiction: the real solver, starved of budget, returns its fallback.
  c.relay.solve = () => ({ ...real({ budget: 1 }), reason: 'contradiction' });
  const fragments = c.relay.domains.slice();
  assert.equal(c.update(DT, cell(1, 1), CHAOS).kind, 'jam');
  assert.equal(c.stage, 'repair');
  assert.deepEqual(c.relay.domains, fragments, 'the player’s fragments are back in place');
  assert.equal(c.fitted, FRAGMENTS);
  assert.equal(c.update(DT, cell(1, 1), CHAOS), null, 'no retry until the world calms');
  c.update(DT, cell(1, 1), CALM);
  const event = c.update(DT, cell(1, 1), CHAOS);
  assert.equal(event.kind, 'powered');
  assert.ok(c.braced);
  assert.ok(c.flow.complete);
});

test('Orin grants the sigil in calm after the relay holds; reset clears everything', () => {
  const c = fitted();
  c.update(DT, cell(1, 1), CHAOS);
  assert.equal(c.update(DT, ORIN, CHAOS), null);
  const event = c.update(DT, ORIN, CALM);
  assert.equal(event.kind, 'sigil');
  assert.match(event.text, /Spade/);
  assert.ok(c.sigil);
  assert.match(c.goal, /SPADE/);
  c.reset();
  assert.equal(c.stage, 'meet');
  assert.equal(c.collected, 0);
  assert.equal(c.fitted, 0);
  assert.equal(c.flow, null);
  assert.equal(c.relay.placed.size, 0);
});

test('every stage has a goal line, with no algorithm terms in it', () => {
  const c = createDiamondCampaign();
  const seen = new Set();
  const check = () => { assert.ok(c.goal); assert.doesNotMatch(c.goal, /WFC|WAVE FUNCTION|ENTROPY|DOMAIN|PROPAGAT/i); seen.add(c.stage); };
  check();
  c.update(DT, ORIN, CALM); check();
  for (const f of layout.fragments) c.update(DT, { ...f, y: 0 }, CALM);
  check();
  fitted(c); check();
  c.update(DT, cell(1, 1), CHAOS); check();
  c.update(DT, ORIN, CALM); check();
  assert.deepEqual([...seen], ['meet', 'collect', 'repair', 'report', 'complete']);
});
