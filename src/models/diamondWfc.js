// Diamond chapter: Shatterglass Relay solver (Wave Function Collapse style).
//
// Pure logic, no Three.js. The board is a small grid of sockets. Every socket
// keeps a "domain": the set of conduit tiles that could still go there. Placing
// a tile removes incompatible tiles from neighbouring sockets (constraint
// propagation). solve() fills the rest by always choosing the socket with the
// fewest options (minimum remaining values) and backtracks on contradictions,
// inside an operation budget. A reserved backbone guarantees that the source
// can reach every required port, and a prevalidated fallback layout is used if
// solving fails.
//
// Tiles: a tile is a 4-bit number, one bit per side that carries a connector.
//   bit 0 = North, bit 1 = East, bit 2 = South, bit 3 = West.
// All 16 combinations form six types with their rotations:
//   blank (0 sides), end (1), straight (2 opposite), corner (2 adjacent),
//   tee (3), cross (4).
// A domain is a 16-bit mask: bit t is set when tile t is still possible.
//
// Board coordinates: x grows east, y grows south; row y = 0 is the north edge.

export const N = 0;
export const E = 1;
export const S = 2;
export const W = 3;
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIR_NAMES = ['N', 'E', 'S', 'W'];
export const TILE_COUNT = 16;
export const ALL_TILES = 0xffff;

export const opposite = (d) => (d + 2) % 4;
export const hasSide = (tile, d) => (tile >> d) & 1;
export const tileBit = (tile) => 1 << tile;

export function popcount(mask) {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

export function tilesIn(mask) {
  const out = [];
  for (let t = 0; t < TILE_COUNT; t++) if (mask & (1 << t)) out.push(t);
  return out;
}

// Rotate a tile clockwise by `turns` quarter turns.
export function rotateTile(tile, turns = 1) {
  const r = ((turns % 4) + 4) % 4;
  return ((tile << r) | (tile >> (4 - r))) & 0xf;
}

const BASE = { blank: 0b0000, end: 0b0001, straight: 0b0101, corner: 0b0011, tee: 0b0111, cross: 0b1111 };
export const TILE_TYPES = Object.keys(BASE);

export function tileType(tile) {
  const n = popcount(tile);
  if (n === 0) return 'blank';
  if (n === 1) return 'end';
  if (n === 3) return 'tee';
  if (n === 4) return 'cross';
  return tile === 0b0101 || tile === 0b1010 ? 'straight' : 'corner';
}

// Quarter turns clockwise from the type's base orientation.
export function tileRotation(tile) {
  const base = BASE[tileType(tile)];
  for (let r = 0; r < 4; r++) if (rotateTile(base, r) === tile) return r;
  return 0;
}

export function makeTile(type, turns = 0) {
  if (!(type in BASE)) throw new Error(`Unknown tile type: ${type}`);
  return rotateTile(BASE[type], turns);
}

// SIDE_MASK[d][v]: every tile whose side d equals v (0 closed, 1 connector).
const SIDE_MASK = [0, 1, 2, 3].map((d) => {
  const closed = tilesIn(ALL_TILES).filter((t) => !hasSide(t, d)).reduce((m, t) => m | tileBit(t), 0);
  return [closed, ALL_TILES & ~closed];
});

// Small seeded random generator so a given seed always gives the same board.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Default Shatterglass Relay: source on the west, escape gate on the east,
// inversion core on the south, plus an optional side gate on the north that
// only opens if the player's arrangement happens to route a conduit to it.
export const DEFAULT_RELAY = Object.freeze({
  size: 4,
  ports: [
    { id: 'source', x: 0, y: 1, dir: W, role: 'source', required: true },
    { id: 'escape-gate', x: 3, y: 1, dir: E, role: 'gate', required: true },
    { id: 'inversion-core', x: 2, y: 3, dir: S, role: 'core', required: true },
    { id: 'side-gate', x: 1, y: 0, dir: N, role: 'gate', required: false },
  ],
  // Paths of cells that must stay connected. Each path starts or ends at a port cell.
  backbone: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 1], [2, 2], [2, 3]],
  ],
  seed: 7,
  budget: 4000,
});

