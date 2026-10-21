import { MOVEMENT } from './movementConfig.js';

// Checkpoints belong to bare, locally walkable terrain, never floating slabs.
// Store x/z, then re-query height on recovery because chaos can reshape the land.
export function createRecovery({ player, terrainHeight, collidesAt, isUnsafe = () => false, allowFallRecovery = () => true }) {
  let spawn = null;
  let checkpoint = null;
  let stableTime = 0;
  let airTime = 0;
  let fallStart = 0;

  function safeAt(x, z) {
    const height = terrainHeight(x, z);
    if (!Number.isFinite(height) || isUnsafe(x, z) || collidesAt(x, z)) return false;
    const r = MOVEMENT.checkpointRadius;
    return [[r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dz]) => {
      const other = terrainHeight(x + dx, z + dz);
      return Number.isFinite(other) && !isUnsafe(x + dx, z + dz) &&
        Math.abs(other - height) <= MOVEMENT.stepHeight;
    });
  }

  function respawn() {
    const target = checkpoint && safeAt(checkpoint.x, checkpoint.z) ? checkpoint : spawn;
    if (!target) return false;
    player.position.set(target.x, terrainHeight(target.x, target.z) + MOVEMENT.eyeHeight, target.z);
    player.velocity.set(0, 0, 0);
    player.grounded = true;
    player.coyote = player.jumpBuffer = 0;
    stableTime = airTime = 0;
    fallStart = player.position.y - MOVEMENT.eyeHeight;
    return true;
  }

  return {
    reset() {
      spawn = { x: player.position.x, z: player.position.z };
      checkpoint = { ...spawn };
      stableTime = airTime = 0;
      fallStart = player.position.y - MOVEMENT.eyeHeight;
    },
    // Call before ground snapping: a trench floor must not hide a lethal fall.
    shouldRespawn(dt) {
      const feet = player.position.y - MOVEMENT.eyeHeight;
      if (player.grounded) { airTime = 0; fallStart = feet; }
      else { airTime += dt; fallStart = Math.max(fallStart, feet); }
      return !Number.isFinite(feet) || isUnsafe(player.position.x, player.position.z) ||
        (allowFallRecovery(player) && player.velocity.y < 0 && (fallStart - feet > MOVEMENT.maxFallDistance || airTime > MOVEMENT.maxAirTime));
    },
    updateCheckpoint(dt, onTerrain) {
      const { x, z } = player.position;
      if (!player.grounded || !onTerrain || !safeAt(x, z)) { stableTime = 0; return; }
      stableTime += dt;
      if (stableTime >= MOVEMENT.checkpointSeconds) {
        checkpoint = { x, z };
        stableTime = 0;
      }
    },
    respawn
  };
}
