// Samples the game's calm terrain and exports its structures into iso-map/atlas-data.json for the 3D atlas.
// Usage: node iso-map/bake.mjs [seed]   (same seed as ?seed= in the game URL)
import { writeFileSync } from 'node:fs';
const seed = process.argv[2] || '4242';
// ponytail: just enough browser/THREE stubs for the model modules
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MathUtils = { clamp, lerp: (a, b, t) => a + (b - a) * t,
  smoothstep: (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); } };
// any other THREE.X is a constructor/function whose results absorb every property access and call
const dummy = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : dummy, apply: () => dummy, construct: () => dummy });
globalThis.THREE = new Proxy({ MathUtils }, { get: (t, k) => t[k] ?? dummy });
globalThis.location = { search: `?seed=${seed}` };
globalThis.history = { replaceState() {} };
const m = p => import(new URL(`../src/${p}`, import.meta.url));
const { createWorld } = await m('models/world.js');
const { trailPoint } = await m('rendering/props.js');
const clover = await m('models/cloverTerrain.js');
const spade = await m('models/spade.js');
const { SHRINE } = await m('models/quest.js');
const { WATERFALL } = await m('models/waterfall.js');
const { RIDGE } = await m('models/ridge.js');
const { SKY, SKY_LAKE, SUMMIT_DOOR } = await m('models/skyIsland.js');
const { SPADE_MAP_LOCATIONS } = await m('models/spadeStory.js');
const world = createWorld({ scene: { add() {} }, state: { chaos: 0 }, player: {}, onChunk() {} });

const r1 = v => Math.round(v * 10) / 10;
const X0 = -590, Z0 = -610, CELL = 6, N = 196;      // 1176 m square
const h = [];
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) h.push(r1(world.heightAt(X0 + i * CELL, Z0 + j * CELL, 0.06)));

// boxes: [x, z, width (x), depth (z), bottom, top, outline?]
const box = p => [r1(p.x), r1(p.z), r1(p.width), r1(p.depth), r1(p.bottom ?? -7), r1(p.top), ...(p.outline ? [p.outline.map(q => q.map(r1))] : [])];
const cloverBoxes = [...clover.CLOVER_PLATEAUS, ...clover.CLOVER_VALLEY, ...clover.CLOVER_ASCENT_JUMPS, ...clover.CLOVER_RAMPS, ...clover.CLOVER_JUMPS].map(box);
const spadeBoxes = spade.spadeVolumes().filter(p => !p.topAt && p.width * p.depth >= 4).map(p => [...box(p), p.name || '']);
const houses = spade.SPADE_HOUSES.map(q => ({ x: -344 - q.u, z: q.v, w: q.depth, d: q.width, bottom: r1(spade.spadeHeight(-344 - q.u)), h: q.height, refuge: q.refuge }));
const mountains = spade.SPADE_MOUNTAINS.map(q => ({ x: -344 - q.u, z: q.v, rx: q.radiusX, rz: q.radiusZ, h: q.height, bottom: q.bottom, rot: q.rotation }));
const trails = [0, 1, 2, 3].map(i => { const p = []; for (let a = 20; a <= 350; a += 6) { const t = trailPoint(world.noise, i, a); p.push([r1(t.x), r1(t.z)]); } return p; });

const data = { seed: +seed, x0: X0, z0: Z0, cell: CELL, n: N, h, kingdomStart: world.kingdomStart, trails, cloverBoxes, spadeBoxes, houses, mountains,
  marks: { shrine: SHRINE, waterfall: WATERFALL, ridge: RIDGE, sky: SKY, skyLake: SKY_LAKE, summitDoor: SUMMIT_DOOR,
    cloverEntrance: clover.CLOVER_ENTRANCE, spadeGate: spade.SPADE_GATE, spade: SPADE_MAP_LOCATIONS.map(p => ({ id: p.id, name: p.name, x: p.x, z: p.z })) } };
writeFileSync(new URL('./atlas-data.json', import.meta.url), JSON.stringify(data));
console.log(`seed ${seed}: terrain ${Math.min(...h)}..${Math.max(...h)} m · clover ${cloverBoxes.length} · spade ${spadeBoxes.length} boxes, ${houses.length} houses, ${mountains.length} mountains · trails ${trails.map(t => t.length)}`);
