import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Load browser ES modules without adding a package/build dependency to the game.
const cache = new Map();
function moduleUrl(file) {
  const key = file.href;
  if (!cache.has(key)) {
    const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,
      (_, quote, path) => `from ${quote}${moduleUrl(new URL(path, file))}${quote}`);
    cache.set(key, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }
  return cache.get(key);
}
const { createPlayerController } = await import(moduleUrl(new URL('../src/controllers/player.js', import.meta.url)));
const { createRecovery } = await import(moduleUrl(new URL('../src/models/recovery.js', import.meta.url)));
const { WATERFALL_CLIMB, WATERFALL_CHECKPOINT, createWaterfallCourseRecovery } = await import(moduleUrl(new URL('../src/models/waterfall.js', import.meta.url)));
const { RIDGE_PATH, ridgeTerrain } = await import(moduleUrl(new URL('../src/models/ridge.js', import.meta.url)));
const { CLOVER_ENTRANCE, CLOVER_PLATEAUS, CLOVER_SURFACES, CLOVER_JUMPS, CLOVER_WALK_ROUTE, CLOVER_ASCENT_JUMPS, cloverGround, createCloverRecovery } =
  await import(moduleUrl(new URL('../src/models/cloverTerrain.js', import.meta.url)));
class Vector {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
}
const { SKY_PLATFORMS, SKY_ARRIVAL, SUMMIT_ARRIVAL, SKY_JUMPS, SKY_SECRET, SKY_WALK_ROUTE, createSkyJourney } =
  await import(moduleUrl(new URL('../src/models/skyIsland.js', import.meta.url)));
globalThis.THREE = { MathUtils: { clamp: (v, a, b) => Math.min(b, Math.max(a, v)) } };
function fixture(terrainHeight = () => 0, platforms = [], options = {}) {
  const state = { locked: true, chaos: 0.06, yaw: 0, lastMoveAngle: 0, hintTimer: 0 };
  const keys = new Set();
  const player = { position: new Vector(0, 2.05, 0), velocity: new Vector(), grounded: true };
  const controller = createPlayerController({ state, keys, player, chunks: new Map(), terrainHeight, staticColliders: [], platforms, ...options });
  controller.reset();
  return { state, keys, player, controller };
}
function frames(f, count, dt = 1 / 60) { for (let i = 0; i < count; i++) f.controller.update(dt); }

