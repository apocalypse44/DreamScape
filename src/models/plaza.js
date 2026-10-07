import { RIDGE_PATH } from './ridge.js';
export function plazaTerrain(x, z, original) {
  const smooth = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // Calm hills also need levelling: the existing chaos protection alone does
  // not make spawn flat. Include the shrine footing, then blend into the land.
  const weight = Math.max(1 - smooth(12, 21, Math.hypot(x, z)),
    1 - smooth(6, 10, Math.hypot(x, z + 11)));
  return original + (1.5 - original) * weight;
}
export const PLAZA_ROUTES = [
  [[0, -2], [0, -5.5]],
  [[-2, -2], [-7, -12], [-13.5, -26]],
  [[2, 2], [11, 12], [19, 22], [25, 30], [RIDGE_PATH[0].x, RIDGE_PATH[0].z]]
];
export function plazaPathArea(x, z) {
  if (Math.hypot(x, z) < 10) return true;
  return PLAZA_ROUTES.some(route => route.slice(1).some((b, i) => {
    const a = route[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 2.5;
  }));
}
