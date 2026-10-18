// Fixed particle pool. Emitter-space births become world-space fire trails.
// Lifetime curves follow the textured-sprite approach in Bobby Roe's MIT example.
export const FIRE_RATES = { flame: 90, smoke: 10, spark: 18 };
const smooth = (a, b, t) => { const p = Math.max(0, Math.min(1, (t - a) / (b - a))); return p * p * (3 - 2 * p); };
export function fireLife(age) {
  const t = Math.max(0, Math.min(1, age));
  return { alpha: smooth(0, .08, t) * (1 - smooth(.45, 1, t)),
    size: (.35 + 1.3 * smooth(0, .65, t)) * (1 - .25 * smooth(.7, 1, t)) };
}

export function createFireParticles({ capacity = 256, random = Math.random } = {}) {
  const particles = Array.from({ length: capacity }, () => ({ life: 0 }));
  const budget = { flame: 0, smoke: 0, spark: 0 };
  let previous = null, cursor = 0, time = 0, emitted = 0;
  function clear() {
    particles.forEach(p => { p.life = 0; });
    for (const kind of Object.keys(budget)) budget[kind] = 0;
  }
  return {
    particles,
    get time() { return time; },
    get emitted() { return emitted; },
    reset() { clear(); previous = null; time = emitted = cursor = 0; },
    update(dt, { position, yaw = 0, intensity = 1, wolf = 1 }) {
      const step = Math.max(0, Math.min(.1, dt));
      const amount = Math.max(0, Math.min(1, intensity));
      time += step;
      if (previous && Math.hypot(position.x - previous.x, position.y - previous.y, position.z - previous.z) > 8) {
        clear(); previous = null;
      }
      const vx = previous && step > 0 ? (position.x - previous.x) / step : 0;
      const vz = previous && step > 0 ? (position.z - previous.z) / step : 0;
      previous = { x: position.x, y: position.y, z: position.z };
      if (amount === 0) { clear(); return; }
      for (const p of particles) {
        if (p.life <= 0) continue;
        p.life = Math.max(0, p.life - step);
        p.x += p.vx * step; p.y += p.vy * step; p.z += p.vz * step;
        p.vx *= Math.exp(-2 * step); p.vz *= Math.exp(-2 * step);
        p.x += Math.sin(time * 7 + p.seed * 30) * .17 * step;
        p.z += Math.cos(time * 5 + p.seed * 20) * .12 * step;
        p.angle += p.spin * step;
      }
      for (const [kind, rate] of Object.entries(FIRE_RATES)) {
        budget[kind] += step * rate * amount;
        const births = Math.floor(budget[kind] + 1e-9); budget[kind] -= births;
        for (let n = 0; n < births; n++) {
          let found = false;
          for (let attempt = 0; attempt < capacity; attempt++) {
            if (particles[cursor].life <= 0) { found = true; break; }
            cursor = (cursor + 1) % capacity;
          }
          if (!found) break;
          const p = particles[cursor]; cursor = (cursor + 1) % capacity;
          const along = (random() - .5) * (.85 + wolf * 1.1), across = (random() - .5) * (.35 + wolf * .3);
          const life = kind === 'flame' ? .5 + random() * .45 : kind === 'smoke' ? 1.1 + random() * .7 : .7 + random() * .7;
          Object.assign(p, { kind, life, maxLife: life, seed: random(),
            x: position.x + Math.sin(yaw) * along + Math.cos(yaw) * across,
            y: position.y + .22 + wolf * .18 + random() * (.2 + wolf * .25),
            z: position.z + Math.cos(yaw) * along - Math.sin(yaw) * across,
            vx: vx * .45 + (random() - .5) * .25, vz: vz * .45 + (random() - .5) * .25,
            vy: kind === 'smoke' ? .7 + random() * .4 : kind === 'spark' ? 2 + random() * 1.5 : 1.1 + random() * 1.1,
            size: kind === 'spark' ? .035 + random() * .035 : (.5 + random() * .4) * (.7 + wolf * .35),
            angle: random() * Math.PI * 2, spin: (random() - .5) * .8,
          });
          emitted++;
        }
      }
    },
  };
}
