const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Sunrise at 06:00, noon at 12:00, sunset at 18:00. Climate obscures daylight
// without changing the world's time or celestial orbit.
export function sampleDaylight(hour, permanentNight = false) {
  const angle = (((hour % 24) + 24) % 24 - 6) / 24 * Math.PI * 2;
  const elevation = Math.sin(angle);
  const daylight = permanentNight ? 0 : smooth(-0.12, 0.22, elevation);
  const twilight = permanentNight ? 0 : 1 - smooth(0.02, 0.42, Math.abs(elevation));
  const sun = { x: Math.cos(angle), y: elevation, z: Math.cos(angle) * 0.35 };
  const length = Math.hypot(sun.x, sun.y, sun.z);
  for (const key of ['x', 'y', 'z']) sun[key] /= length;
  return {
    sun, daylight, twilight,
    sunIntensity: permanentNight ? 0 : 2.1 * smooth(-0.02, 0.3, elevation),
    moonIntensity: (permanentNight ? 0.07 : 0.22) * smooth(0, 0.3, -elevation),
    ambientIntensity: permanentNight ? 0.3 : 0.24 + daylight * 1.05,
    stars: (1 - daylight) * (1 - twilight * 0.7) * (permanentNight ? 0.12 : 1),
  };
}
