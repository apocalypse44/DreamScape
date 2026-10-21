const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Sunrise at 06:00, noon at 12:00, sunset at 18:00. Climate obscures daylight
// without changing the world's time or celestial orbit.
export function sampleDaylight(hour, permanentNight = false) {
  // Boolean calls retain the original endpoints; a fractional climate blends
  // daylight, moonlight and ambient light without touching the clock or orbit.
  const night = Math.max(0, Math.min(1, Number(permanentNight)));
  const angle = (((hour % 24) + 24) % 24 - 6) / 24 * Math.PI * 2;
  const elevation = Math.sin(angle);
  const naturalDaylight = smooth(-0.12, 0.22, elevation);
  const naturalTwilight = 1 - smooth(0.02, 0.42, Math.abs(elevation));
  const daylight = naturalDaylight * (1 - night);
  const twilight = naturalTwilight * (1 - night);
  const sun = { x: Math.cos(angle), y: elevation, z: Math.cos(angle) * 0.35 };
  const length = Math.hypot(sun.x, sun.y, sun.z);
  for (const key of ['x', 'y', 'z']) sun[key] /= length;
  return {
    sun, daylight, twilight,
    sunIntensity: (1 - night) * 2.1 * smooth(-0.02, 0.3, elevation),
    moonIntensity: (0.22 * (1 - night) + 0.07 * night) * smooth(0, 0.3, -elevation),
    ambientIntensity: (0.24 + naturalDaylight * 1.05) * (1 - night) + 0.3 * night,
    stars: (1 - naturalDaylight) * (1 - naturalTwilight * 0.7) * (1 - night) + 0.12 * night,
  };
}