test('sky garden main route climbs the shrine ramp and walks to the lookout', () => {
  const f=fixture(()=>0,SKY_PLATFORMS,{staticColliders:[{x:67,z:-563,radius:2,minY:68,maxY:72}]});
  f.controller.teleport(SKY_ARRIVAL);f.keys.add('KeyW');
  for(const [x,z] of SKY_WALK_ROUTE) {
    let count=0;
    while(Math.hypot(x-f.player.position.x,z-f.player.position.z)>.2 && count++<1400) {
      f.state.yaw=Math.atan2(-(x-f.player.position.x),-(z-f.player.position.z));f.controller.update(1/120);
    }
    assert.ok(count<1400,`sky route blocked at ${x},${z}`);
    assert.ok(f.player.position.y>=66.04,`route fell at ${x},${z}`);
  }
});
test('sky floating ledges can be reached with ordinary jumps',()=>{
  const f=fixture(()=>0,SKY_PLATFORMS);f.controller.teleport({x:93,z:-560,top:64});
  for(const p of [...SKY_JUMPS,SKY_SECRET]) {
    f.player.jumpBuffer=.15;f.keys.add('KeyW');let count=0;
    while(Math.hypot(p.x-f.player.position.x,p.z-f.player.position.z)>.25 && count++<240) {
      f.state.yaw=Math.atan2(-(p.x-f.player.position.x),-(p.z-f.player.position.z));f.controller.update(1/120);
    }
    f.keys.clear();frames(f,60);assert.ok(count<240);
    assert.ok(Math.abs(f.player.position.y-p.top-2.05)<.001,`sky landing ${p.x},${p.z}: ${f.player.position.y}`);
  }
  for(const p of [...SKY_JUMPS].reverse().concat({x:93,z:-560,top:64})) {
    f.player.jumpBuffer=.15;f.keys.add('KeyW');let count=0;
    while(Math.hypot(p.x-f.player.position.x,p.z-f.player.position.z)>.25 && count++<240) {
      f.state.yaw=Math.atan2(-(p.x-f.player.position.x),-(p.z-f.player.position.z));f.controller.update(1/120);
    }
    f.keys.clear();frames(f,60);assert.ok(count<240);
    assert.ok(Math.abs(f.player.position.y-p.top-2.05)<.001,`return landing ${p.x},${p.z}`);
  }
});
test('teleport clears momentum, buffered jumps and camera angles; island recovery uses explicit height',()=>{
  const j=createSkyJourney();j.update(4,{x:2,y:26.05,z:-499},true,true);
  const f=fixture(()=>3,SKY_PLATFORMS,{courseRecovery:p=>j.recovery(p)});
  f.player.velocity.set(9,10,9);f.player.jumpBuffer=.15;f.state.pitch=1;f.controller.teleport(SKY_ARRIVAL);
  assert.deepEqual({...f.player.velocity},{x:0,y:0,z:0});assert.equal(f.player.jumpBuffer,0);assert.equal(f.state.pitch,0);
  f.player.position.set(120,59,-552);f.player.grounded=false;frames(f,1);
  assert.equal(f.player.position.y,66.05);assert.equal(f.player.position.x,72);
  f.controller.teleport(SUMMIT_ARRIVAL);assert.equal(f.player.position.y,26.05);
});
test('portal fade blocks movement and island obstacles respect vertical bounds',()=>{
  let blocked=true;
  const f=fixture(()=>0,SKY_PLATFORMS,{isMovementBlocked:()=>blocked,staticColliders:[{x:72,z:-544,radius:1,minY:0,maxY:5}]});
  f.controller.teleport(SKY_ARRIVAL);f.keys.add('KeyW');f.player.jumpBuffer=.15;frames(f,20);
  assert.equal(f.player.position.z,SKY_ARRIVAL.z);assert.equal(f.player.position.y,66.05);
  blocked=false;frames(f,30);assert.ok(f.player.position.z<-544);
});
test('summit edge falls recover above the plateau even beyond the reserved ravine',()=>{
  const r=createCloverRecovery();
  const f=fixture((x,z)=>cloverGround(x,z,1.5),CLOVER_SURFACES,{courseRecovery:p=>r.update(p)});
  f.controller.teleport({x:2,z:-510,top:24});frames(f,2);
  f.player.position.set(60,20,-510);f.player.velocity.y=-15;f.player.grounded=false;frames(f,1);
  assert.equal(f.player.position.x,2);assert.equal(f.player.position.z,-534);assert.equal(f.player.position.y,26.05);
  frames(f,30);assert.equal(f.player.grounded,true);assert.equal(f.player.position.y,26.05);
});

test('the high valley walking route reaches the 24 m summit without jumping', () => {
  const f = fixture((x, z) => cloverGround(x, z, 20), CLOVER_SURFACES);
  f.player.position.set(0, 14.05, -437); f.controller.reset(); f.keys.add('KeyW');
  for (const [x, z] of CLOVER_WALK_ROUTE.slice(1)) {
    let count = 0;
    while (Math.hypot(x - f.player.position.x, z - f.player.position.z) > 0.2 && count++ < 1200) {
      f.state.yaw = Math.atan2(-(x - f.player.position.x), -(z - f.player.position.z));
      f.controller.update(1 / 120);
    }
    assert.ok(count < 1200, `walking ledge blocked at ${x}, ${z}`);
  }
  assert.ok(Math.abs(f.player.position.y - 26.05) < 0.001);
});

