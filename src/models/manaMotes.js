// Random mana motes (MANA_PLAN.md). While the world is calm and the traveller is free, a mote appears every
// 20-30 s on open ground 15-40 m away, at most three at a time, each fading after 45 s. Touching one fills the
// bar a little. About 25%/min if every mote is caught, roughly one surge per 80 s of exploring: slower than
// the bar is spent, and Chaos time never refills it.
export const MOTES = {
  every: [20, 30], near: 15, far: 40, max: 3, life: 45, reach: 1.5, climb: 6,
  small: 0.08, large: 0.2, largeChance: 1 / 6,
};

/** groundAt(x, z) -> surface height; canSpawnAt(x, z) -> false for landmarks, lakes, quest areas. */
export function createMoteField({ groundAt, canSpawnAt = () => true, random = Math.random, config = MOTES }) {
  const motes = []; // { x, y, z, age, value }
  const nextWait = () => config.every[0] + random() * (config.every[1] - config.every[0]);
  let wait = nextWait();

  function trySpawn(p) {
    const feet = p.y - 2.05;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = random() * Math.PI * 2, distance = config.near + random() * (config.far - config.near);
      const x = p.x + Math.cos(angle) * distance, z = p.z + Math.sin(angle) * distance, y = groundAt(x, z);
      // Reachable: not on a cliff top or down a gorge from where the traveller stands.
      if (!Number.isFinite(y) || Math.abs(y - feet) > config.climb || !canSpawnAt(x, z)) continue;
      motes.push({ x, y, z, age: 0, value: random() < config.largeChance ? config.large : config.small });
      return true;
    }
    return false;
  }

  return {
    motes,
    /** Returns the mana collected this frame. calm: the world is calm and nothing (scene, arena, indoors) owns play. */
    update(dt, p, calm) {
      let gained = 0;
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.age += dt;
        const touched = Math.hypot(p.x - m.x, p.z - m.z) < config.reach && Math.abs(p.y - 2.05 - m.y) < 2.5;
        if (touched) gained += m.value;
        if (touched || m.age > config.life) motes.splice(i, 1);
      }
      if (calm && motes.length < config.max && (wait -= dt) <= 0) { trySpawn(p); wait = nextWait(); }
      return gained;
    },
    reset() { motes.length = 0; wait = nextWait(); },
  };
}

/** Quest progress pays once per new high, so lifting and refitting a fragment (or a reset) can't farm it. */
export function createMilestones() {
  const best = new Map();
  return {
    /** Returns how many new steps `count` reached for `key`. */
    reach(key, count) {
      const before = best.get(key) ?? 0;
      if (count <= before) return 0;
      best.set(key, count);
      return count - before;
    },
    reset() { best.clear(); },
  };
}
