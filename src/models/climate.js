// Visual climate crosses kingdom borders continuously; gameplay still uses the
// exact biome boundary. A 110m approach gives roughly 6s of blending at a sprint.
export function spadeClimateAt(x, z) {
  const circle = Math.hypot(x, z) - 350;
  const westSector = (-x - Math.abs(z)) / Math.SQRT2;
  const distance = Math.min(circle, westSector);
  const t = Math.max(0, Math.min(1, (distance + 90) / 110));
  return t * t * (3 - 2 * t);
}
// Diamond's warm, dusty air, blended the same way across its southern border.
export function diamondClimateAt(x, z) {
  const circle = Math.hypot(x, z) - 350;
  const southSector = (z - Math.abs(x)) / Math.SQRT2;
  const distance = Math.min(circle, southSector);
  const t = Math.max(0, Math.min(1, (distance + 90) / 110));
  return t * t * (3 - 2 * t);
}
// Heart's humid golden-hour air ("the Drained Tide"), blended the same way across its eastern border.
export function heartClimateAt(x, z) {
  const circle = Math.hypot(x, z) - 350;
  const eastSector = (x - Math.abs(z)) / Math.SQRT2;
  const distance = Math.min(circle, eastSector);
  const t = Math.max(0, Math.min(1, (distance + 90) / 110));
  return t * t * (3 - 2 * t);
}