export class RelaySolver {
  constructor(config = {}) {
    const c = { ...DEFAULT_RELAY, ...config };
    this.size = c.size;
    this.ports = c.ports.map((p) => ({ ...p }));
    this.backbone = (c.backbone || []).map((path) => path.map(([x, y]) => [x, y]));
    this.seed = c.seed >>> 0;
    this.budget = c.budget;
    this.allowed = c.tiles ? c.tiles.reduce((m, t) => m | tileBit(t), 0) : ALL_TILES;
    this.cellCount = this.size * this.size;

    this.portAt = new Map(); // key "cell:dir" -> port
    for (const p of this.ports) this.portAt.set(this._portKey(this.index(p.x, p.y), p.dir), p);

    this.required = this._backboneSides();
    this.initial = this._initialDomains();
    this.domains = this.initial.slice();
    this.placed = new Set();
    this.history = [];
    this.ops = 0;
    this._limit = Infinity;
    this.solveCount = 0;
    this.stats = { backtracks: 0, lastOps: 0 };

    if (this._propagate(this._allCells()) !== 'ok') {
      throw new Error('Relay configuration has no consistent starting state');
    }
    this.initial = this.domains.slice();
  }

  // ---------- coordinates ----------
  index(x, y) { return y * this.size + x; }
  coords(i) { return [i % this.size, Math.floor(i / this.size)]; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.size && y < this.size; }
  neighbor(i, d) {
    const [x, y] = this.coords(i);
    const nx = x + DIRS[d][0];
    const ny = y + DIRS[d][1];
    return this.inBounds(nx, ny) ? this.index(nx, ny) : -1;
  }
  _portKey(i, d) { return `${i}:${d}`; }
  _allCells() { return Array.from({ length: this.cellCount }, (_, i) => i); }

  // ---------- setup ----------
  _backboneSides() {
    const req = new Uint8Array(this.cellCount);
    for (const path of this.backbone) {
      for (let k = 0; k + 1 < path.length; k++) {
        const [ax, ay] = path[k];
        const [bx, by] = path[k + 1];
        const d = DIRS.findIndex(([dx, dy]) => ax + dx === bx && ay + dy === by);
        if (d < 0) throw new Error('Backbone cells must be neighbours');
        req[this.index(ax, ay)] |= 1 << d;
        req[this.index(bx, by)] |= 1 << opposite(d);
      }
    }
    // Backbone ends that sit on a required port must open toward that port.
    for (const p of this.ports) {
      if (!p.required) continue;
      req[this.index(p.x, p.y)] |= 1 << p.dir;
    }
    return req;
  }

  _initialDomains() {
    const dom = new Uint16Array(this.cellCount);
    for (let i = 0; i < this.cellCount; i++) {
      let mask = this.allowed;
      for (let d = 0; d < 4; d++) {
        if (this.neighbor(i, d) >= 0) continue;
        const port = this.portAt.get(this._portKey(i, d));
        if (!port) mask &= SIDE_MASK[d][0]; // board edge: must be closed
        else if (port.required) mask &= SIDE_MASK[d][1]; // required port: must be open
        // optional port: either is fine
      }
      const req = this.required[i];
      if (req) mask &= tilesIn(ALL_TILES).filter((t) => (t & req) === req).reduce((m, t) => m | tileBit(t), 0);
      dom[i] = mask;
    }
    return dom;
  }

  // ---------- constraint propagation ----------
  // Returns 'ok', 'contradiction' or 'budget'.
  _propagate(start) {
    const queue = start.slice();
    const queued = new Uint8Array(this.cellCount);
    for (const i of queue) queued[i] = 1;
    while (queue.length) {
      const i = queue.shift();
      queued[i] = 0;
      const dom = this.domains[i];
      for (let d = 0; d < 4; d++) {
        const n = this.neighbor(i, d);
        if (n < 0) continue;
        if (++this.ops > this._limit) return 'budget';
        // Which side values can cell i still show toward n?
        let support = 0;
        if (dom & SIDE_MASK[d][0]) support |= SIDE_MASK[opposite(d)][0];
        if (dom & SIDE_MASK[d][1]) support |= SIDE_MASK[opposite(d)][1];
        const next = this.domains[n] & support;
        if (next === this.domains[n]) continue;
        this.domains[n] = next;
        if (next === 0) return 'contradiction';
        if (!queued[n]) { queue.push(n); queued[n] = 1; }
      }
    }
    return 'ok';
  }

