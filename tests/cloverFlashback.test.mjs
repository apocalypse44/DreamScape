import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
function load(file) {
  const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, q, path) => `from ${q}${load(new URL(path, file))}${q}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const { severingStage, castPose, SEVERING_CAST, SEVERING_BREAKS } = await import(load(new URL('../src/controllers/cloverFlashback.js', import.meta.url)));
const { SEVERING_TRIAD } = await import(load(new URL('../src/controllers/cloverFlashback.js', import.meta.url)));
const { markStage, MARK_KEEPER, MARK_PUP, MARK_TRIAD } = await import(load(new URL('../src/controllers/emberFlashback.js', import.meta.url)));

test('the memory fades in from the present, darkens with the Triad, and snaps fully back', () => {
  const start = severingStage(0), end = severingStage(40.6);
  assert.equal(start.amount, 0); assert.equal(start.storm, 0); assert.equal(start.broken, 0);
  assert.ok(severingStage(3).amount === 1 && severingStage(3).storm === 0, 'a calm, full memory before Veyr arrives');
  assert.ok(severingStage(11).storm === 1 && severingStage(11).veyr === 1, 'Veyr arrives in the storm');
  for (const k of ['amount', 'shimmer', 'chains', 'beam', 'veyr']) assert.equal(end[k], 0, `${k} is back to the present`);
  let last = 0;
  for (let t = 0; t <= 40.6; t += .05) { const b = severingStage(t).broken; assert.ok(b >= last && b <= 3); last = b; }
  assert.equal(last, 3, 'all three crossings fall');
  assert.ok(severingStage(34).seal > .8 && severingStage(30).decoys === 1, 'decoys are carved before Iven seals the true pattern');
});

test('every actor is off each crossing before it snaps, and nobody walks through the Archive walls', () => {
  // Crossing spans over the ravine (between landing edges), 1.9 m either side of the centre line.
  const spans = [
    p => p.x > -62 && p.x < -43 && Math.abs(p.z + 420) < 1.9,   // crossing 1 (falls last)
    p => p.z > -449 && p.z < -426 && Math.abs(p.x + 68) < 1.9,  // crossing 2
    p => p.x > -95 && p.x < -74 && Math.abs(p.z + 455) < 1.9,   // crossing 3 (falls first)
  ];
  const breakOf = [SEVERING_BREAKS[2], SEVERING_BREAKS[1], SEVERING_BREAKS[0]];
  for (const [name, def] of Object.entries(SEVERING_CAST)) for (let t = 0; t <= 40.6; t += .05) {
    const p = castPose(def.keys, t);
    spans.forEach((on, i) => assert.ok(!(t >= breakOf[i] && on(p)), `${name} is on crossing ${i + 1} after it snapped (t ${t.toFixed(2)})`));
    // The hall's west wall (x -42) is only open at the door, z -422.5 to -417.5.
    assert.ok(!(Math.abs(p.x + 42) < .4 && (p.z > -417.5 || p.z < -422.5) && p.z > -431 && p.z < -410), `${name} walks through the west wall`);
  }
});

test('poses follow their blocking: moving between keys, holding still at them', () => {
  const keys = [[0, 0, 0, 'Walk_Loop'], [10, 10, 0, 'Idle_Loop']];
  assert.deepEqual(castPose(keys, 5), { x: 5, z: 0, clip: 'Walk_Loop', moving: true, dx: 10, dz: 0 });
  assert.deepEqual(castPose(keys, 12), { x: 10, z: 0, clip: 'Idle_Loop', moving: false });
});

test('the Dark Triad hangs in the storm above the Scar, clear of the Archive and every shrine pillar', () => {
  for (const [name, p] of Object.entries(SEVERING_TRIAD)) {
    assert.ok(p.y >= 22, `${name} is in the sky`);
    assert.ok(Math.hypot(p.x + 104, p.z + 455) < 10, `${name} is over the Scar`);
  }
  const s = severingStage(11);
  assert.ok(s.veyr === 1 && s.triad === 1, 'all three are present before the binding');
  assert.ok(severingStage(36).veyr === 0 && severingStage(36).triad === 0, 'all three are gone after the seal');
});

test('"The Mark in the Flame": the curse is planted, the Keeper arrives too late, and the memory ends in the present', () => {
  const end = markStage(31.5);
  for (const k of ['amount', 'shimmer', 'veyr', 'triad', 'thread', 'rift', 'embers', 'spark', 'ward']) assert.equal(end[k], 0, `${k} is back to the present`);
  assert.equal(end.mark, -1, 'the mark is gone');
  assert.ok(markStage(7.5).veyr === 1 && markStage(8).triad === 1, 'the Triad appears in the sky');
  assert.ok(markStage(14).thread > 0 && markStage(14).rift > 0 && markStage(14).mark > 0, 'Sile, Morcant and Veyr each act');
  // The mark has sunk into the pup before the Keeper reaches it (her run ends at 18 s).
  const arrive = MARK_KEEPER.keys.find(k => k[3] === 'Spell_Simple_Idle_Loop')[0];
  assert.ok(markStage(arrive).mark === -1 && markStage(arrive).spark > 0, 'too late: the curse already sleeps inside');
  assert.ok(markStage(23).triad < 1 && markStage(25).triad === 0, 'the Triad leaves as the ward holds');
  for (const [name, p] of Object.entries(MARK_TRIAD)) assert.ok(p.y >= 16 && Math.hypot(p.x, p.z + 11) < 8, `${name} hangs above the tower`);
  assert.ok(Math.hypot(MARK_PUP.x, MARK_PUP.z + 11) > 9, 'the pup sleeps clear of the tower');
});
