import test from 'node:test';
import assert from 'node:assert/strict';
import {
  N, E, S, W, ALL_TILES, TILE_TYPES,
  createRelay, validateLayout, makeTile, rotateTile, tileType, tileRotation, hasSide, popcount,
} from '../src/models/diamondWfc.js';

const layoutOf = (relay) => Array.from(relay.domains, (m) => Math.log2(m));

test('tiles: sixteen tiles form six types and rotations round-trip', () => {
  const counts = {};
  for (let t = 0; t < 16; t++) {
    const type = tileType(t);
    counts[type] = (counts[type] || 0) + 1;
    assert.equal(makeTile(type, tileRotation(t)), t);
  }
  assert.deepEqual(TILE_TYPES.sort(), Object.keys(counts).sort());
  assert.deepEqual(counts, { blank: 1, end: 4, straight: 2, corner: 4, tee: 4, cross: 1 });
  assert.equal(rotateTile(makeTile('end'), 1), 1 << E);
  assert.equal(rotateTile(makeTile('corner'), 4), makeTile('corner'));
});

test('board edges are closed except at ports, and required ports are open', () => {
  const relay = createRelay();
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      for (const t of relay.options(x, y)) {
        if (y === 0 && hasSide(t, N)) assert.ok(x === 1, 'only the optional side gate opens north');
        if (y === 3 && hasSide(t, S)) assert.ok(x === 2, 'only the inversion core opens south');
        if (x === 3 && hasSide(t, E)) assert.ok(y === 1, 'only the escape gate opens east');
        if (x === 0 && hasSide(t, W)) assert.ok(y === 1, 'only the source opens west');
      }
    }
  }
  assert.ok(relay.options(0, 1).every((t) => hasSide(t, W)), 'source socket always faces the source');
});

test('compatibility: a placed connector forces the neighbour to connect back', () => {
  const relay = createRelay();
  // (1,2) is not on the backbone, so it starts with several options.
  const before = relay.optionCount(1, 3);
  const res = relay.place(1, 2, makeTile('straight', 0)); // north-south
  assert.equal(res.ok, true);
  assert.ok(relay.options(1, 3).every((t) => hasSide(t, N)), 'southern neighbour must open north');
  assert.ok(relay.options(0, 2).every((t) => !hasSide(t, E)), 'western neighbour must stay closed east');
  assert.ok(relay.optionCount(1, 3) < before, 'neighbour options narrowed');
});

test('propagation narrows domains and reports which sockets changed', () => {
  const relay = createRelay();
  const total = (r) => r.domains.reduce((s, m) => s + popcount(m), 0);
  const before = total(relay);
  const res = relay.place(0, 0, makeTile('corner', 1)); // east + south
  assert.equal(res.ok, true);
  assert.ok(total(relay) < before);
  assert.ok(res.narrowed.length >= 2, 'the socket and at least one neighbour narrowed');
  assert.ok(res.narrowed.some(([x, y]) => x === 1 && y === 0));
});

test('an incompatible placement is rejected and changes nothing', () => {
  const relay = createRelay();
  const snapshot = relay.domains.slice();
  const res = relay.place(0, 0, makeTile('cross')); // would open into the board edge
  assert.deepEqual(res, { ok: false, reason: 'incompatible' });
  assert.deepEqual(relay.domains, snapshot);
  assert.equal(relay.history.length, 0);
});

test('undo restores the previous state', () => {
  const relay = createRelay();
  const start = relay.domains.slice();
  relay.place(0, 0, makeTile('corner', 1));
  const afterFirst = relay.domains.slice();
  relay.place(1, 2, makeTile('blank'));
  assert.equal(relay.undo(), true);
  assert.deepEqual(relay.domains, afterFirst);
  assert.equal(relay.undo(), true);
  assert.deepEqual(relay.domains, start);
  assert.equal(relay.undo(), false);
});

