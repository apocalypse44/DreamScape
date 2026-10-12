// A* pathfinding on a grid laid over the live terrain (Hart, Nilsson & Raphael 1968; Red Blob Games,
// "Introduction to A*"). Used by the Ember Hound to lead the player to embers around obstacles and
// cliffs instead of in a straight line.
//
//   f(n) = g(n) + h(n)   g: cost so far, h: octile distance to the goal (admissible: no step costs
//                        less than its length, so A* returns a shortest path under this cost model)
//
// Cost model: step length x (1 + SLOPE_COST x excess gradient). Grades steeper than maxGrade are walls,
// as are cells covered by obstacle circles or blocked areas. Heights are sampled lazily, so A* only
// pays for the cells it actually explores. The result is string-pulled (line-of-sight smoothing) so
// the hound runs straight wherever it can and only turns where the grid route has to.
const SQRT2 = Math.SQRT2;
const SLOPE_COST = 3;    // how strongly climbing is discouraged
const EASY_GRADE = 0.25; // grades up to this are free (rise / run)

// Binary min-heap keyed by f, storing cell indices.
class Heap {
  constructor() { this.items = []; this.keys = []; }
  get size() { return this.items.length; }
  push(item, key) {
    const { items, keys } = this;
    let i = items.length;
    items.push(item); keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      items[i] = items[parent]; keys[i] = keys[parent];
      i = parent;
    }
    items[i] = item; keys[i] = key;
  }
  pop() {
    const { items, keys } = this;
    const top = items[0];
    const item = items.pop(), key = keys.pop();
    if (items.length) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= items.length) break;
        if (child + 1 < items.length && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= key) break;
        items[i] = items[child]; keys[i] = keys[child];
        i = child;
      }
      items[i] = item; keys[i] = key;
    }
    return top;
  }
}