test('the high valley rock ascent reaches each successive landing', () => {
  const f = fixture((x, z) => cloverGround(x, z, 1.5), CLOVER_SURFACES);
  f.player.position.set(-8, 14.05, -447); f.controller.reset();
  for (const p of CLOVER_ASCENT_JUMPS) {
    f.player.jumpBuffer = 0.15; f.keys.add('KeyW');
    let count = 0;
    while (Math.hypot(p.x - f.player.position.x, p.z - f.player.position.z) > 0.3 && count++ < 200) {
      f.state.yaw = Math.atan2(-(p.x - f.player.position.x), -(p.z - f.player.position.z));
      f.controller.update(1 / 120);
    }
    f.keys.clear(); frames(f, 60);
    assert.ok(count < 200);
    assert.ok(Math.abs(f.player.position.y - p.top - 2.05) < 0.001, `rock ascent ${p.z}`);
  }
});

test('the east overlook loop reconnects to the lower plateau', () => {
  const f = fixture((x, z) => cloverGround(x, z, 20), CLOVER_SURFACES);
  f.player.position.set(0, 14.05, -437); f.controller.reset(); f.keys.add('KeyW');
  const points = [[10, -437], [17, -437], [17, -455], [27, -455], [27, -458],
    [27, -455], [17, -455], [17, -437], [0, -437]];
  for (const [x, z] of points) {
    let count = 0;
    while (Math.hypot(x - f.player.position.x, z - f.player.position.z) > 0.2 && count++ < 600) {
      f.state.yaw = Math.atan2(-(x - f.player.position.x), -(z - f.player.position.z)); f.controller.update(1 / 120);
    }
    assert.ok(count < 600, `overlook blocked ${x}, ${z}`);
    assert.ok(Math.abs(f.player.position.y - 14.05) < 0.001, `overlook support ${x}, ${z}: ${f.player.position.y}`);
  }
});

test('the sanctuary overlook loop returns to the upper courtyard', () => {
  const f = fixture((x, z) => cloverGround(x, z, 20), CLOVER_SURFACES);
  f.player.position.set(2, 26.05, -528); f.controller.reset(); f.keys.add('KeyW');
  for (const [x, z] of [[21, -528], [21, -505], [25, -505], [21, -505], [21, -492], [2, -492], [2, -510]]) {
    let count = 0;
    while (Math.hypot(x - f.player.position.x, z - f.player.position.z) > 0.2 && count++ < 800) {
      f.state.yaw = Math.atan2(-(x - f.player.position.x), -(z - f.player.position.z)); f.controller.update(1 / 120);
    }
    assert.ok(count < 800);
    assert.ok(Math.abs(f.player.position.y - 26.05) < 0.001);
  }
});

test('Clover plateaus and sloping bridges can all be walked without jumping', () => {
  for (const original of [-5, 1.5, 20]) {
    const f = fixture((x, z) => cloverGround(x, z, original), CLOVER_SURFACES);
    f.player.position.set(0, 3.55, CLOVER_ENTRANCE.z);
    f.controller.reset(); f.keys.add('KeyW');
    for (const p of CLOVER_PLATEAUS) {
      let count = 0;
      while (f.player.position.z > p.z + 0.2 && count++ < 900) f.controller.update(1 / 120);
      assert.ok(count < 900, 'bridge or plateau must not block walking');
      assert.ok(Math.abs(f.player.position.y - p.top - 2.05) < 0.001);
      assert.equal(f.player.grounded, true);
    }
  }
});

