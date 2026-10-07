import { SLAB_SIZE } from '../models/quest.js';
import { MOVEMENT } from '../models/movementConfig.js';
import { createRecovery } from '../models/recovery.js';

export function createPlayerController({ state, keys, player, chunks, terrainHeight, staticColliders, platforms, isUnsafe, courseRecovery, isMovementBlocked = () => false, colliderFilter = () => true }) {
  function collidesAt(x, z) {
    const playerRadius = 0.55;
    for (const colliders of [staticColliders, ...Array.from(chunks.values(), chunk => chunk.userData.colliders)]) {
      for (const collider of colliders) {
        if (!colliderFilter(collider)) continue;
        const feet = player.position.y - MOVEMENT.eyeHeight;
        if (collider.minY !== undefined && feet + MOVEMENT.eyeHeight < collider.minY) continue;
        if (collider.maxY !== undefined && feet > collider.maxY) continue;
        const radius = playerRadius + collider.radius;
        const dx = x - collider.x;
        const dz = z - collider.z;
        if (dx*dx + dz*dz < radius*radius) return true;
      }
    }
    return false;
  }

  const recovery = createRecovery({ player, terrainHeight, collidesAt, isUnsafe });
  const topAt = (p, x, z) => p.topAt ? p.topAt(x, z) : p.top;
  const contains = (p, x, z, pad) => p.contains ? p.contains(x, z, pad) :
    Math.abs(x - p.x) < (p.width ?? SLAB_SIZE) / 2 + pad && Math.abs(z - p.z) < (p.depth ?? SLAB_SIZE) / 2 + pad;

  function canMoveTo(x, z, feet) {
    return !collidesAt(x, z) && terrainHeight(x, z) - feet <= MOVEMENT.stepHeight &&
      !platforms.some(p => p.solid && feet + MOVEMENT.stepHeight < topAt(p, x, z) - 0.01 &&
        feet + MOVEMENT.stepHeight + MOVEMENT.eyeHeight > p.bottom &&
        contains(p, x, z, 0.55));
  }

  function updatePlayer(dt) {
    const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const side = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const blocked = isMovementBlocked();
    const moving = state.locked && !blocked && Boolean(forward || side);
    if (blocked) player.jumpBuffer = 0;
    state.crouching = state.locked && keys.has("KeyC");
    const sprint = !state.crouching && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
    const walkSpeed = state.crouching ? 4.5 : 9;
    if (moving) {
      const length = Math.hypot(forward, side);
      const f = forward / length;
      const s = side / length;
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      const dx = -sin * f + cos * s;
      const dz = -cos * f - sin * s;
      const speed = sprint ? 18 : walkSpeed;
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
    const targetChaos = moving ? (sprint ? 0.88 : state.crouching ? 0.12 : 0.28) : 0.03; // sneaking keeps the world calm
    state.chaos += (targetChaos - state.chaos) * dt * (moving ? 0.32 : 0.16);
    state.chaos = THREE.MathUtils.clamp(state.chaos, 0.025, 0.98);
    if (!moving) {
      player.velocity.x = 0;
      player.velocity.z = 0;
    }
    const maxSpeed = sprint ? 18 : walkSpeed;
    if (horizontalSpeed > maxSpeed) {
      const scale = maxSpeed / horizontalSpeed;
      player.velocity.x *= scale;
      player.velocity.z *= scale;
    }
    // Apply a buffered takeoff before checking a ledge; a valid jump must be
    // allowed to gain height instead of being cancelled by the walking limit.
    player.jumpBuffer = Math.max(0, (player.jumpBuffer ?? 0) - dt);
    let jumped = false;
    function tryJump() {
      if (player.jumpBuffer <= 0 || player.coyote <= 0) return;
      player.velocity.y = 10.5;
      player.grounded = false;
      player.coyote = player.jumpBuffer = 0;
      state.chaos += 0.08;
      jumped = true;
    }
    tryJump();
    const wasGrounded = player.grounded;
    const prevFeet = player.position.y - MOVEMENT.eyeHeight;
    player.velocity.y -= 25 * dt;
    const nextFeet = prevFeet + player.velocity.y * dt;
    // Airborne players need their feet above a ledge, not a free walking step.
    const moveFeet = wasGrounded ? prevFeet : Math.max(prevFeet, nextFeet) - MOVEMENT.stepHeight;
    const nextX = player.position.x + player.velocity.x * dt;
    if (canMoveTo(nextX, player.position.z, moveFeet)) player.position.x = nextX;
    else player.velocity.x = 0;
    const nextZ = player.position.z + player.velocity.z * dt;
    if (canMoveTo(player.position.x, nextZ, moveFeet)) player.position.z = nextZ;
    else player.velocity.z = 0;
    player.position.y += player.velocity.y * dt;
    // Solid course rocks also stop upward movement into their underside.
    if (player.velocity.y > 0) for (const p of platforms) {
      if (!p.solid || !contains(p, player.position.x, player.position.z, 0.3)) continue;
      if (prevFeet + MOVEMENT.eyeHeight <= p.bottom && player.position.y >= p.bottom) {
        player.position.y = p.bottom;
        player.velocity.y = 0;
      }
    }
    const courseTarget = courseRecovery?.(player);
    if (courseTarget) {
      player.position.set(courseTarget.x, (courseTarget.top ?? terrainHeight(courseTarget.x, courseTarget.z)) + MOVEMENT.eyeHeight, courseTarget.z);
      player.velocity.set(0, 0, 0);
      player.grounded = true;
      player.coyote = player.jumpBuffer = 0;
      recovery.reset();
      return;
    }
    // Use the preceding support state until landing is resolved. A player
    // standing on a floating slab is supported even far above bare terrain.
    if (recovery.shouldRespawn(dt)) {
      recovery.respawn();
      return;
    }
    // Terrain may rise under a standing player; snapping up keeps them on the surface.
    const terrainGround = terrainHeight(player.position.x, player.position.z) + MOVEMENT.eyeHeight;
    let ground = terrainGround;
    // ponytail: slabs are one-way (land from above only, no side/head collision); add box sweeps if pass-through looks wrong.
    if (player.velocity.y <= 0) for (const slab of platforms) {
      const top = topAt(slab, player.position.x, player.position.z);
      const canStep = slab.ramp && wasGrounded && top - prevFeet <= MOVEMENT.stepHeight;
      if ((prevFeet >= top - 0.05 || canStep) && contains(slab, player.position.x, player.position.z, 0.3) && nextFeet <= top) ground = Math.max(ground, top + MOVEMENT.eyeHeight);
    }
    // Stick to downhill slopes instead of floating off them for a few frames.
    const snap = wasGrounded && player.velocity.y <= 0 && player.position.y - ground < MOVEMENT.stepHeight;
    if (player.position.y <= ground || snap) {
      player.position.y = ground;
      player.velocity.y = Math.max(0, player.velocity.y);
      player.grounded = true;
      player.coyote = 0.12;
    } else {
      player.grounded = false;
      player.coyote = Math.max(0, (player.coyote ?? 0) - dt);
    }
    // A press shortly before landing, or shortly after leaving a ledge, still jumps.
    if (!jumped) tryJump(); // buffered press just before landing
    recovery.updateCheckpoint(dt, Math.abs(player.position.y - terrainGround) < 0.05);
  }
  return {
    update: updatePlayer,
    teleport(target) {
      player.position.set(target.x, target.top + MOVEMENT.eyeHeight, target.z);
      state.yaw = target.yaw ?? state.yaw;
      state.pitch = 0;
      this.reset();
    },
    reset() {
      player.inFlight = false;
      player.velocity.set(0, 0, 0);
      player.grounded = true;
      player.coyote = 0.12;
      player.jumpBuffer = 0;
      recovery.reset();
    }
  };
}