  _beginOperation(budget = this.budget) {
    this.ops = 0;
    this._limit = budget;
  }

  _snapshot() {
    return { domains: this.domains.slice(), placed: new Set(this.placed) };
  }

  _restore(s) {
    this.domains.set(s.domains);
    this.placed = new Set(s.placed);
  }

  // ---------- queries ----------
  options(x, y) { return tilesIn(this.domains[this.index(x, y)]); }
  optionCount(x, y) { return popcount(this.domains[this.index(x, y)]); }
  isCollapsed(x, y) { return this.optionCount(x, y) === 1; }
  tileAt(x, y) {
    const opts = this.options(x, y);
    return opts.length === 1 ? opts[0] : null;
  }
  isPlaced(x, y) { return this.placed.has(this.index(x, y)); }
  isSolved() { return this.domains.every((m) => popcount(m) === 1); }
  canPlace(x, y, tile) { return this.inBounds(x, y) && (this.domains[this.index(x, y)] & tileBit(tile)) !== 0; }

  // ---------- player actions ----------
  // Place a tile. If it is not allowed, or it would cause a contradiction,
  // nothing changes and the reason is returned. `narrowed` lists the sockets
  // whose options shrank, for the "neighbours narrow" visual.
  place(x, y, tile) {
    if (!this.inBounds(x, y)) return { ok: false, reason: 'out-of-bounds' };
    const i = this.index(x, y);
    if (this.placed.has(i)) return { ok: false, reason: 'occupied' };
    if (!(this.domains[i] & tileBit(tile))) return { ok: false, reason: 'incompatible' };
    const before = this._snapshot();
    this._beginOperation();
    this.domains[i] = tileBit(tile);
    const result = this._propagate([i]);
    if (result !== 'ok') {
      this._restore(before);
      return { ok: false, reason: result };
    }
    this.placed.add(i);
    this.history.push(before);
    return { ok: true, narrowed: this._changedCells(before.domains), ops: this.ops };
  }

  undo() {
    const s = this.history.pop();
    if (!s) return false;
    this._restore(s);
    return true;
  }

  reset() {
    this.domains = this.initial.slice();
    this.placed = new Set();
    this.history = [];
    this.solveCount = 0;
    this.stats = { backtracks: 0, lastOps: 0 };
  }

  _changedCells(prev) {
    const out = [];
    for (let i = 0; i < this.cellCount; i++) if (prev[i] !== this.domains[i]) out.push(this.coords(i));
    return out;
  }

  // ---------- automatic completion ----------
  // Fill every unresolved socket. Keeps the player's placements. If solving
  // fails or runs out of budget, applies the fallback layout instead.
  solve({ budget = this.budget } = {}) {
    const before = this._snapshot();
    this._beginOperation(budget);
    this.stats.backtracks = 0;
    const rng = mulberry32(this.seed + this.solveCount++);
    const result = this._search(rng);
    this.stats.lastOps = this.ops;

    if (result === 'ok' && this.trace().complete) {
      this.history.push(before);
      return { ok: true, fallback: false, ops: this.ops, backtracks: this.stats.backtracks };
    }
    const reason = result === 'ok' ? 'disconnected' : result;
    this._restore(before);
    const fallback = this.fallbackLayout();
    if (!fallback) return { ok: false, fallback: false, reason, ops: this.ops };
    this.history.push(before);
    for (let i = 0; i < this.cellCount; i++) this.domains[i] = tileBit(fallback[i]);
    this.placed = new Set();
    return { ok: true, fallback: true, reason, ops: this.ops, backtracks: this.stats.backtracks };
  }

