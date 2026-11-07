import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiamondKingdom, DIAMOND_BASE } from '../src/models/diamond.js';
import { createRow, SHOPS, SHOP, HALL, STREET, STUDY, fragmentSpot, hallWalls, shopWalls, studyPage, STUDY_PAGES } from '../src/models/diamondRow.js';
import { hasSide, opposite } from '../src/models/diamondWfc.js';

const k = createDiamondKingdom({ x: 9, z: 344 });
const row = createRow(k);

test('the Row stands on level ground', () => {
  for (const p of [...row.colliders, ...row.fragments]) assert.equal(k.ground(p.x, p.z, 9), DIAMOND_BASE);
});

test('each workshop holds one campaign fragment, inside its walls, off the street', () => {
  k.layout.fragments.forEach((f, i) => assert.ok(Math.hypot(f.x - row.fragments[i].x, f.z - row.fragments[i].z) < 0.01));
  for (const shop of SHOPS) {
    const f = fragmentSpot(shop);
    assert.ok(Math.abs(f.u - shop.u) < SHOP.w / 2 - 1 && Math.abs(f.v - shop.v) < SHOP.d / 2 - 1);
    const p = k.at(f.u, f.v);
    assert.ok(!k.road(p.x, p.z), `${shop.trade} fragment is on the road`);
    // Nearest wall is far enough not to block the pickup (2.5 m) from the open front.
    assert.ok(shopWalls(shop).every(w => Math.hypot(w.u - f.u, w.v - f.v) > 1.2));
  }
});

test('the hall is closed except its street door, and the street reaches the door', () => {
  const doorway = hallWalls().filter(w => w.u === HALL.u0 && Math.abs(w.v - STREET.v) < HALL.door / 2 + 0.5);
  assert.equal(doorway.length, 0);
  const inDoor = k.at(HALL.u0, STREET.v), outside = k.at(HALL.u0 - 1, STREET.v);
  assert.ok(k.road(outside.x, outside.z) && k.road(inDoor.x, inDoor.z));
  const centre = k.at((HALL.u0 + HALL.u1) / 2, (HALL.v0 + HALL.v1) / 2);
  assert.ok(row.insideHall(centre.x, centre.z) && !row.insideHall(outside.x, outside.z));
});

test('the study wall is reachable inside the hall', () => {
  const p = k.at(STUDY.u - 2.5, STUDY.v);
  assert.ok(row.nearStudy(p.x, p.z) && row.insideHall(p.x, p.z));
  const door = k.at(HALL.u0 + 0.5, STREET.v);
  assert.ok(!row.nearStudy(door.x, door.z));
});

test('shops and hall do not overlap each other or the street', () => {
  for (const s of SHOPS) {
    const front = s.v + s.face * SHOP.d / 2;
    assert.ok(Math.abs(front - STREET.v) > 2.5 + 1, `${s.trade} front is too close to the street`);
  }
  for (let i = 0; i < SHOPS.length; i++) for (let j = i + 1; j < SHOPS.length; j++) {
    const a = SHOPS[i], b = SHOPS[j];
    assert.ok(Math.abs(a.u - b.u) >= SHOP.w + 2 || Math.abs(a.v - b.v) >= SHOP.d + 2, `${a.trade} overlaps ${b.trade}`);
  }
  for (const s of SHOPS) assert.ok(s.u + SHOP.w / 2 < HALL.u0 - 1);
});

test('every study page example obeys the relay adjacency rule', () => {
  for (let i = 0; i < STUDY_PAGES; i++) {
    const page = studyPage(i);
    assert.ok(page.title && page.lines.length);
    if (!page.sides) continue;
    for (const { dir, good, bad } of page.sides) {
      assert.equal(hasSide(good, opposite(dir)), hasSide(page.centre, dir), `${page.title} ${dir} good`);
      assert.notEqual(hasSide(bad, opposite(dir)), hasSide(page.centre, dir), `${page.title} ${dir} bad`);
      assert.ok(good && bad);
    }
  }
  assert.deepEqual(studyPage(STUDY_PAGES), studyPage(0));
});
