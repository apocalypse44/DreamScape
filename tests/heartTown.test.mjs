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
const { heartLayout, createHeartCampaign } = await load('../src/models/heartCampaign.js');
const { TOWN_Y, CANAL, CITY, WALL } = await load('../src/models/heartTown.js');
const kingdom = heartLayout({ x: 350, z: 0 });
const { town } = kingdom;
const spiky = (x, z) => 1.5 + 20 * Math.abs(Math.sin(x * 1.7) * Math.cos(z * 2.3)); // worst-case Heart spikes
const ground = (x, z) => town.ground(x, z, spiky(x, z));
const flatAround = (p, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => Math.abs(ground(p.x + dx, p.z + dz) - TOWN_Y) < 0.01);

test('every building, the well, the mills, the townsfolk and the palace stand on flat town ground', () => {
  for (const b of town.buildings) assert.ok(flatAround(b, b.radius), `${b.model} at ${b.along}, ${b.side}`);
  assert.ok(flatAround(town.well, town.well.radius));
  for (const f of [...town.folk, ...town.returning]) assert.ok(flatAround(f, 0.5), f.name);
  assert.ok(flatAround(town.palace, town.palace.plinth), 'palace plinth');
  assert.ok(flatAround(town.palace.stair, 2), 'palace stair');
  for (const p of [...town.gardenFountains, ...town.mirrorPools]) assert.ok(flatAround(p, 2));
  assert.ok(Math.abs(ground(kingdom.sera.x, kingdom.sera.z) - TOWN_Y) < 0.01, 'Sera stands in town');
  assert.ok(Math.abs(ground(kingdom.shore.x, kingdom.shore.z) - TOWN_Y) < 0.01, 'the climb starts on the flat');
});

test('the canal and the Listening Spring are carved below the banks; the land beyond the town is untouched', () => {
  const mid = kingdom.at((CANAL.from + CANAL.to) / 2, 0), bank = kingdom.at((CANAL.from + CANAL.to) / 2, CANAL.half + CANAL.bank + 0.5);
  assert.ok(Math.abs(ground(mid.x, mid.z) - town.canalBottom) < 0.01);
  assert.ok(Math.abs(ground(bank.x, bank.z) - TOWN_Y) < 0.01);
  assert.ok(ground(town.spring.x, town.spring.z) < TOWN_Y - 0.9);
  const far = kingdom.at(50, 175); // past the farmland
  assert.equal(ground(far.x, far.z), spiky(far.x, far.z));
});

test('nothing in town overlaps the canal, another building, or the crater', () => {
  const solids = [...town.buildings, { ...town.well, model: 'well' }, ...town.mills.map(m => ({ ...m, ...kingdom.at(m.along, m.side * 6.5), model: 'mill body', radius: 2.6 }))];
  for (const b of solids.filter(b => b.model !== 'mill body')) assert.ok(Math.abs(b.side) - b.radius > CANAL.half + CANAL.bank, `${b.model} clears the canal`);
  for (const b of town.buildings) {
    assert.ok(b.along - b.radius > CITY.a0 + WALL.thickness / 2 && b.along + b.radius < CITY.a1, `${b.model} inside the walls`);
    assert.ok(b.side - b.radius > CITY.s0 + WALL.thickness / 2 && b.side + b.radius < CITY.s1 - WALL.thickness / 2, `${b.model} inside the walls`);
  }
  for (const b of town.buildings.filter(b => b.model.startsWith('home')))
    for (const r of town.streets) assert.ok(!(b.along > r.a0 - b.radius && b.along < r.a1 + b.radius && b.side > r.s0 - b.radius && b.side < r.s1 + b.radius), 'homes stay off the streets');
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
    const a = solids[i], b = solids[j];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > a.radius + b.radius + 1, `${a.model} and ${b.model} keep apart`);
  }
  for (const b of [...solids, ...town.folk]) assert.equal(kingdom.craterDepth(b.x, b.z), 0, 'the town stays out of the crater');
  for (const f of town.folk) for (const b of solids) assert.ok(Math.hypot(f.x - b.x, f.z - b.z) > b.radius + 0.6, `${f.name} is not inside ${b.model}`);
});

test('townsfolk talk at any time, and their lines change once the current is restored', () => {
  const campaign = createHeartCampaign({ layout: kingdom, ready: () => false });
  const tobin = town.folk[0];
  assert.match(campaign.hint(tobin, 'calm'), /TALK TO MILLER TOBIN/);
  assert.equal(campaign.interact(tobin, 'chaos', 0.8).text, tobin.dry);
  const restored = createHeartCampaign({ layout: kingdom });
  restored.setTestStage('complete');
  assert.equal(restored.interact(tobin, 'calm', 0.06).text, tobin.restored);
  assert.equal(campaign.hint({ x: town.buildings[0].x, z: town.buildings[0].z }, 'calm'), null, 'no locked-gate message across the town');
});