  _search(rng) {
    // Minimum remaining values: the unresolved socket with the fewest options.
    let best = -1;
    let bestCount = Infinity;
    for (let i = 0; i < this.cellCount; i++) {
      const c = popcount(this.domains[i]);
      if (c === 0) return 'contradiction';
      if (c > 1 && c < bestCount) { best = i; bestCount = c; }
    }
    if (best < 0) return 'ok';

    const choices = tilesIn(this.domains[best]);
    for (let k = choices.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [choices[k], choices[j]] = [choices[j], choices[k]];
    }
    for (const tile of choices) {
      if (++this.ops > this._limit) return 'budget';
      const saved = this.domains.slice();
      this.domains[best] = tileBit(tile);
      let r = this._propagate([best]);
      if (r === 'ok') r = this._search(rng);
      if (r === 'ok' || r === 'budget') return r;
      this.domains.set(saved);
      this.stats.backtracks++;
    }
    return 'contradiction';
  }

  // Prevalidated layout: backbone conduits only, every other socket blank.
  // Returns null if that layout is not valid for this configuration.
  fallbackLayout() {
    const layout = Array.from(this.required);
    return validateLayout(this, layout) ? layout : null;
  }

  // ---------- running the relay ----------
  // Follow connected conduits from the source. Unresolved sockets act as
  // closed. Returns the cells in pulse order (with depth for animation), the
  // ports reached, open ends that leak, and whether every required port lit.
  trace() {
    const source = this.ports.find((p) => p.role === 'source');
    const required = this.ports.filter((p) => p.required);
    const result = { cells: [], reached: new Set(), leaks: [], complete: required.length === 0 };
    if (!source) return result;
    const start = this.index(source.x, source.y);
    const startTile = this.tileAt(source.x, source.y);
    if (startTile === null || !hasSide(startTile, source.dir)) return result;

    result.reached.add(source.id);
    const depth = new Int16Array(this.cellCount).fill(-1);
    depth[start] = 0;
    const queue = [start];
    while (queue.length) {
      const i = queue.shift();
      const [x, y] = this.coords(i);
      result.cells.push({ x, y, depth: depth[i] });
      const tile = this.tileAt(x, y);
      for (let d = 0; d < 4; d++) {
        if (!hasSide(tile, d)) continue;
        const n = this.neighbor(i, d);
        if (n < 0) {
          const port = this.portAt.get(this._portKey(i, d));
          if (port) result.reached.add(port.id);
          else result.leaks.push({ x, y, dir: d });
          continue;
        }
        const [nx, ny] = this.coords(n);
        const nTile = this.tileAt(nx, ny);
        if (nTile === null || !hasSide(nTile, opposite(d))) { result.leaks.push({ x, y, dir: d }); continue; }
        if (depth[n] < 0) { depth[n] = depth[i] + 1; queue.push(n); }
      }
    }
    result.complete = required.every((p) => result.reached.has(p.id));
    return result;
  }

  // Plain data for the renderer or a developer overlay.
  snapshotView() {
    const cells = [];
    for (let i = 0; i < this.cellCount; i++) {
      const [x, y] = this.coords(i);
      const opts = tilesIn(this.domains[i]);
      cells.push({ x, y, options: opts.length, tile: opts.length === 1 ? opts[0] : null, placed: this.placed.has(i), backbone: this.required[i] !== 0 });
    }
    return { size: this.size, cells };
  }
}

// True when every tile is allowed by the configuration, every edge matches its
// neighbour, board edges are closed except at ports, and required ports open.
export function validateLayout(relay, layout) {
  if (layout.length !== relay.cellCount) return false;
  for (let i = 0; i < relay.cellCount; i++) {
    const t = layout[i];
    if (!(relay.allowed & tileBit(t))) return false;
    if ((t & relay.required[i]) !== relay.required[i]) return false;
    for (let d = 0; d < 4; d++) {
      const n = relay.neighbor(i, d);
      if (n >= 0) {
        if (hasSide(t, d) !== hasSide(layout[n], opposite(d))) return false;
      } else {
        const port = relay.portAt.get(relay._portKey(i, d));
        if (!port && hasSide(t, d)) return false;
        if (port && port.required && !hasSide(t, d)) return false;
      }
    }
  }
  return true;
}

export function createRelay(config) {
  return new RelaySolver(config);
}
