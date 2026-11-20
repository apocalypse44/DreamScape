import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/models/cloverTerrain.js', import.meta.url), 'utf8');
const { cloverGround, cloverArea, CLOVER_PLATEAUS, createCloverRecovery, CLOVER_ENTRANCE, CLOVER_SUMMIT_CHECKPOINT, CLOVER_GATE } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('irregular landforms reject their cut-off bounding-box corners', () => {
  for (const p of CLOVER_PLATEAUS) {
    assert.equal(p.contains(p.x, p.z, 0), true);
    assert.equal(p.contains(p.x + p.width / 2 - 0.1, p.z + p.depth / 2 - 0.1, 0), false);
  }
});
test('a fall from the high formation recovers before the generic lethal-fall threshold', () => {
  const recovery = createCloverRecovery();
  const player = { position: { x: 2, y: 26.05, z: -510 }, velocity: { y: 0 }, grounded: true };
  assert.equal(recovery.update(player), null);
  player.grounded = false; player.velocity.y = -8; player.position.y -= 6;
  assert.deepEqual(recovery.update(player), CLOVER_SUMMIT_CHECKPOINT);
});
test('summit checkpoint survives jumps beyond the course edge and bare terrain cannot overwrite it',()=>{
  const r=createCloverRecovery(),p={position:{x:2,y:26.05,z:-510},velocity:{y:0},grounded:true};r.update(p);
  p.position.x=60;p.position.y=20;p.velocity.y=-10;p.grounded=false;
  assert.deepEqual(r.update(p),CLOVER_SUMMIT_CHECKPOINT);
  p.position.x=2;p.position.y=-4.95;p.grounded=true;
  assert.deepEqual(r.update(p),CLOVER_SUMMIT_CHECKPOINT);
  r.reset();assert.equal(r.update(p),null);
});
test('Clover terrain preserves Grimoire landmarks and other kingdoms', () => {
  for (const [x, z] of [[0, 0], [0, -11], [-18, -32], [72, 48], [400, 0], [0, 400], [-400, 0]]) {
    assert.equal(cloverGround(x, z, 8), 8);
    assert.equal(cloverArea(x, z), false);
  }
});
test('entrance, north approach and ravine floor stay stable across terrain states', () => {
  for (const height of [-5, 1.5, 20]) {
    for (const z of [-50, -170, -270, -336]) assert.equal(cloverGround(0, z, height), 1.5);
    for (const p of CLOVER_PLATEAUS) assert.equal(cloverGround(p.x, p.z, height), -7);
  }
});
test('Clover shaping blends continuously at course and approach boundaries', () => {
  for (let x = -45; x <= 45; x += 1) for (let z = -562; z <= -24; z += 1) {
    const h = cloverGround(x, z, 10);
    assert.ok(Number.isFinite(h));
    assert.ok(Math.abs(h - cloverGround(x + 0.001, z, 10)) < 0.02);
    assert.ok(Math.abs(h - cloverGround(x, z + 0.001, 10)) < 0.02);
  }
});

// On hilly seeds the hills reached the arch: the trail was cut only 6 m wide, so its pillars stood buried ~4 m
// in a trench. The gate needs a level pad, and the trail cut gentle banks rather than walls.
test('the Clover gate stands on a level pad and the trail cut has gentle banks', () => {
  for (const hill of [5.8, 7.5, 12]) {
    for (let r = 0; r <= 9; r += 1.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const x = CLOVER_GATE.x + Math.cos(a) * r, z = CLOVER_GATE.z + Math.sin(a) * r;
      assert.ok(Math.abs(cloverGround(x, z, hill) - 1.5) < 1e-6, `pad not level at ${x.toFixed(1)}, ${z.toFixed(1)} (hill ${hill})`);
    }
  }
  // Banks on the open trail, 6 m of hill above it: steepest slope under ~40 degrees (it was ~70).
  for (const z of [-120, -200, -280]) {
    let steepest = 0;
    for (let x = 0; x < 20; x += .05) steepest = Math.max(steepest, Math.abs(cloverGround(x + .05, z, 7.5) - cloverGround(x, z, 7.5)) / .05);
    assert.ok(steepest < .85, `bank too steep at z ${z}: ${steepest.toFixed(2)}`);
  }
  assert.equal(cloverGround(0, -200, 7.5), 1.5); // the walking line itself stays at grass level
  assert.equal(cloverGround(40, -200, 7.5), 7.5); // and the hills beyond the banks are untouched
});
