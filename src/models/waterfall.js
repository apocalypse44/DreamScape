// Fixed Grimoire landmark: ahead and to the left, clear of the right-hand HUD.
export const WATERFALL = Object.freeze({ x: -18, z: -32, base: 1.5, height: 11.3, poolRadius: 6 });

// Four comfortable 1.7 m rises and a wider lookout, on the east side of the cliff.
export const WATERFALL_CLIMB = Object.freeze(Array.from({ length: 5 }, (_, i) => Object.freeze({
  x: WATERFALL.x + 11.8, z: WATERFALL.z + 6 - i * 3,
  top: WATERFALL.base + (i + 1) * 1.7, bottom: WATERFALL.base - 0.25,
  width: i === 4 ? 3.4 : 2.4, depth: i === 4 ? 3.4 : 2.4, solid: true
})));
export const WATERFALL_CHECKPOINT = Object.freeze({ x: WATERFALL.x + 11.8, z: WATERFALL.z + 9 });

export function createWaterfallCourseRecovery() {
  let courseTop = null;
  return {
    reset() { courseTop = null; },
    update(player) {
      const feet = player.position.y - 2.05;
      const support = WATERFALL_CLIMB.find(p => Math.abs(feet - p.top) < 0.12 &&
        Math.abs(player.position.x - p.x) < p.width / 2 + 0.3 &&
        Math.abs(player.position.z - p.z) < p.depth / 2 + 0.3);
      if (player.grounded && support) courseTop = support.top;
      if (courseTop !== null && player.velocity.y < 0 && feet < courseTop - 2.7) {
        courseTop = null;
        return WATERFALL_CHECKPOINT;
      }
      if (player.grounded && !support) courseTop = null;
      return null;
    }
  };
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function waterfallArea(x, z, margin = 0) {
  const dx = x - WATERFALL.x, dz = z - WATERFALL.z;
  return Math.hypot(dx, dz) < 11 + margin ||
    (Math.abs(dx - 11.8) < 3 + margin && dz > -9 - margin && dz < 10 + margin) ||
    (Math.abs(dx) < 12 + margin && dz > -13 - margin && dz < -3 + margin);
}

// A shallow, walkable basin and level cliff footing. Both height queries and
// chunk vertices use this same operation. The protected Crossing is untouched.
export function waterfallTerrain(x, z, original) {
  const dx = x - WATERFALL.x, dz = z - WATERFALL.z;
  const distance = Math.hypot(dx, dz);
  const poolWeight = 1 - smooth(7, 11, distance);
  const cliffWeight = (1 - smooth(9, 12, Math.abs(dx))) *
    smooth(-14, -11, dz) * (1 - smooth(-4, -1, dz));
  const courseWeight = (1 - smooth(2, 4, Math.abs(dx - 11.8))) *
    smooth(-10, -8, dz) * (1 - smooth(9, 11, dz));
  const weight = Math.max(poolWeight, cliffWeight, courseWeight) * smooth(25, 26, Math.hypot(x, z));
  if (weight === 0) return original;
  const basin = 0.45 * (1 - smooth(4, WATERFALL.poolRadius, distance));
  const target = WATERFALL.base - basin;
  return original + (target - original) * weight;
}
