// Shared by heartCampaign.test.mjs: simulate one Tide Hook crossing with the real pendulum grapple.
// The player stands on the launch pad facing the target, holds Q with the stick toward the target,
// and lets go after `release` seconds. Returns where they ended up.
export function simulateSwing({ createGrapple, layout, swing, release, dt = 1 / 60 }) {
  const fromTop = swing.from === 'shore' ? 1.5 : layout.island(swing.from).top;
  const target = layout.island(swing.to);
  const player = { position: { x: swing.at.x, y: fromTop + 2.05, z: swing.at.z }, velocity: { x: 0, y: 0, z: 0 }, grounded: true, jumpBuffer: 0 };
  const solid = (x, y0, y1, z) => layout.islandSolid(x, y0, y1, z);
  const g = createGrapple({ anchors: [{ x: swing.x, y: swing.y, z: swing.z }], solid });
  const ground = (x, z) => layout.ownsArea({ x, z }) && Math.hypot(x - swing.at.x, z - swing.at.z) > 3 ? -100 : 1.5;
  const floorAt = (x, z, limit = Infinity) => {
    let y = swing.from === 'shore' ? ground(x, z) : -100;
    for (const i of layout.islands) if (i.top <= limit && i.top > y && i.surface.contains(x, z)) y = i.top;
    return y;
  };
  let t = 0;
  for (let k = 0; k < 600; k++, t += dt) {
    const dx = target.x - player.position.x, dz = target.z - player.position.z, d = Math.hypot(dx, dz) || 1;
    const stick = d > 1.5 ? { moveX: dx / d, moveZ: dz / d } : { moveX: 0, moveZ: 0 };
    const hold = t < release;
    const r = g.update(dt, { hold, jump: false, look: { x: dx / d, z: dz / d }, ...stick }, player, floorAt);
    if (g.phase === 'idle' && player.grounded && t > release) break;
    if (r.owns) continue;
    if (player.grounded && t < release) continue; // still on the pad while the line flies out
    const drive = g.drive;
    if (drive) { player.velocity.x = drive.velocity.x; player.velocity.z = drive.velocity.z; }
    const feetBefore = player.position.y - 2.05;
    player.velocity.y -= 25 * dt;
    for (const a of 'xyz') player.position[a] += player.velocity[a] * dt;
    const feet = player.position.y - 2.05, { x, z } = player.position;
    // Flying into an island's rock (the controller's colliders would stop you there) ends the attempt.
    if (solid(x, feet, feet + 2.05, z)) return { hit: 'rock', t };
    const floor = floorAt(x, z, feetBefore + 0.05);
    if (feet <= floor) { player.position.y = floor + 2.05; player.velocity.y = 0; player.grounded = true; }
    else player.grounded = false;
    if (feet < -20) return { fell: true, t };
  }
  const { x, z } = player.position, feet = player.position.y - 2.05;
  const on = layout.islands.find(i => i.surface.contains(x, z) && Math.abs(feet - i.top) < 0.1);
  return { landed: on?.id ?? null, t };
}

/** Release times (s) that carry the player onto the target island. */
export function workingReleases(args) {
  const ok = [];
  for (let release = 0.2; release <= 3; release += 0.05) {
    if (simulateSwing({ ...args, release }).landed === args.swing.to) ok.push(+release.toFixed(2));
  }
  return ok;
}
