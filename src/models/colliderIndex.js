// Broad phase for circular obstacles. Keep the original collider objects so
// doors, dissolving props, height callbacks and NPC motion stay live.
export function createColliderIndex(colliders, cellSize = 16) {
  const cells = new Map(), moving = [], seen = new Set();
  let count = -1;
  const key = (x, z) => `${x},${z}`;
  function rebuild() {
    cells.clear(); moving.length = 0;
    for (const c of colliders) {
      if (c.npc || c.dynamic) { moving.push(c); continue; }
      for (let x = Math.floor((c.x - c.radius) / cellSize); x <= Math.floor((c.x + c.radius) / cellSize); x++) {
        for (let z = Math.floor((c.z - c.radius) / cellSize); z <= Math.floor((c.z + c.radius) / cellSize); z++) {
          const k = key(x, z);
          if (!cells.has(k)) cells.set(k, []);
          cells.get(k).push(c);
        }
      }
    }
    count = colliders.length;
  }
  return {
    query(x, z, radius, out = []) {
      if (count !== colliders.length) rebuild();
      out.length = 0; seen.clear();
      for (let a = Math.floor((x - radius) / cellSize); a <= Math.floor((x + radius) / cellSize); a++) {
        for (let b = Math.floor((z - radius) / cellSize); b <= Math.floor((z + radius) / cellSize); b++) {
          for (const c of cells.get(key(a, b)) || []) {
            if (!seen.has(c)) { seen.add(c); out.push(c); }
          }
        }
      }
      for (const c of moving) {
        if (Math.abs(c.x - x) <= c.radius + radius && Math.abs(c.z - z) <= c.radius + radius) out.push(c);
      }
      return out;
    },
    invalidate() { count = -1; },
  };
}
