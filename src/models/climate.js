// Visual climate crosses kingdom borders continuously; gameplay still uses the
// exact biome boundary. A 110m approach gives roughly 6s of blending at a sprint.
export function spadeClimateAt(x, z) {
  const circle = Math.hypot(x, z) - 350;
  const westSector = (-x - Math.abs(z)) / Math.SQRT2;
  const distance = Math.min(circle, westSector);
  const t = Math.max(0, Math.min(1, (distance + 90) / 110));
  return t * t * (3 - 2 * t);
}