test('both Clover stepping-rock shortcuts are reachable with ordinary jumps', () => {
  for (const [start, sequence] of [
    [{ x: 10, z: -377, top: 6 }, CLOVER_JUMPS.slice(0, 3)],
    [{ x: 11, z: -411, top: 9 }, CLOVER_JUMPS.slice(3)]
  ]) {
    const f = fixture((x, z) => cloverGround(x, z, 1.5), CLOVER_SURFACES);
    f.player.position.set(start.x, start.top + 2.05, start.z); f.controller.reset();
    for (const p of sequence) {
      f.player.jumpBuffer = 0.15; f.keys.add('KeyW');
      let count = 0;
      while (Math.hypot(p.x - f.player.position.x, p.z - f.player.position.z) > 0.3 && count++ < 180) {
        f.state.yaw = Math.atan2(-(p.x - f.player.position.x), -(p.z - f.player.position.z));
        f.controller.update(1 / 120);
      }
      f.keys.clear(); frames(f, 60);
      assert.ok(count < 180);
      assert.ok(Math.abs(f.player.position.y - p.top - 2.05) < 0.001, `land on Clover rock ${p.z}`);
    }
  }
});

test('Clover falls recover at the entrance and restart clears activation', () => {
  const recovery = createCloverRecovery();
  const player = { position: new Vector(0, 3.55, -336), velocity: new Vector() };
  assert.equal(recovery.update(player), null);
  player.position.set(20, 1, -405); player.velocity.y = -5;
  assert.deepEqual(recovery.update(player), CLOVER_ENTRANCE);
  recovery.reset();
  assert.equal(recovery.update(player), null);
});

test('the entire ridge spiral can be walked without jumping across chaos heights', () => {
  for (const original of [-5, 1.5, 20]) {
    const f = fixture((x, z) => ridgeTerrain(x, z, original));
    const start = RIDGE_PATH[0];
    f.player.position.set(start.x, start.y + 2.05, start.z);
    f.controller.reset();
    f.keys.add('KeyW');
    for (const point of RIDGE_PATH.slice(1)) {
      let steps = 0;
      while (Math.hypot(point.x - f.player.position.x, point.z - f.player.position.z) > 0.18 && steps++ < 120) {
        f.state.yaw = Math.atan2(-(point.x - f.player.position.x), -(point.z - f.player.position.z));
        f.controller.update(1 / 120);
      }
      assert.ok(steps < 120, 'walking route must not catch on a terrace');
      assert.ok(Math.abs(f.player.position.y - (point.y + 2.05)) < 0.25);
    }
  }
});

test('a missed waterfall jump returns to the entrance and restart clears course recovery', () => {
  const recovery = createWaterfallCourseRecovery();
  const p = WATERFALL_CLIMB[3];
  const player = { position: new Vector(p.x, p.top + 2.05, p.z), velocity: new Vector(), grounded: true };
  assert.equal(recovery.update(player), null);
  player.grounded = false;
  player.velocity.y = -5;
  player.position.y -= 3;
  assert.deepEqual(recovery.update(player), WATERFALL_CHECKPOINT);
  player.position.y = p.top + 2.05;
  player.grounded = true;
  recovery.update(player);
  recovery.reset();
  player.grounded = false;
  player.position.y -= 3;
  assert.equal(recovery.update(player), null);
});

test('all waterfall ledges can be reached with ordinary forward jumps', () => {
  const f = fixture(() => 1.5, WATERFALL_CLIMB);
  f.player.position.set(WATERFALL_CHECKPOINT.x, 3.55, WATERFALL_CHECKPOINT.z);
  f.controller.reset();
  for (const ledge of WATERFALL_CLIMB) {
    f.keys.add('KeyW');
    f.player.jumpBuffer = 0.15;
    frames(f, 24);
    f.keys.clear();
    frames(f, 30);
    assert.ok(Math.abs(f.player.position.y - (ledge.top + 2.05)) < 0.001, `land on ledge at ${ledge.top}`);
    assert.equal(f.player.grounded, true);
  }
});

test('solid rocks block walking through their sides and allow landing on their top', () => {
  const f = fixture(() => 0, [{ x: 0, z: -3, top: 1.7, bottom: -0.2, width: 2.4, depth: 2.4, solid: true }]);
  f.keys.add('KeyW');
  frames(f, 60);
  assert.ok(f.player.position.z > -1.25);
  f.player.jumpBuffer = 0.15;
  frames(f, 24);
  f.keys.clear();
  frames(f, 45);
  assert.equal(f.player.grounded, true);
  assert.ok(Math.abs(f.player.position.y - 3.75) < 0.001);
});

