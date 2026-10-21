// Keep the wolf's long muzzle outside the player's body, including when it faces them.
export const HOUND_CLEARANCE = 3.8;
export function companionScenePosition(position, player, groundAt, blocked = () => false) {
  if (Math.hypot(position.x - player.x, position.z - player.z) >= HOUND_CLEARANCE) return { ...position };
  const angle = Math.atan2(position.x - player.x, position.z - player.z);
  const base = groundAt(position.x, position.z);
  for (const radius of [HOUND_CLEARANCE, HOUND_CLEARANCE + .8]) {
    for (const offset of [0, .5, -.5, 1, -1, 1.5, -1.5, Math.PI]) {
      const x = player.x + Math.sin(angle + offset) * radius;
      const z = player.z + Math.cos(angle + offset) * radius;
      const y = groundAt(x, z);
      if (Math.abs(y - base) > 1.2 || blocked(x, z)) continue;
      // Do not push the companion through a wall or across a drop to stage the shot.
      let safe = true;
      for (let i = 1; i <= 8; i++) {
        const px = position.x + (x - position.x) * i / 8, pz = position.z + (z - position.z) * i / 8;
        if (Math.abs(groundAt(px, pz) - base) > 1.2 || blocked(px, pz)) { safe = false; break; }
      }
      if (safe) return { x, y, z };
    }
  }
  return null;
}
