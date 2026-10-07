// Step off every Clover and Sky Garden surface in 8 directions and check the player can
// always walk or jump away: no pits between ledges, no sticking to walls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const cache = new Map();
function moduleUrl(file) {
  const key = file.href;
  if (!cache.has(key)) {
    const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,
      (_, q, path) => `from ${q}${moduleUrl(new URL(path, file))}${q}`);
    cache.set(key, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  return cache.get(key);
}
globalThis.THREE = { MathUtils: { clamp: (v, a, b) => Math.min(b, Math.max(a, v)) } };
const { createPlayerController } = await import(moduleUrl(new URL('../src/controllers/player.js', import.meta.url)));
const C = await import(moduleUrl(new URL('../src/models/cloverTerrain.js', import.meta.url)));
const S = await import(moduleUrl(new URL('../src/models/skyIsland.js', import.meta.url)));
class V { constructor(x=0,y=0,z=0){this.set(x,y,z);} set(x,y,z){Object.assign(this,{x,y,z});return this;} }
const sets = [['clover', C.CLOVER_SURFACES.filter(p => p.width > 0.5), (x, z) => C.cloverGround(x, z, 1.5), () => { const r = C.createCloverRecovery(); return pl => r.update(pl); }],
  ['sky', S.SKY_PLATFORMS, () => 0, () => pl => pl.position.y - 2.05 < 60 ? S.SKY_ARRIVAL : null]];
let bad = 0, checked = 0;
for (const [name, platforms, terrain, makeRecovery] of sets) for (const p of platforms) {
  for (let k = 0; k < 8; k++) {
    const yaw = k * Math.PI / 4;
    const state = { locked: true, chaos: .06, yaw, lastMoveAngle: 0, hintTimer: 0, pitch: 0 };
    const keys = new Set(['KeyW']);
    const player = { position: new V(), velocity: new V(), grounded: true };
    const c = createPlayerController({ state, keys, player, chunks: new Map(), terrainHeight: terrain, staticColliders: [], platforms, courseRecovery: makeRecovery() });
    const top = p.topAt ? p.topAt(p.x, p.z) : p.top;
    c.teleport({ x: p.x, z: p.z, top, yaw });
    let n = 0; const start = player.position.y;
    while (player.position.y > start - 0.3 && n++ < 900) c.update(1 / 60);
    if (n >= 900) continue; // walked onto connected surfaces only
    keys.clear(); for (let i = 0; i < 90; i++) c.update(1 / 60);
    checked++;
    const here = { x: player.position.x, z: player.position.z, y: player.position.y };
    let free = false;
    for (let d = 0; d < 8 && !free; d++) {
      const s2 = { ...state, yaw: d * Math.PI / 4 }; Object.assign(state, s2);
      const ox = player.position.x, oz = player.position.z; keys.add('KeyW');
      for (let i = 0; i < 60; i++) c.update(1 / 60);
      keys.clear();
      if (Math.hypot(player.position.x - ox, player.position.z - oz) > 2) free = true;
      // jumping out also counts
      if (!free) { player.jumpBuffer = .15; keys.add('KeyW'); for (let i = 0; i < 60; i++) c.update(1 / 60); keys.clear();
        if (Math.hypot(player.position.x - ox, player.position.z - oz) > 2) free = true; }
    }
    if (!free) { bad++; console.log(`STUCK ${name} platform(${p.x},${p.z},top ${p.top}) yaw ${yaw.toFixed(2)} at`, here); }
  }
}
assert.ok(checked > 300, `only ${checked} step-offs exercised`);
assert.equal(bad, 0, `${bad} step-offs left the player stuck`);
console.log(`ok: ${checked} step-offs, none stuck`);