// start, goal: {x, z}. height(x, z): ground height. obstacles: [{x, z, radius}] circles to avoid.
// blocked(x, z): extra no-go areas. Returns { path: [{x, z}], raw, explored: [{x, z, g}], cell } or null.
export function findPath(start, goal, { height, obstacles = [], blocked = () => false,
  cell = 2, margin = 24, maxSide = 150, maxGrade = 1.6, clearance = 0.6 } = {}) {
  // Grid covering both points plus a margin for detours; coarser cells if the trip is very long.
  const minX = Math.min(start.x, goal.x) - margin, maxX = Math.max(start.x, goal.x) + margin;
  const minZ = Math.min(start.z, goal.z) - margin, maxZ = Math.max(start.z, goal.z) + margin;
  cell = Math.max(cell, (maxX - minX) / maxSide, (maxZ - minZ) / maxSide);
  const cols = Math.ceil((maxX - minX) / cell) + 1, rows = Math.ceil((maxZ - minZ) / cell) + 1;
  const count = cols * rows;
  const worldX = c => minX + c * cell, worldZ = r => minZ + r * cell;
  const toCol = x => Math.min(cols - 1, Math.max(0, Math.round((x - minX) / cell)));
  const toRow = z => Math.min(rows - 1, Math.max(0, Math.round((z - minZ) / cell)));

  // Rasterize obstacle circles (grown by the agent's clearance) into a wall mask once.
  const wall = new Uint8Array(count);
  for (const o of obstacles) {
    const r = o.radius + clearance;
    if (o.x + r < minX || o.x - r > maxX || o.z + r < minZ || o.z - r > maxZ) continue;
    for (let row = toRow(o.z - r); row <= toRow(o.z + r); row++) {
      for (let col = toCol(o.x - r); col <= toCol(o.x + r); col++) {
        if (Math.hypot(worldX(col) - o.x, worldZ(row) - o.z) <= r) wall[row * cols + col] = 1;
      }
    }
  }
  const startIndex = toRow(start.z) * cols + toCol(start.x);
  const goalIndex = toRow(goal.z) * cols + toCol(goal.x);
  wall[startIndex] = wall[goalIndex] = 0; // the agent and the target are never inside a wall

  const heights = new Float32Array(count).fill(NaN);
  const heightOf = i => {
    if (Number.isNaN(heights[i])) heights[i] = height(worldX(i % cols), worldZ((i / cols) | 0));
    return heights[i];
  };
  const open = i => {
    if (wall[i] === 1) return false;
    if (wall[i] === 0 && i !== startIndex && i !== goalIndex && blocked(worldX(i % cols), worldZ((i / cols) | 0))) {
      wall[i] = 1;
      return false;
    }
    wall[i] = 2; // checked and open
    return true;
  };
  // Cost of one step of length `run` between cells a and b; Infinity if it is too steep.
  const stepCost = (a, b, run) => {
    const grade = Math.abs(heightOf(b) - heightOf(a)) / run;
    if (grade > maxGrade) return Infinity;
    return run * (1 + SLOPE_COST * Math.max(0, grade - EASY_GRADE));
  };

  const goalCol = goalIndex % cols, goalRow = (goalIndex / cols) | 0;
  const heuristic = i => { // octile distance: exact for 8-way moves on flat, free ground
    const dc = Math.abs(i % cols - goalCol), dr = Math.abs(((i / cols) | 0) - goalRow);
    return cell * (Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr));
  };

  const g = new Float32Array(count).fill(Infinity);
  const cameFrom = new Int32Array(count).fill(-1);
  const closed = new Uint8Array(count);
  const frontier = new Heap();
  g[startIndex] = 0;
  frontier.push(startIndex, heuristic(startIndex));
  const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false;
  while (frontier.size) {
    const current = frontier.pop();
    if (closed[current]) continue; // stale heap entry
    if (current === goalIndex) { found = true; break; }
    closed[current] = 1;
    const col = current % cols, row = (current / cols) | 0;
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = col + dc, nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const next = nr * cols + nc;
      if (closed[next] || !open(next)) continue;
      // No corner cutting: a diagonal needs both orthogonal cells open.
      if (dc && dr && (!open(row * cols + nc) || !open(nr * cols + col))) continue;
      const cost = stepCost(current, next, dc && dr ? cell * SQRT2 : cell);
      if (cost === Infinity) continue;
      const tentative = g[current] + cost;
      if (tentative < g[next]) {
        g[next] = tentative;
        cameFrom[next] = current;
        frontier.push(next, tentative + heuristic(next));
      }
    }
  }
  if (!found) return null;

  const raw = [];
  for (let i = goalIndex; i !== -1; i = cameFrom[i]) raw.push(i);
  raw.reverse();
  const explored = [];
  for (let i = 0; i < count; i++) if (closed[i]) explored.push({ x: worldX(i % cols), z: worldZ((i / cols) | 0), g: g[i] });

  // String pulling: from each kept point, skip ahead while the next grid point is still in a straight,
  // walkable line (greedy, so linear in path length).
  const walkable = (a, b) => {
    const ac = a % cols, ar = (a / cols) | 0, bc = b % cols, br = (b / cols) | 0;
    const steps = Math.max(Math.abs(bc - ac), Math.abs(br - ar)) * 2;
    let prev = a;
    for (let s = 1; s <= steps; s++) {
      const i = Math.round(ar + (br - ar) * s / steps) * cols + Math.round(ac + (bc - ac) * s / steps);
      if (i === prev) continue;
      if (!open(i) || stepCost(prev, i, cell) === Infinity) return false;
      prev = i;
    }
    return true;
  };
  const smooth = [raw[0]];
  for (let k = 0; k < raw.length - 1;) {
    let far = k + 1;
    while (far + 1 < raw.length && walkable(raw[k], raw[far + 1])) far++;
    smooth.push(raw[far]);
    k = far;
  }
  const toPoint = i => ({ x: worldX(i % cols), z: worldZ((i / cols) | 0) });
  const path = smooth.map(toPoint);
  path[path.length - 1] = { x: goal.x, z: goal.z }; // end exactly on the target, not its cell centre
  return { path, raw: raw.map(toPoint), explored, cell };
}
