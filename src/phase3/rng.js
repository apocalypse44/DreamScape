// Seeded random numbers. Same seed -> same sequence, so R rebuilds identically.
// Never use Math.random() for anything that changes positions or decisions.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mix a base seed with extra numbers to get an independent sub-seed.
export function subSeed(seed, ...nums) {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const n of nums) {
    h = Math.imul(h ^ (n | 0), 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}
