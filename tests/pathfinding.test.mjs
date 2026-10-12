import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findPath } from '../src/models/pathfinding.js';

const flat = () => 0;
const length = path => path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.z - path[i].z), 0);

test('open flat ground gives a straight two-point path', () => {
  const result = findPath({ x: 0, z: 0 }, { x: 40, z: 10 }, { height: flat });
  assert.equal(result.path.length, 2);
  assert.deepEqual(result.path[1], { x: 40, z: 10 });
});

test('a wall of obstacles is walked around through its gap', () => {
  // Wall along x = 20 from z = -40 to 40, with a gap near z = 30.
  const obstacles = [];
  for (let z = -40; z <= 40; z += 1) if (Math.abs(z - 30) > 3) obstacles.push({ x: 20, z, radius: 0.6 });
  const result = findPath({ x: 0, z: 0 }, { x: 40, z: 0 }, { height: flat, obstacles, margin: 50 });
  assert.ok(result, 'a path exists');
  const crossing = result.raw.find(p => Math.abs(p.x - 20) < 1);
  assert.ok(crossing && Math.abs(crossing.z - 30) < 4, `crosses the wall at the gap (z=${crossing?.z})`);
  assert.ok(length(result.path) > 60, 'detour is longer than the straight line');
  for (const p of result.raw) {
    for (const o of obstacles) assert.ok(Math.hypot(p.x - o.x, p.z - o.z) > o.radius, 'never inside an obstacle');
  }
});

test('a cliff steeper than maxGrade is avoided, a gentle detour is preferred', () => {
  // A 30 m high plateau for z > 10 except a ramp corridor around x = 30.
  const height = (x, z) => (z > 10 && Math.abs(x - 30) > 6 ? 30 : z > 10 ? Math.min(30, (z - 10) * 0.4) : 0);
  const result = findPath({ x: 0, z: 0 }, { x: 0, z: 40 }, { height, margin: 40 });
  assert.ok(result, 'a path exists');
  assert.ok(result.raw.some(p => Math.abs(p.x - 30) <= 6 && p.z > 12), 'climbs through the ramp corridor');
});

test('returns null when the goal is walled off', () => {
  const obstacles = [];
  for (let a = 0; a < Math.PI * 2; a += 0.05) obstacles.push({ x: 30 + Math.cos(a) * 8, z: Math.sin(a) * 8, radius: 0.8 });
  assert.equal(findPath({ x: 0, z: 0 }, { x: 30, z: 0 }, { height: flat, obstacles }), null);
});

test('long trips coarsen the grid instead of exploding its size', () => {
  const result = findPath({ x: -150, z: 0 }, { x: 150, z: 20 }, { height: flat });
  assert.ok(result.cell > 2, `cell grew to ${result.cell}`);
  assert.ok(result.explored.length < 150 * 150);
});
