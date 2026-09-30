export function createPlayerController({ state, keys, player, chunks, terrainHeight }) {
  function collidesAt(x, z) {
    const playerRadius = 0.55;
    for (const chunk of chunks.values()) {
      for (const collider of chunk.userData.colliders) {
        const radius = playerRadius + collider.radius;
        const dx = x - collider.x;
        const dz = z - collider.z;
        if (dx*dx + dz*dz < radius*radius) return true;
      }
    }
    return false;
  }

  function updatePlayer(dt) {
    const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const side = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const moving = state.locked && Boolean(forward || side);
    const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
    if (moving) {
      const length = Math.hypot(forward, side);
      const f = forward / length;
      const s = side / length;
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      const dx = -sin * f + cos * s;
      const dz = -cos * f - sin * s;
      const speed = sprint ? 18 : 9;
      const response = 1 - Math.exp(-12 * dt);
      player.velocity.x += (dx * speed - player.velocity.x) * response;
      player.velocity.z += (dz * speed - player.velocity.z) * response;
      const angle = Math.atan2(dz, dx);
      const turn = Math.abs(Math.atan2(Math.sin(angle - state.lastMoveAngle), Math.cos(angle - state.lastMoveAngle)));
      state.chaos += turn * 0.014;
      state.lastMoveAngle = angle;
      state.hintTimer += dt;
    }
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    const targetChaos = moving ? (sprint ? 0.88 : 0.28) : 0.03;
    state.chaos += (targetChaos - state.chaos) * dt * (moving ? 0.32 : 0.16);
    state.chaos = THREE.MathUtils.clamp(state.chaos, 0.025, 0.98);
    if (!moving) {
      player.velocity.x = 0;
      player.velocity.z = 0;
    }
    const maxSpeed = sprint ? 18 : 9;
    if (horizontalSpeed > maxSpeed) {
      const scale = maxSpeed / horizontalSpeed;
      player.velocity.x *= scale;
      player.velocity.z *= scale;
    }
    player.velocity.y -= 25 * dt;
    const nextX = player.position.x + player.velocity.x * dt;
    if (!collidesAt(nextX, player.position.z)) player.position.x = nextX;
    else player.velocity.x = 0;
    const nextZ = player.position.z + player.velocity.z * dt;
    if (!collidesAt(player.position.x, nextZ)) player.position.z = nextZ;
    else player.velocity.z = 0;
    player.position.y += player.velocity.y * dt;
    // Terrain may rise under a standing player; snapping up keeps them on the surface.
    const ground = terrainHeight(player.position.x, player.position.z) + 2.05;
    if (player.position.y <= ground) {
      player.position.y = ground;
      player.velocity.y = Math.max(0, player.velocity.y);
      player.grounded = true;
    } else {
      player.grounded = false;
    }
  }
  return { update: updatePlayer };
}
