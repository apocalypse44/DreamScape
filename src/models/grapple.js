// Rope swing for the Tide Hook. Pure simulation on the player's eye position:
// hook an authored anchor, hang from it as a pendulum (the rope only pulls, so it
// goes slack above the anchor), steer with the stick, let go to fly on momentum.
// ponytail: anchors only, no surface hooking and no side collision while swinging; add sweeps if swings clip islands.
export const GRAPPLE = {
  range: 30, minDot: .5,      // reach (m) and how far off the camera's bearing an anchor may sit (cos)
  fire: .14,                  // seconds for the line to reach the anchor
  gravity: 25,                // matches the player controller
  reel: 2.4, minLength: 3.5,  // the line shortens while swinging so arcs clear the ground
  pump: 10,                   // stick acceleration while hanging (m/s²)
  tug: 13, airTug: 4,         // yank toward the anchor on attach: off the ground it lifts the body into the arc
  maxSpeed: 30,
  releaseUp: 4.5, jumpUp: 8.5, releaseBoost: 1.1,
  airDrag: .25, airControl: 7,
};

const flatDot = (ax, az, bx, bz) => { const a = Math.hypot(ax, az), b = Math.hypot(bx, bz); return a && b ? (ax * bx + az * bz) / (a * b) : 1; };

/** Best anchor ahead of the camera, above the eye, in range. look: camera forward {x,z}. */
export function pickAnchor(anchors, eye, look, { range = GRAPPLE.range, minDot = GRAPPLE.minDot, exclude = null } = {}) {
  let best = null, bestScore = Infinity;
  for (const a of anchors) {
    if (a === exclude) continue;
    const dx = a.x - eye.x, dy = a.y - eye.y, dz = a.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > range || d < 2 || dy < 1) continue;
    const dot = flatDot(dx, dz, look.x, look.z);
    if (dot < minDot) continue;
    const score = d / range + (1 - dot) * 3;
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export function createGrapple({ anchors = [], eyeHeight = 2.05 } = {}) {
  let phase = 'idle', anchor = null, target = null, length = 0, time = 0, held = false, flip = 0, carry = false;
  const vel = { x: 0, y: 0, z: 0 };
  function release(player, jump) {
    vel.x *= GRAPPLE.releaseBoost; vel.z *= GRAPPLE.releaseBoost;
    vel.y = Math.max(vel.y, 0) * GRAPPLE.releaseBoost + (jump ? GRAPPLE.jumpUp : GRAPPLE.releaseUp);
    player.velocity.x = vel.x; player.velocity.y = vel.y; player.velocity.z = vel.z;
    phase = 'fly'; flip = 0; anchor = null;
  }
  function land(player) { phase = 'idle'; anchor = null; player.grounded = true; player.velocity.y = 0; }
  return {
    get phase() { return phase; }, get anchor() { return anchor; }, get target() { return target; },
    /** 0..1 while the line travels out; 1 once attached. */
    get reach() { return phase === 'fire' ? Math.min(1, time / GRAPPLE.fire) : anchor ? 1 : 0; },
    /** Release somersault progress, 0..1 (renderer spins the body once). */
    get flip() { return flip; },
    /**
     * input: { hold, jump, moveX, moveZ, look:{x,z} } — hold is the grapple key state, jump a press this step.
     * floorAt(x, z, feetY): the surface under a point. Returns { owns } — true while the rope moves the body
     * (skip the player controller that step).
     */
    update(dt, input, player, floorAt) {
      const pressed = input.hold && !held; held = input.hold;
      target = phase === 'swing' || phase === 'fire' ? null : pickAnchor(anchors, player.position, input.look || { x: 0, z: -1 }, { exclude: anchor });
      if (phase === 'fly') {
        flip = Math.min(1, flip + dt * 1.8);
        if (player.grounded) phase = 'idle';
        else { // keep the momentum the controller would brake: drag, and a little air steering
          vel.x = player.velocity.x; vel.z = player.velocity.z;
          const drag = Math.exp(-GRAPPLE.airDrag * dt);
          vel.x = vel.x * drag + (input.moveX || 0) * GRAPPLE.airControl * dt;
          vel.z = vel.z * drag + (input.moveZ || 0) * GRAPPLE.airControl * dt;
        }
      }
      if (pressed && target && (phase === 'idle' || phase === 'fly')) { carry = phase === 'fly'; phase = 'fire'; anchor = target; target = null; time = 0; }
      if (phase === 'fire') {
        time += dt;
        if (!input.hold) { phase = player.grounded ? 'idle' : 'fly'; anchor = null; flip = 1; }
        else if (time >= GRAPPLE.fire) {
          phase = 'swing'; const p = player.position;
          length = Math.max(GRAPPLE.minLength, Math.hypot(p.x - anchor.x, p.y - anchor.y, p.z - anchor.z));
          const tug = (player.grounded ? GRAPPLE.tug : GRAPPLE.airTug) / length;
          vel.x = player.velocity.x + (anchor.x - p.x) * tug; vel.y = Math.max(0, player.velocity.y) + (anchor.y - p.y) * tug; vel.z = player.velocity.z + (anchor.z - p.z) * tug;
          length *= player.grounded ? .85 : 1; player.grounded = false;
        }
        return { owns: false };
      }
      if (phase !== 'swing') return { owns: false };
      if (!input.hold || input.jump) { release(player, input.jump); return { owns: true }; }
      const p = player.position;
      vel.y -= GRAPPLE.gravity * dt;
      vel.x += (input.moveX || 0) * GRAPPLE.pump * dt; vel.z += (input.moveZ || 0) * GRAPPLE.pump * dt;
      p.x += vel.x * dt; p.y += vel.y * dt; p.z += vel.z * dt;
      length = Math.max(GRAPPLE.minLength, length - GRAPPLE.reel * dt);
      const dx = p.x - anchor.x, dy = p.y - anchor.y, dz = p.z - anchor.z, d = Math.hypot(dx, dy, dz);
      if (d > length) { // taut: back onto the sphere, drop the outward speed
        const nx = dx / d, ny = dy / d, nz = dz / d;
        p.x = anchor.x + nx * length; p.y = anchor.y + ny * length; p.z = anchor.z + nz * length;
        const out = vel.x * nx + vel.y * ny + vel.z * nz;
        if (out > 0) { vel.x -= nx * out; vel.y -= ny * out; vel.z -= nz * out; }
      }
      const speed = Math.hypot(vel.x, vel.y, vel.z);
      if (speed > GRAPPLE.maxSpeed) { const s = GRAPPLE.maxSpeed / speed; vel.x *= s; vel.y *= s; vel.z *= s; }
      player.velocity.x = vel.x; player.velocity.y = vel.y; player.velocity.z = vel.z;
      const floor = floorAt(p.x, p.z, p.y - eyeHeight + .6) + eyeHeight;
      if (p.y < floor) { p.y = floor; land(player); }
      return { owns: true };
    },
    /** Horizontal momentum after letting go; the controller applies gravity and collision. */
    get drive() { return phase === 'fly' || (phase === 'fire' && carry) ? { velocity: { x: vel.x, z: vel.z }, blockJump: true } : null; },
    reset() { phase = 'idle'; anchor = target = null; held = false; flip = 0; vel.x = vel.y = vel.z = 0; },
  };
}
