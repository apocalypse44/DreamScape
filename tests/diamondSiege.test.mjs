import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiamondKingdom, DIAMOND_BASE, SIEGE_YARD, BARRACKS, DIAMOND_MESAS, MESA_CLIFF } from '../src/models/diamond.js';
import { siegeLayout, GATE_HALF } from '../src/models/diamondSiege.js';

const k = createDiamondKingdom({ x: 9, z: 344 });
const s = siegeLayout(k);
const inside = (z, p, pad = 0) => p.u > z.u0 + pad && p.u < z.u1 - pad && p.v > z.v0 + pad && p.v < z.v1 - pad;

test('every engine, building and prop sits inside its compound, on level ground, off the roads', () => {
  for (const [zone, items] of [[SIEGE_YARD, s.yard], [BARRACKS, s.barracks]]) for (const it of items) {
    assert.ok(inside(zone, it, it.radius + 0.5), `${it.path} at ${it.u},${it.v} leaves its compound`);
    for (const a of [0, 1.6, 3.1, 4.7]) {
      const p = k.at(it.u + Math.cos(a) * it.radius, it.v + Math.sin(a) * it.radius);
      assert.equal(k.ground(p.x, p.z, 9), DIAMOND_BASE, `${it.path} footprint is not level`);
    }
    assert.ok(!k.road(it.x, it.z, it.radius), `${it.path} is on a road`);
  }
});

test('nothing overlaps inside a compound', () => {
  for (const items of [s.yard, s.barracks]) for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    assert.ok(Math.hypot(a.u - b.u, a.v - b.v) > a.radius + b.radius + 0.4, `${a.path} overlaps ${b.path}`);
  }
});

test('both compounds have one gate gap facing the causeway road', () => {
  for (const [wall, zone, side] of [[s.palisade, SIEGE_YARD, 'v0'], [s.wall, BARRACKS, 'v1']]) {
    const edge = wall.filter(p => p.v === zone[side]);
    assert.ok(!edge.some(p => Math.abs(p.u - zone.gate) < GATE_HALF));
    assert.ok(edge.some(p => p.u < zone.gate) && edge.some(p => p.u > zone.gate));
    for (const p of wall) assert.equal(k.ground(p.x, p.z, 9), DIAMOND_BASE);
  }
});

test('compounds keep clear of mesas and the causeway', () => {
  for (const zone of [SIEGE_YARD, BARRACKS]) {
    for (const m of DIAMOND_MESAS) {
      const cu = Math.max(zone.u0, Math.min(zone.u1, m.u)), cv = Math.max(zone.v0, Math.min(zone.v1, m.v));
      assert.ok(Math.hypot(m.u - cu, m.v - cv) > (m.r + MESA_CLIFF) * 1.11);
    }
    assert.ok(Math.min(Math.abs(zone.v0), Math.abs(zone.v1)) > 10);
  }
});
