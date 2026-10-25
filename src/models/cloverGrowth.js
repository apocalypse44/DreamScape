import { makeRng, subSeed } from './rng.js';

export const ROOT_LIMITS = Object.freeze({ rounds: 3, segments: 128 });
export const ROOT_RULES = Object.freeze({ X: 'F[+B][-B]X', B: 'd[+B][-B]' });
export const ROOT_START = Object.freeze({ x: -34, z: -420, top: 12 });
// Cardinal headings: north, east, south, west. The persistent F symbols are
// never rewritten: a new generation extends the road instead of moving it.
export const ROOT_HEADINGS = Object.freeze([3, 0, 3]);
export const ROOT_LENGTHS = Object.freeze([34, 35, 36]);
export const ROOT_LANDINGS = Object.freeze([
  { ...ROOT_START, width: 18, depth: 24 },
  { x: -68, z: -420, top: 12, width: 12, depth: 12 },
  { x: -68, z: -455, top: 12, width: 12, depth: 12 },
  { x: -104, z: -455, top: 12, width: 18, depth: 20 },
]);
const direction = heading => ({ x: Math.sin(heading * Math.PI / 2), z: -Math.cos(heading * Math.PI / 2) });

export function rewriteRoots(rounds) {
  if (!Number.isInteger(rounds) || rounds < 0 || rounds > ROOT_LIMITS.rounds) throw new RangeError('Root growth supports zero to three rounds');
  let word = 'X';
  for (let i = 0; i < rounds; i++) word = [...word].map(symbol => ROOT_RULES[symbol] ?? symbol).join('');
  return word;
}

// Three stones close the wrong exits of each junction. These exact footprints
// are shared by the turtle's obstacle clipping and the visible blocking rocks.
export const ROOT_OBSTACLES = ROOT_LANDINGS.slice(0, 3).flatMap((p, junction) =>
  [0, 1, 2, 3].filter(h => h !== ROOT_HEADINGS[junction] &&
    // Keep the incoming road open at the later junctions.
    (junction === 0 ? h !== 1 : h !== (ROOT_HEADINGS[junction - 1] + 2) % 4))
    .map(h => { const d = direction(h); return { x: p.x + d.x * 8, z: p.z + d.z * 8, radius: 2.8, junction }; }));

// Earliest hit along a segment, expanded for the root's width. A bounded sweep
// stops branches at stones rather than allowing a long segment to tunnel through.
export function rootObstacleHit(from, to, obstacles = ROOT_OBSTACLES, clearance = .3) {
  const dx = to.x - from.x, dz = to.z - from.z, a = dx * dx + dz * dz;
  let hit = 1;
  if (!a) return hit;
  for (const rock of obstacles) {
    const ox = from.x - rock.x, oz = from.z - rock.z, r = rock.radius + clearance;
    const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - r * r;
    if (c <= 0) { hit = 0; continue; }
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) continue;
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t >= 0 && t < hit) hit = t;
  }
  return hit;
}

// Pure turtle interpretation. F is the designated horizontal road; d is a
// decorative branch. Brackets save/restore position and orientation. Guides
// set the heading of successive road runs; seeded turns vary only the foliage.
export function growRoots({ rounds = 3, guides = ROOT_HEADINGS, seed = 1, obstacles = ROOT_OBSTACLES } = {}) {
  const word = rewriteRoots(rounds), rng = makeRng(subSeed(seed, 307));
  const stack = [], segments = [], backbone = [];
  let at = { x: ROOT_START.x, y: ROOT_START.top - .25, z: ROOT_START.z }, angle = 0, run = 0, stopped = false;
  for (const symbol of word) {
    if (symbol === '[') { stack.push({ at: { ...at }, angle }); continue; }
    if (symbol === ']') { const previous = stack.pop(); if (previous) { at = previous.at; angle = previous.angle; } continue; }
    if (symbol === '+') { angle += Math.PI / 3; continue; }
    if (symbol === '-') { angle -= Math.PI / 3; continue; }
    if (symbol !== 'F' && symbol !== 'd') continue;
    if (segments.length >= ROOT_LIMITS.segments) break;
    if (symbol === 'F') {
      if (stopped) continue;
      const heading = guides[run];
      if (!Number.isInteger(heading) || heading < 0 || heading > 3) throw new RangeError('A guide must face a cardinal direction');
      angle = heading * Math.PI / 2;
    }
    const length = symbol === 'F' ? ROOT_LENGTHS[run] : 1.5 + rng() * 2.2;
    const end = { x: at.x + Math.sin(angle) * length, y: at.y + (symbol === 'd' ? .25 + rng() * .6 : 0), z: at.z - Math.cos(angle) * length };
    const hit = rootObstacleHit(at, end, obstacles, symbol === 'F' ? 1.8 : .2);
    const to = { x: at.x + (end.x - at.x) * hit, y: at.y + (end.y - at.y) * hit, z: at.z + (end.z - at.z) * hit };
    const segment = { from: { ...at }, to, road: symbol === 'F', blocked: hit < 1, run: symbol === 'F' ? run : null };
    segments.push(segment);
    if (symbol === 'F') { backbone.push(segment); run++; stopped = hit < 1; }
    at = to;
  }
  return { word, segments, backbone, capped: segments.length >= ROOT_LIMITS.segments };
}

export function rootConnects(segment, landing) {
  return Boolean(segment && !segment.blocked && Math.hypot(segment.to.x - landing.x, segment.to.z - landing.z) < .01);
}

export function rootBridge(segment, enabled = () => true) {
  const { from, to } = segment, alongX = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
  const width = alongX ? Math.abs(to.x - from.x) + .4 : 3.8;
  const depth = alongX ? 3.8 : Math.abs(to.z - from.z) + .4;
  const x = (from.x + to.x) / 2, z = (from.z + to.z) / 2;
  return { name: 'living-road', x, z, top: ROOT_START.top, bottom: ROOT_START.top - .6, width, depth, solid: true,
    contains(px, pz, pad = 0) { return enabled() && Math.abs(px - x) < width / 2 + pad && Math.abs(pz - z) < depth / 2 + pad; } };
}
