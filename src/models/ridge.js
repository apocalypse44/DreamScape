export const RIDGE = Object.freeze({ x: 72, z: 48, radius: 32, base: 1.5, rise: 9.6 });
const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A broad spiral climbs gradually while the exposed banks form jump shortcuts.
export const RIDGE_PATH = Object.freeze(Array.from({ length: 81 }, (_, i) => {
  const t = i / 80, radius = 31 - t * 26, angle = Math.PI + t * Math.PI * 2;
  return Object.freeze({ x: RIDGE.x + Math.cos(angle) * radius,
    z: RIDGE.z + Math.sin(angle) * radius, y: RIDGE.base + t * RIDGE.rise });
}));

export function ridgeArea(x, z, margin = 0) {
  return Math.hypot(x - RIDGE.x, z - RIDGE.z) < 37 + margin;
}

export function ridgeTerrain(x, z, original) {
  const radius = Math.hypot(x - RIDGE.x, z - RIDGE.z);
  if (radius >= 37) return original;
  let height = RIDGE.base;
  for (const edge of [28, 23.5, 19, 14.5, 10, 5.5]) height += 1.6 * (1 - smooth(edge - 1.8, edge, radius));
  let best = Infinity, routeHeight = height;
  for (let i = 1; i < RIDGE_PATH.length; i++) {
    const a = RIDGE_PATH[i - 1], b = RIDGE_PATH[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const distance = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
    if (distance < best) { best = distance; routeHeight = a.y + (b.y - a.y) * t; }
  }
  height += (routeHeight - height) * (1 - smooth(2.5, 4.5, best));
  const blend = 1 - smooth(32, 37, radius);
  return original + (height - original) * blend;
}

export const RIDGE_MARKERS = Object.freeze([20, 50, 80].map(i => RIDGE_PATH[i]));
export function createRidgeExploration() {
  const found = new Set();
  return {
    found,
    update(player) {
      const newlyFound = [];
      RIDGE_MARKERS.forEach((p, i) => {
        if (!found.has(i) && Math.hypot(player.x - p.x, player.z - p.z) < 2.2 &&
            Math.abs(player.y - 2.05 - p.y) < 2) { found.add(i); newlyFound.push(i); }
      });
      return newlyFound;
    },
    reset() { found.clear(); }
  };
}
