import assert from 'node:assert/strict';
import { test } from 'node:test';
const { createGrapple, pickAnchor, GRAPPLE } = await import(new URL('../src/models/grapple.js', import.meta.url));

const look = { x: 0, z: -1 };
function rig(anchors = [{ x: 0, y: 12, z: -7 }], floor = () => 0) {
  const g = createGrapple({ anchors });
  const player = { position: { x: 0, y: 2.05, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, grounded: true };
  // Stand-in controller: gravity plus the grapple's horizontal drive once released.
  const step = input => {
    const r = g.update(1 / 60, { look, ...input }, player, floor);
    if (r.owns) return;
    const d = g.drive; if (d) { player.velocity.x = d.velocity.x; player.velocity.z = d.velocity.z; }
    if (player.grounded && g.phase !== 'fly') return;
    player.velocity.y -= 25 / 60;
    for (const k of 'xyz') player.position[k] += player.velocity[k] / 60;
    if (player.position.y < floor() + 2.05) { player.position.y = floor() + 2.05; player.grounded = true; player.velocity.y = 0; } else player.grounded = false;
  };
  return { g, player, step };
}

test('anchors are picked only in range, above the eye and ahead of the camera', () => {
  const eye = { x: 0, y: 2, z: 0 }, ahead = { x: 0, y: 10, z: -8 };
  assert.equal(pickAnchor([ahead], eye, look), ahead);
  assert.equal(pickAnchor([{ x: 0, y: 10, z: 8 }], eye, look), null, 'behind');
  assert.equal(pickAnchor([{ x: 0, y: 2.5, z: -8 }], eye, look), null, 'not above');
  assert.equal(pickAnchor([{ x: 0, y: 10, z: -GRAPPLE.range - 5 }], eye, look), null, 'out of range');
  const far = { x: 0, y: 10, z: -20 }, aside = { x: 9, y: 10, z: -9 };
  assert.equal(pickAnchor([far, ahead, aside], eye, look), ahead, 'nearest on-bearing wins');
});

test('holding Q fires the line, then the body swings as a pendulum that never stretches the rope', () => {
  const { g, player, step } = rig();
  step({ hold: true }); assert.equal(g.phase, 'fire'); assert.ok(g.reach < 1);
  let longest = 0, attachedLength = null;
  for (let i = 0; i < 50; i++) {
    step({ hold: true, moveZ: -1 });
    if (g.phase !== 'swing') continue;
    const p = player.position, d = Math.hypot(p.x, p.y - 12, p.z + 7);
    attachedLength ??= d; longest = Math.max(longest, d);
  }
  assert.equal(g.phase, 'swing'); assert.equal(g.reach, 1);
  assert.ok(longest <= attachedLength + 1e-6, 'rope only shortens');
  assert.ok(player.position.z < -3, 'swung forward');
  assert.ok(player.position.y > 2.05, 'the attach tug lifted the body off the ground');
});

test('letting go keeps the momentum and flies far, with a somersault; Space lets go higher', () => {
  const fly = jump => {
    const { g, player, step } = rig(undefined, () => -20);
    for (let i = 0; i < 42; i++) step({ hold: true, moveZ: -1 }); // 0.7 s: the zip has lifted you, the arc is still carrying you forward
    step({ hold: jump, jump }); assert.equal(g.phase, 'fly');
    const vy = player.velocity.y;
    for (let i = 0; i < 40; i++) step({});
    const flip = g.flip;
    for (let i = 0; i < 400 && !(player.velocity.y < 0 && player.position.y < 2.05); i++) step({}); // until back at start height
    return { vy, z: player.position.z, flip };
  };
  const plain = fly(false), high = fly(true);
  assert.ok(plain.z < -15, `flew ${plain.z}`); assert.equal(plain.flip, 1);
  assert.ok(high.vy > plain.vy + 3);
});

test('a swing that meets the ground lands, and reset clears everything', () => {
  const { g, player, step } = rig([{ x: 0, y: 4.5, z: -4 }]);
  for (let i = 0; i < 120 && g.phase !== 'idle' || i < 12; i++) step({ hold: true });
  assert.equal(g.phase, 'idle'); assert.equal(player.grounded, true); assert.ok(player.position.y >= 2.05 - 1e-9);
  step({ hold: true }); g.reset(); assert.equal(g.phase, 'idle'); assert.equal(g.anchor, null); assert.equal(g.drive, null);
});

test('releasing before the line lands cancels the hook; re-firing mid-air keeps momentum', () => {
  const { g, player, step } = rig([{ x: 0, y: 12, z: -7 }, { x: 0, y: 14, z: -24 }], () => -30);
  step({ hold: true }); step({ hold: false }); assert.equal(g.phase, 'idle'); assert.equal(g.anchor, null);
  for (let i = 0; i < 60; i++) step({ hold: true, moveZ: -1 });
  step({ hold: false }); const speed = Math.hypot(player.velocity.x, player.velocity.z);
  step({}); step({ hold: true }); assert.equal(g.phase, 'fire'); assert.equal(g.anchor.z, -24, 'the next anchor, not the one just left');
  assert.ok(Math.abs(g.drive.velocity.z) > speed * .9);
});

test('while hanging from the rope the player counts as airborne, from the attach step on', () => {
  const { g, player, step } = rig();
  let attached = false;
  for (let i = 0; i < 40; i++) { step({ hold: true, moveZ: -1 }); if (g.phase === 'swing') { attached = true; assert.equal(player.grounded, false, `step ${i}`); } }
  assert.ok(attached);
});
