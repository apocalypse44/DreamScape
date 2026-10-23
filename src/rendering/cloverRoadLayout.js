import { ROOT_LANDINGS } from '../models/cloverGrowth.js';

// A north-facing local symbol (-Z) needs a negative Three.js Y rotation to
// match the turtle's cardinal headings: 0 north, 1 east, 2 south, 3 west.
export const guideYaw = heading => -heading * Math.PI / 2;

// Keep collision/backbone coordinates intact, but render road bodies only in
// the gaps. Drawing their tops through grass landings caused depth fighting.
export function visibleRoadSegments(segment, progress = 1) {
  const from = segment.from;
  const to = Object.fromEntries(['x', 'y', 'z'].map(k => [k, from[k] + (segment.to[k] - from[k]) * progress]));
  let intervals = [[0, 1]];
  for (const pad of ROOT_LANDINGS) {
    let enter = 0, exit = 1;
    for (const [axis, size] of [['x', 'width'], ['z', 'depth']]) {
      const delta = to[axis] - from[axis], min = pad[axis] - pad[size] / 2, max = pad[axis] + pad[size] / 2;
      if (Math.abs(delta) < 1e-8) { if (from[axis] < min || from[axis] > max) { enter = 1; exit = 0; } }
      else {
        const a = (min - from[axis]) / delta, b = (max - from[axis]) / delta;
        enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      }
    }
    if (enter >= exit) continue;
    intervals = intervals.flatMap(([a, b]) => exit <= a || enter >= b ? [[a, b]]
      : [[a, Math.min(b, enter)], [Math.max(a, exit), b]].filter(([start, end]) => end - start > 1e-8));
  }
  const point = t => Object.fromEntries(['x', 'y', 'z'].map(k => [k, from[k] + (to[k] - from[k]) * t]));
  return intervals.filter(([a, b]) => Math.hypot(to.x - from.x, to.z - from.z) * (b - a) > .001)
    .map(([a, b]) => ({ ...segment, from: point(a), to: point(b) }));
}
