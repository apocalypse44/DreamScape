// Melee state machine for the traveller. Pure simulation: it decides which combat
// clip plays and at what clip time, how the body is driven, and when a swing can
// hit. Rendering samples the same clip time, so hit frames match what is drawn.
// Hit windows come from measured sword-tip speed in each clip (seconds, clip time).
export const COMBAT_MOVES = {
  slash1: { duration: .43, speed: 1.15, hit: [.16, .32], reach: 2.1, arc: 1.9, next: 'slash2', end: 'slash1End', chainAt: .4, rootMotion: true, trail: true },
  slash2: { duration: .53, speed: 1.15, hit: [.16, .34], reach: 2.1, arc: 1.9, next: 'slash3', end: 'slash2End', chainAt: .48, rootMotion: true, trail: true },
  slash3: { duration: 2.0, speed: 1.2, hit: [.44, .72], reach: 2.5, arc: 2.6, heavy: true, cancelAt: .95, rootMotion: true, trail: true },
  slash1End: { duration: .97, speed: 1.3, cancelAt: .14, next: 'slash2', chainUntil: .55, rootMotion: true },
  slash2End: { duration: 1.03, speed: 1.3, cancelAt: .14, next: 'slash3', chainUntil: .55, rootMotion: true },
  dash: { duration: 1.57, speed: 1.15, hit: [.26, .46], reach: 2.4, arc: 2.2, heavy: true, cancelAt: .82, rootMotion: true, trail: true },
  roll: { duration: 1.47, speed: 1.65, cancelAt: 1.12, invulnerable: [.04, .62], distance: 3.6 },
  block: { duration: 1.23, speed: 1, hold: .3, release: .55 },
  hit: { duration: .33, speed: 1 },
  knockback: { duration: .83, speed: 1, rootMotion: true, motionScale: .55 },
  // Air slashes (jumping or swinging on the Tide Hook): the ground slash clips played faster, with their hit
  // window and trail, but no drive, so gravity and the grapple keep moving the body (as in Swordigo).
  airSlash: { clip: 'slash1', duration: .43, speed: 1.6, hit: [.12, .32], reach: 2.4, arc: 2.2, next: 'airSlash2', chainAt: .26, trail: true, air: true },
  airSlash2: { clip: 'slash2', duration: .53, speed: 1.6, hit: [.14, .36], reach: 2.4, arc: 2.2, next: 'airSlash', chainAt: .34, trail: true, air: true },
};
const ATTACKS = new Set(['slash1', 'slash2', 'slash3', 'dash', 'airSlash', 'airSlash2']);
const BUFFER = .32;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createTravelerCombat({ rootMotion = {}, scale = 1, sheatheAfter = 7 } = {}) {
  let move = null, time = 0, facing = 0, attackBuffer = 0, dodgeBuffer = 0, swing = 0, drawn = false, idle = 0, releasing = false, dodgeDir = null;
  // Forward root velocity (m/s, model space) at a clip time, from the baked curve.
  function rootSpeed(name, t) {
    const curve = rootMotion[name]; if (!curve) return 0;
    const i = Math.min(curve.z.length - 2, Math.max(0, Math.floor(t * curve.rate)));
    return (curve.z[i + 1] - curve.z[i]) * curve.rate * scale;
  }
  function start(name, ctx, input) {
    move = name; time = 0; releasing = false; drawn = true; idle = 0;
    if (ATTACKS.has(name)) {
      swing++;
      // Steer toward input, else the camera; then softly lock onto the best target ahead.
      let aim = input.moveX || input.moveZ ? Math.atan2(input.moveX || 0, input.moveZ || 0) : (ctx.yaw ?? facing) + Math.PI;
      let best = null, bestScore = Infinity;
      for (const target of ctx.targets || []) {
        const dx = target.x - ctx.position.x, dz = target.z - ctx.position.z, distance = Math.hypot(dx, dz);
        const off = Math.abs(angleDiff(Math.atan2(dx, dz), aim));
        if (distance > 4.5 || off > 1.3) continue;
        const score = distance + off * 2; if (score < bestScore) { bestScore = score; best = Math.atan2(dx, dz); }
      }
      facing = best ?? aim;
    }
    if (name === 'roll') {
      const aim = input.moveX || input.moveZ ? Math.atan2(input.moveX || 0, input.moveZ || 0) : facing;
      facing = aim; dodgeDir = { x: Math.sin(aim), z: Math.cos(aim) };
    }
  }
  function finish() { move = null; time = 0; releasing = false; }
  return {
    get move() { return move; }, get drawn() { return drawn; }, get facing() { return facing; },
    /**
     * input: { attack, dodge, block, sheathe, moveX, moveZ, sprinting } — attack/dodge/sheathe are presses this step.
     * ctx: { grounded, speed, yaw, heading, position:{x,z}, targets:[{x,z}] }
     */
    update(dt, input = {}, ctx = {}) {
      dt = Math.max(0, Math.min(.1, dt || 0));
      const position = ctx.position || { x: 0, z: 0 }; ctx = { ...ctx, position };
      if (input.attack) attackBuffer = BUFFER;
      if (input.dodge) dodgeBuffer = .22;
      if (input.sheathe && !move) { drawn = !drawn; idle = 0; }
      const moving = Boolean(input.moveX || input.moveZ);
      if (!move) facing = ctx.heading ?? facing;
      const spec = move && COMBAT_MOVES[move];
      if (spec) {
        time += dt * spec.speed * (move === 'block' && releasing ? 2 : 1);
        if (move === 'block') {
          if (input.block && !releasing) time = Math.min(time, spec.hold);
          else if (!releasing) { releasing = true; time = Math.max(time, spec.release); }
        }
        const done = time >= spec.duration;
        const cancel = spec.cancelAt != null && time >= spec.cancelAt;
        if (ATTACKS.has(move) && spec.next && attackBuffer > 0 && time >= spec.chainAt && !(spec.air && ctx.grounded)) start(spec.next, ctx, input), attackBuffer = 0;
        else if (spec.next && !ATTACKS.has(move) && attackBuffer > 0 && time <= spec.chainUntil && ctx.grounded) start(spec.next, ctx, input), attackBuffer = 0;
        else if (dodgeBuffer > 0 && ctx.grounded && (cancel || (ATTACKS.has(move) && time > (spec.hit?.[1] ?? 0)) || move === 'block')) start('roll', ctx, input), dodgeBuffer = 0;
        else if (move === 'roll' && cancel && attackBuffer > 0) start('slash1', ctx, input), attackBuffer = 0;
        else if (done && ATTACKS.has(move) && spec.end) start(spec.end, ctx, input);
        else if (done || (cancel && moving)) finish();
        else if (spec.air && ctx.grounded && time > spec.hit[1]) finish(); // landed: back to the ground moveset
        else if (!ctx.grounded && !spec.air && move !== 'roll' && move !== 'knockback') finish();
      }
      if (!move && !ctx.grounded && attackBuffer > 0) start('airSlash', ctx, input), attackBuffer = 0;
      else if (!move && ctx.grounded) {
        if (dodgeBuffer > 0) start('roll', ctx, input), dodgeBuffer = 0;
        else if (attackBuffer > 0) start(input.sprinting && (ctx.speed || 0) > 5 ? 'dash' : 'slash1', ctx, input), attackBuffer = 0;
        else if (input.block) start('block', ctx, input);
      }
      attackBuffer = Math.max(0, attackBuffer - dt); dodgeBuffer = Math.max(0, dodgeBuffer - dt);
      if (!move && drawn) { idle += dt; if (idle > sheatheAfter && !moving) drawn = false; }
      return this.snapshot();
    },
    snapshot() {
      const spec = move && COMBAT_MOVES[move];
      let velocity = null, moveScale = 1;
      if (spec && !spec.air) {
        moveScale = 0;
        const dir = { x: Math.sin(facing), z: Math.cos(facing) };
        if (move === 'roll') {
          const t = Math.min(1, time / spec.duration), v = 2 * spec.distance / (spec.duration / spec.speed) * Math.max(0, 1 - t);
          velocity = { x: dodgeDir.x * v, z: dodgeDir.z * v };
        } else if (spec.rootMotion) {
          const v = rootSpeed(move === 'knockback' ? 'knockback' : move, time) * (spec.motionScale ?? 1) * spec.speed;
          velocity = { x: dir.x * v, z: dir.z * v };
        } else velocity = { x: 0, z: 0 };
      }
      const active = spec?.hit && time >= spec.hit[0] && time <= spec.hit[1];
      return {
        move, clip: spec?.clip ?? move, time: spec ? Math.min(time, spec.duration - 1e-3) : 0, facing, drawn, air: Boolean(spec?.air),
        drive: spec && !spec.air ? { velocity, moveScale, blockJump: true } : null,
        hit: active ? { id: swing, reach: spec.reach, arc: spec.arc, heavy: Boolean(spec.heavy), facing } : null,
        trail: Boolean(spec?.trail && spec.hit && time >= spec.hit[0] - .08 && time <= spec.hit[1] + .06),
        blocking: move === 'block' && !releasing && time >= .1,
        invulnerable: Boolean(spec?.invulnerable && time >= spec.invulnerable[0] && time <= spec.invulnerable[1]),
      };
    },
    /** A blow from direction `from` (attacker position). Returns blocked, dodged or hit. */
    hurt(from, position, { heavy = false } = {}) {
      const snap = this.snapshot();
      if (snap.invulnerable) return 'dodged';
      const toward = Math.atan2(from.x - position.x, from.z - position.z);
      if (snap.blocking && Math.abs(angleDiff(toward, facing)) < 1.6) return 'blocked';
      facing = toward; start(heavy ? 'knockback' : 'hit', {}, {});
      return 'hit';
    },
    reset() { finish(); attackBuffer = dodgeBuffer = idle = 0; drawn = false; swing = 0; },
  };
}