// Only straight and corner tiles, no ports, 5x5: every socket needs exactly two
// connectors, so the pipes must form closed loops covering all 25 sockets. A
// grid loop always has an even length, so an odd board has no solution, but
// propagation alone cannot see that: the search has to find out.
const TWO_SIDED = Array.from({ length: 16 }, (_, t) => t).filter((t) => popcount(t) === 2);
const IMPOSSIBLE = { size: 5, ports: [], backbone: [], tiles: TWO_SIDED };

test('contradiction recovery: a placement that empties a socket is rolled back', () => {
  const config = IMPOSSIBLE;
  let found = null;
  for (let y = 0; y < 5 && !found; y++) {
    for (let x = 0; x < 5 && !found; x++) {
      const probe = createRelay(config);
      for (const t of probe.options(x, y)) {
        const relay = createRelay(config);
        const before = relay.domains.slice();
        const res = relay.place(x, y, t);
        if (!res.ok && res.reason === 'contradiction') {
          assert.deepEqual(relay.domains, before, 'state restored after contradiction');
          found = { x, y, t };
          break;
        }
      }
    }
  }
  assert.ok(found, 'expected at least one contradicting placement');
});

test('solve backtracks, and reports failure when no valid layout exists', () => {
  const relay = createRelay(IMPOSSIBLE);
  const res = relay.solve();
  assert.equal(res.ok, false, 'an odd board of two-sided tiles has no solution');
  assert.ok(relay.stats.backtracks > 0, 'the search tried and undid choices');
});

test('solve completes the default relay with source, gate and core connected', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const relay = createRelay({ seed });
    const res = relay.solve();
    assert.equal(res.ok, true);
    assert.equal(relay.isSolved(), true);
    assert.equal(validateLayout(relay, layoutOf(relay)), true);
    const flow = relay.trace();
    assert.equal(flow.complete, true, `seed ${seed} connects every required port`);
    assert.ok(flow.reached.has('escape-gate') && flow.reached.has('inversion-core'));
  }
});

test('solve keeps the player\'s placements', () => {
  const relay = createRelay();
  relay.place(0, 0, makeTile('corner', 1));
  relay.place(3, 3, makeTile('blank'));
  const res = relay.solve();
  assert.equal(res.ok, true);
  if (!res.fallback) {
    assert.equal(relay.tileAt(0, 0), makeTile('corner', 1));
    assert.equal(relay.tileAt(3, 3), makeTile('blank'));
  }
});

test('the arrangement decides whether the optional side gate opens', () => {
  const opened = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const relay = createRelay({ seed });
    relay.solve();
    opened.add(relay.trace().reached.has('side-gate'));
  }
  assert.deepEqual([...opened].sort(), [false, true]);
});

test('fallback layout is valid and is used when the budget runs out', () => {
  const relay = createRelay();
  const fallback = relay.fallbackLayout();
  assert.ok(fallback);
  assert.equal(validateLayout(relay, fallback), true);

  const res = relay.solve({ budget: 3 });
  assert.equal(res.ok, true);
  assert.equal(res.fallback, true);
  assert.equal(res.reason, 'budget');
  assert.ok(res.ops <= 4, 'stopped at the operation budget');
  assert.equal(relay.trace().complete, true);
  assert.equal(relay.undo(), true, 'the fallback itself can be undone');
});

test('the operation budget is respected by a normal solve', () => {
  const relay = createRelay({ budget: 500 });
  const res = relay.solve();
  assert.ok(res.ops <= 501);
});

test('reset returns to the starting board', () => {
  const relay = createRelay();
  const start = relay.domains.slice();
  relay.place(0, 0, makeTile('corner', 1));
  relay.solve();
  relay.reset();
  assert.deepEqual(relay.domains, start);
  assert.equal(relay.placed.size, 0);
  assert.equal(relay.history.length, 0);
});

test('every socket starts with at least one option', () => {
  const relay = createRelay();
  assert.ok(relay.domains.every((m) => m !== 0 && (m & ~ALL_TILES) === 0));
});
