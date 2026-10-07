export const CLOVER_ENTRANCE = Object.freeze({ x: 0, z: -336 });
export const CLOVER_SUMMIT_CHECKPOINT = Object.freeze({ x: 2, z: -534, top: 24 });
function landform(p) {
  const w = p.width / 2, d = p.depth / 2;
  const outline = [[-w * 0.65, -d], [w * 0.55, -d], [w, -d * 0.5], [w * 0.9, d * 0.65],
    [w * 0.5, d], [-w * 0.7, d], [-w, d * 0.45], [-w * 0.92, -d * 0.55]];
  return { ...p, outline, contains(x, z, pad = 0) {
    x -= p.x; z -= p.z;
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[j], b = outline[i];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      if (pad > 0 && Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < pad) return true;
    }
    return inside;
  } };
}
export const CLOVER_PLATEAUS = Object.freeze([
  { x: 0, z: -370, width: 24, depth: 20, top: 6, bottom: -7, solid: true },
  { x: 0, z: -403, width: 26, depth: 20, top: 9, bottom: -7, solid: true },
  { x: 0, z: -437, width: 28, depth: 22, top: 12, bottom: -7, solid: true }
].map(landform));
function ramp(south, north, low, high, width, x = 0) {
  return { x, z: (south + north) / 2, width, depth: south - north, bottom: -7, solid: true,
    top: high, ramp: true,
    topAt: (x, z) => low + (high - low) * Math.max(0, Math.min(1, (south - z) / (south - north))) };
}
export const CLOVER_RAMPS = Object.freeze([
  ramp(-336, -360, 1.5, 6, 6), ramp(-380, -393, 6, 9, 5), ramp(-413, -426, 9, 12, 5),
  ramp(-444, -467, 12, 15, 5, -18), ramp(-479, -490, 15, 18, 5, -18),
  ramp(-502, -513, 18, 21, 5, -18), ramp(-525, -540, 21, 24, 5, -18)
]);
export const CLOVER_VALLEY = [
  { x: -10, z: -444, width: 20, depth: 5, top: 12 },
  { x: -18, z: -473, width: 12, depth: 12, top: 15 },
  { x: -18, z: -496, width: 12, depth: 12, top: 18 },
  { x: -18, z: -519, width: 12, depth: 12, top: 21 },
  { x: -6, z: -541, width: 32, depth: 3, top: 24 },
  landform({ x: 2, z: -510, width: 28, depth: 64, top: 24 }),
  { x: 13, z: -455, width: 22, depth: 5, top: 12 },
  landform({ x: 27, z: -458, width: 12, depth: 14, top: 12 }),
  { x: 17, z: -440, width: 5, depth: 30, top: 12 },
  { x: 12, z: -437, width: 10, depth: 4, top: 12 },
  { x: 17, z: -528, width: 16, depth: 4, top: 24 },
  { x: 21, z: -510, width: 4, depth: 40, top: 24 },
  { x: 24, z: -505, width: 10, depth: 10, top: 24 },
  { x: 17, z: -492, width: 16, depth: 4, top: 24 }
].map(p => ({ ...p, bottom: -7, solid: true }));
export const CLOVER_ASCENT_JUMPS = Array.from({ length: 8 }, (_, i) => ({
  x: i % 2 ? -6 : -8, z: -453 - i * 3.5, top: 13.5 + i * 1.5,
  width: 3.2, depth: 3.2, bottom: -7, solid: true
}));
export const CLOVER_WALK_ROUTE = [[0, -437], [-18, -444], [-18, -473], [-18, -496],
  [-18, -519], [-18, -541], [2, -541], [2, -510]];
export const CLOVER_JUMPS = Object.freeze([
  { x: 16, z: -381, top: 7.2 }, { x: 18, z: -387, top: 8.4 }, { x: 16, z: -393, top: 9 },
  { x: 17, z: -415, top: 10.2 }, { x: 19, z: -421, top: 11.4 }, { x: 17, z: -427, top: 12 }
].map(p => ({ ...p, width: 4.6, depth: 4.6, bottom: -7, solid: true })));
export const CLOVER_RAILS = CLOVER_RAMPS.flatMap(p => [-1, 1].map(side => ({
  x: p.x + side * (p.width / 2 - 0.08), z: p.z, width: 0.15, depth: p.depth,
  bottom: p.topAt(0, p.z + p.depth / 2), top: p.top + 1.01, solid: true,
  topAt: (x, z) => p.topAt(x, z) + 1.01
})));
export const CLOVER_SURFACES = [...CLOVER_PLATEAUS, ...CLOVER_VALLEY, ...CLOVER_ASCENT_JUMPS, ...CLOVER_RAMPS, ...CLOVER_JUMPS, ...CLOVER_RAILS];

const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function cloverArea(x, z, margin = 0) {
  return Math.abs(x) < 43 + margin && z < -325 + margin && z > -560 - margin;
}
export function cloverApproach(x, z) {
  return Math.abs(x) < 6 && z < -24 && z > -336;
}
export function cloverGround(x, z, original) {
  let height = original;
  if (cloverArea(x, z)) {
    const edge = (1 - smooth(36, 43, Math.abs(x))) * smooth(-560, -553, z) * (1 - smooth(-332, -325, z));
    // Entrance stays at grass level; the ravine opens beneath the elevated land.
    const target = 1.5 - 8.5 * (1 - smooth(-352, -340, z));
    height += (target - height) * edge;
  }
  if (cloverApproach(x, z)) {
    const weight = (1 - smooth(3, 6, Math.abs(x))) * (1 - smooth(-35, -24, z));
    height += (1.5 - height) * weight;
  }
  return height;
}
export function createCloverRecovery() {
  let active = false;
  let supportHeight = 1.5;
  let summitReached = false;
  return {
    reset() { active = false; supportHeight = 1.5; summitReached = false; },
    update(player) {
      const feet = player.position.y - 2.05;
      // Only an actual course surface can update support. Bare terrain beneath
      // the summit must never replace its checkpoint after a missed landing.
      const supported = player.grounded && CLOVER_SURFACES.some(p => {
        const contains = p.contains ? p.contains(player.position.x, player.position.z, .3) :
          Math.abs(player.position.x-p.x)<p.width/2+.3 && Math.abs(player.position.z-p.z)<p.depth/2+.3;
        return contains && Math.abs(feet-(p.topAt ? p.topAt(player.position.x,player.position.z) : p.top))<.15;
      });
      if (supported) {
        supportHeight = feet;
        if (feet >= 23.4 && feet < 25 && player.position.z < -480) summitReached = true;
      }
      // Keep recovery armed beyond the footprint: a jump over the outer edge
      // should recover before the player reaches ground outside the ravine.
      const inRecoveryArea = Math.abs(player.position.x)<100 && player.position.z<-325 && player.position.z>-620;
      if (summitReached && inRecoveryArea && player.velocity.y<0 && !supported && feet<20 && supportHeight>=23.4) {
        return CLOVER_SUMMIT_CHECKPOINT;
      }
      if (Math.hypot(player.position.x, player.position.z - CLOVER_ENTRANCE.z) < 8) active = true;
      if (cloverArea(player.position.x, player.position.z) && player.position.y - 2.05 >= 1.5) active = true;
      if (!cloverArea(player.position.x, player.position.z)) { active = false; return null; }
      if (active && player.velocity.y < 0 && feet < Math.max(0, supportHeight - 5)) return summitReached ? CLOVER_SUMMIT_CHECKPOINT : CLOVER_ENTRANCE;
      return null;
    }
  };
}