test('a 1.5 m ledge blocks walking but can be jumped onto', () => {
  const f = fixture((x, z) => z < -2 ? 1.5 : 0);
  f.keys.add('KeyW');
  frames(f, 60);
  assert.ok(f.player.position.z >= -2);
  f.player.jumpBuffer = 0.15;
  frames(f, 40);
  assert.ok(f.player.position.z < -2);
  assert.ok(Math.abs(f.player.position.y - 3.55) < 0.001);
});

test('falling above a slab does not teleport the player down to it', () => {
  const f = fixture(() => 0, [{ x: 0, z: 0, top: 3 }]);
  f.player.position.y = 12.05;
  f.player.grounded = false;
  f.player.coyote = 0;
  f.player.velocity.y = -1;
  frames(f, 1);
  assert.ok(f.player.position.y > 11);
  assert.equal(f.player.grounded, false);
  frames(f, 50);
  assert.ok(Math.abs(f.player.position.y - 5.05) < 0.001);
  assert.equal(f.player.grounded, true);
  frames(f, 360);
  assert.ok(Math.abs(f.player.position.y - 5.05) < 0.001, 'standing on a slab must not trigger recovery');
});

test('jump buffering before landing and coyote jumps still work', () => {
  const landing = fixture();
  landing.player.position.y = 2.08;
  landing.player.velocity.y = -3;
  landing.player.grounded = false;
  landing.player.coyote = 0;
  landing.player.jumpBuffer = 0.15;
  frames(landing, 1);
  assert.equal(landing.player.velocity.y, 10.5);
  assert.equal(landing.player.grounded, false);
  const coyote = fixture();
  coyote.player.grounded = false;
  coyote.player.jumpBuffer = 0.15;
  frames(coyote, 1);
  assert.ok(coyote.player.velocity.y > 10);
});

test('large course falls recover and reset clears momentum and buffered jumps', () => {
  const f = fixture();
  f.player.position.y = 22.05;
  f.player.velocity.y = -5;
  f.player.grounded = false;
  f.player.coyote = 0;
  frames(f, 90);
  assert.ok(Math.abs(f.player.position.y - 2.05) < 0.001);
  assert.equal(f.player.velocity.y, 0);
  f.player.velocity.set(5, -5, 5);
  f.player.jumpBuffer = 0.15;
  f.controller.reset();
  assert.deepEqual([f.player.velocity.x, f.player.velocity.y, f.player.velocity.z, f.player.jumpBuffer], [0, 0, 0, 0]);
});

test('recovery re-seats safe checkpoints after terrain changes and rejects hazards', () => {
  const player = { position: new Vector(0, 2.05, 0), velocity: new Vector(), grounded: true };
  let height = 0;
  let hazard = false;
  const recovery = createRecovery({ player, terrainHeight: () => height, collidesAt: () => false,
    isUnsafe: x => hazard && x > 5 });
  recovery.reset();
  player.position.x = 10;
  recovery.updateCheckpoint(1.1, true);
  height = 2;
  player.position.x = 20;
  recovery.respawn();
  assert.equal(player.position.x, 10);
  assert.equal(player.position.y, 4.05);
  hazard = true;
  recovery.respawn();
  assert.equal(player.position.x, 0);
});

test('slopes and airborne platforms cannot become safe-ground checkpoints', () => {
  const player = { position: new Vector(0, 2.05, 0), velocity: new Vector(), grounded: true };
  const recovery = createRecovery({ player, terrainHeight: x => x >= 9 ? (x - 9) * 2 : 0, collidesAt: () => false });
  recovery.reset();
  player.position.x = 5;
  recovery.updateCheckpoint(2, false);
  player.position.x = 10;
  recovery.updateCheckpoint(2, true);
  recovery.respawn();
  assert.equal(player.position.x, 0);
});
