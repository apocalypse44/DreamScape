// Tidewell, Heart's town of stopped mills, and the palace on the garden avenue (layout: models/heartTown.js).
// Dry while the current is stolen: an empty canal, still mill wheels, dry fountains and pools, dark
// lanterns, boats beached in the mud. Once the Tide Sigil is earned the town comes alive over
// a few seconds: water fills the canal, spring, fountains and pools, the wheels turn, lanterns light,
// flowers bloom along the banks and the boats float.
import { loadModel } from './models.js';
import { createWaterSurface } from './waterfall.js';
import { TOWN_Y, CANAL, WALL, HALL } from '../models/heartTown.js';

const RED = 'assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/red/';
const PROPS = 'assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/decoration/props/';
const NATURE = 'assets/Stylized Nature MegaKit[Standard]/glTF/';
const NEUTRAL = 'assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/buildings/neutral/';
const FANTASY = 'assets/Fantasy Props MegaKit[Standard]/Exports/glTF/';
const load = (url, height) => loadModel(encodeURI(url), height).catch(error => { console.warn('Tidewell model missing', url, error); return null; });
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function buildHeartTown({ scene, model, onReady }) {
  const layout = model.layout, town = layout.town, { at, local } = layout;
  const root = new THREE.Group();
  root.name = 'Heart · Tidewell';
  scene.add(root);
  const colliders = [], platforms = [];
  // What the camera boom collides with (city walls, the throne hall): it never passes through them.
  const obstacles = new THREE.Group();
  obstacles.name = 'Heart · Tidewell camera blockers';
  root.add(obstacles);
  // World yaw that turns a model's +z toward a point (KayKit fronts face +z).
  const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  const axisYaw = facing(at(0, 0), at(1, 0)); // along the canal
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9a79c, roughness: 0.9, flatShading: true });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x7a5a58, roughness: 0.95, flatShading: true });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a34, roughness: 0.9, flatShading: true });
  const lampOff = new THREE.Color(0x3a2a24), lampOn = new THREE.Color(0xffc477);
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4438, emissive: lampOff.clone(), emissiveIntensity: 1.6, roughness: 0.5 });
  const lakeWater = createWaterSurface('lake'), fallWater = createWaterSurface('fall'), poolWater = createWaterSurface('pool');
  const mesh = (geometry, material, x, y, z, yaw = 0, parent = root) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true;
    parent.add(m); return m;
  };
  const waters = []; // { object, fill(k) } brought in as the town comes alive

  // --- The canal: stone kerbs along both banks; water fills it once restored. ---
  const length = CANAL.to - CANAL.from;
  for (const side of [-1, 1]) {
    const p = at((CANAL.from + CANAL.to) / 2, side * (CANAL.half + CANAL.bank + 0.2));
    mesh(new THREE.BoxGeometry(0.5, 0.35, length), stone, p.x, TOWN_Y + 0.1, p.z, axisYaw);
  }
  const canalMid = at((CANAL.from + CANAL.to) / 2 + 1, 0);
  const canalWater = mesh(new THREE.PlaneGeometry(CANAL.half * 2 + 1.6, length + 4), lakeWater, canalMid.x, town.canalBottom, canalMid.z);
  canalWater.rotation.set(-Math.PI / 2, 0, axisYaw, 'YXZ');
  canalWater.castShadow = false;
  waters.push({ object: canalWater, fill: k => { canalWater.position.y = town.canalBottom + 0.2 + (CANAL.depth - 0.9) * k; } });

  // --- Fountains: the Listening Spring (the canal's source) and the two garden fountains. ---
  function fountain(p, radius, height) {
    mesh(new THREE.TorusGeometry(radius, 0.35, 6, 28), stone, p.x, TOWN_Y + 0.25, p.z).rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.35, 0.6, height, 8), stone, p.x, TOWN_Y + height / 2, p.z);
    mesh(new THREE.CylinderGeometry(radius * 0.4, 0.3, 0.4, 12), stone, p.x, TOWN_Y + height, p.z);
    colliders.push({ x: p.x, z: p.z, radius: radius + 0.3 });
    const pool = mesh(new THREE.CircleGeometry(radius - 0.1, 28), poolWater, p.x, TOWN_Y - 0.2, p.z);
    pool.rotation.x = -Math.PI / 2; pool.castShadow = false;
    const spill = mesh(new THREE.CylinderGeometry(radius * 0.4, radius * 0.55, height, 16, 4, true), fallWater, p.x, TOWN_Y + height / 2, p.z);
    spill.castShadow = false;
    waters.push({ object: pool, fill: k => { pool.position.y = TOWN_Y - 0.6 + 0.75 * k; } }, { object: spill, fill: k => { spill.scale.y = Math.max(0.01, k); } });
  }
  fountain(town.spring, town.spring.radius, 2.6);
  town.gardenFountains.forEach(p => fountain(p, 2.2, 1.8));

  // --- Mirror pools before the palace stair: stone rims, filled once restored. ---
  for (const p of town.mirrorPools) {
    const across = facing(at(0, 0), at(0, 1));
    for (const [da, ds, w, d] of [[-1.7, 0, 0.4, 8.4], [1.7, 0, 0.4, 8.4], [0, -4.2, 3.8, 0.4], [0, 4.2, 3.8, 0.4]]) {
      const q = local(p), r = at(q.along + da, q.side + ds);
      mesh(new THREE.BoxGeometry(w, 0.5, d), stone, r.x, TOWN_Y + 0.2, r.z, across);
    }
    mesh(new THREE.BoxGeometry(3, 0.1, 8), darkStone, p.x, TOWN_Y + 0.02, p.z, across);
    colliders.push({ x: p.x, z: p.z, radius: 2.2 });
    const water = mesh(new THREE.PlaneGeometry(3, 8), poolWater, p.x, TOWN_Y, p.z);
    water.rotation.set(-Math.PI / 2, 0, across, 'YXZ'); water.castShadow = false;
    waters.push({ object: water, fill: k => { water.position.y = TOWN_Y + 0.05 + 0.3 * k; } });
  }

  // --- Bridges over the canal: a stone deck with parapets, walkable at street level. ---
  for (const b of town.bridges) {
    const across = facing(at(b.along, 0), at(b.along, 1));
    mesh(new THREE.BoxGeometry(3, 0.5, CANAL.half * 2 + CANAL.bank * 2 + 1.5), stone, b.x, TOWN_Y + 0.25, b.z, across);
    for (const side of [-1, 1]) {
      const p = at(b.along + side * 1.4, 0);
      mesh(new THREE.BoxGeometry(0.3, 0.8, CANAL.half * 2 + CANAL.bank * 2 + 1.5), stone, p.x, TOWN_Y + 0.9, p.z, across);
    }
    platforms.push({ name: 'tidewell-bridge', x: b.x, z: b.z, width: 3, top: TOWN_Y + 0.5, bottom: TOWN_Y - 0.4, solid: true,
      contains: (x, z, pad = 0) => { const q = local({ x, z }); return Math.abs(q.along - b.along) <= 1.5 + pad && Math.abs(q.side) <= CANAL.half + CANAL.bank + 0.75 + pad; } });
  }

  // --- Lanterns along the banks and the avenue: dark until the current returns. ---
  const lanternSpots = [...town.lanterns, ...[-24, -32, -40].flatMap(side => [at(45, side), at(55, side)])];
  for (const p of lanternSpots) {
    mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.6, 6), wood, p.x, TOWN_Y + 1.3, p.z);
    mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), lampMaterial, p.x, TOWN_Y + 2.75, p.z);
    colliders.push({ x: p.x, z: p.z, radius: 0.25 });
  }

  // --- Paved streets and plazas: a warm rose cobble, a hair above the ground. ---
  const cobble = new THREE.MeshStandardMaterial({ color: 0xb98c80, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const r of town.streets) {
    const c = at((r.a0 + r.a1) / 2, (r.s0 + r.s1) / 2);
    mesh(new THREE.BoxGeometry(r.s1 - r.s0, 0.08, r.a1 - r.a0), cobble, c.x, TOWN_Y + 0.02, c.z, axisYaw + Math.PI / 2).castShadow = false;
  }

  // --- City walls: rose stone with battlements; solid to walk into. Towers are KayKit models (below). ---
  const wallStone = new THREE.MeshStandardMaterial({ color: 0xa8706c, roughness: 0.9, flatShading: true });
  const merlons = [];
  for (const w of town.walls) {
    const a = at(w.a0, w.s0), b = at(w.a1, w.s1), length = Math.hypot(b.x - a.x, b.z - a.z), yaw = facing(a, b);
    mesh(new THREE.BoxGeometry(WALL.thickness, WALL.height, length), wallStone, (a.x + b.x) / 2, TOWN_Y + WALL.height / 2 - 0.5, (a.z + b.z) / 2, yaw, obstacles);
    for (let d = 1; d < length - 0.5; d += 2.2) merlons.push({ x: a.x + (b.x - a.x) * d / length, z: a.z + (b.z - a.z) * d / length, yaw });
    const lo = { a: Math.min(w.a0, w.a1) - WALL.thickness / 2, A: Math.max(w.a0, w.a1) + WALL.thickness / 2,
      s: Math.min(w.s0, w.s1) - WALL.thickness / 2, S: Math.max(w.s0, w.s1) + WALL.thickness / 2 };
    platforms.push({ name: 'tidewell-wall', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, width: WALL.thickness, top: TOWN_Y + WALL.height - 0.5, bottom: TOWN_Y - 1, solid: true,
      contains: (x, z, pad = 0) => { const q = local({ x, z }); return q.along > lo.a - pad && q.along < lo.A + pad && q.side > lo.s - pad && q.side < lo.S + pad; } });
  }
  const merlonMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(WALL.thickness, 0.9, 1.1), wallStone, merlons.length);
  const dummy = new THREE.Object3D();
  merlons.forEach((m, i) => { dummy.position.set(m.x, TOWN_Y + WALL.height, m.z); dummy.rotation.y = m.yaw; dummy.updateMatrix(); merlonMesh.setMatrixAt(i, dummy.matrix); });
  merlonMesh.castShadow = true;
  obstacles.add(merlonMesh);

  // --- Boats beached in the dry canal; they float once it fills. ---
  const boats = town.boats.map(b => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 3.6), wood); hull.position.y = 0.3; boat.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.2, 4), wood); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, 0.3, 2.4); bow.scale.set(1, 1, 0.55); boat.add(bow);
    boat.position.set(b.x, town.canalBottom, b.z);
    boat.rotation.y = axisYaw + b.yaw;
    boat.traverse(o => { o.castShadow = true; });
    root.add(boat);
    return { boat, b };
  });

  // --- The palace: a stone plinth with a stair toward town, the red castle on top, flags at the corners. ---
  const P = town.palace, plinthTop = TOWN_Y + P.rise;
  const toTown = facing(P, at(P.along, 0));
  mesh(new THREE.BoxGeometry(P.plinth * 2, P.rise, P.plinth * 2), stone, P.x, TOWN_Y + P.rise / 2, P.z, toTown);
  const inPlinth = (x, z, pad = 0) => { const q = local({ x, z }); return Math.abs(q.along - P.along) <= P.plinth + pad && Math.abs(q.side - P.side) <= P.plinth + pad; };
  platforms.push({ name: 'palace-plinth', x: P.x, z: P.z, width: P.plinth * 2, top: plinthTop, bottom: TOWN_Y - 1, solid: true, contains: inPlinth });
  // The stair climbs from the avenue (side -52) to the plinth's edge (side -60).
  const stairFoot = P.side + P.plinth + 8, stairHead = P.side + P.plinth;
  const stair = mesh(new THREE.BoxGeometry(6, 0.4, Math.hypot(8, P.rise)), stone, P.stair.x, TOWN_Y + P.rise / 2, P.stair.z, toTown);
  stair.rotation.order = 'YXZ'; stair.rotation.x = Math.atan2(P.rise, 8); // high end at the plinth, low end on the avenue
  platforms.push({ name: 'palace-stair', x: P.stair.x, z: P.stair.z, width: 6, top: plinthTop, bottom: TOWN_Y - 1, solid: true, ramp: true,
    topAt: (x, z) => TOWN_Y + P.rise * Math.max(0, Math.min(1, (stairFoot - local({ x, z }).side) / 8)),
    contains: (x, z, pad = 0) => { const q = local({ x, z }); return Math.abs(q.along - P.along) <= 3 + pad && q.side <= stairFoot + pad && q.side >= stairHead - pad; } });
  buildHall(plinthTop);

  // Colliders are known up front (the game copies the list at startup, before models finish loading).
  for (const b of town.buildings) colliders.push({ x: b.x, z: b.z, radius: b.radius });
  colliders.push({ x: town.well.x, z: town.well.z, radius: town.well.radius });
  for (const mill of town.mills) { const body = at(mill.along, mill.side * 6.5); colliders.push({ x: body.x, z: body.z, radius: 2.6 }); }
  for (const p of town.towers) colliders.push({ x: p.x, z: p.z, radius: 3.2 });
  for (const p of town.windmills) colliders.push({ x: p.x, z: p.z, radius: 3.5 });
  for (const p of town.stalls) colliders.push({ x: p.x, z: p.z, radius: 1.2 });
  const wheels = [], fans = [], saws = [], blooms = [];
  const place = (object, p, y, yaw) => { object.position.set(p.x, y, p.z); object.rotation.y = yaw; root.add(object); return object; };
  const stallModels = [[`${FANTASY}Stall_Cart_Empty.gltf`, 3], [`${PROPS}tent.gltf`, 3.2]];
  const clutter = [['barrel', 1], ['crate_A_big', 1], ['sack', 0.7], ['crate_long_A', 0.8]];
  const jobs = [
    ...town.towers.map((p, i) => load(`${RED}building_tower_${i % 3 ? 'A' : 'B'}_red.gltf`, 15).then(m => { if (m) place(m.object, p, TOWN_Y - 0.5, i); })),
    ...town.windmills.map((p, i) => load(`${RED}building_windmill_red.gltf`, 14).then(m => {
      if (!m) return;
      place(m.object, p, TOWN_Y, i * 1.7 + 0.6);
      const fan = m.object.getObjectByName('building_windmill_top_fan_red'); if (fan) fans.push(fan);
    })),
    // Grain fields sit with their soil flush with the ground (the tile's soil is 61% of its height): you walk
    // through the crops rather than onto, or into, a raised block.
    ...town.fields.map((p, i) => load(`${NEUTRAL}building_grain.gltf`, 1.6).then(m => { if (m) place(m.object, p, TOWN_Y - 1.6 * 0.61 + 0.05, axisYaw + (i % 2) * Math.PI / 3); })),
    ...town.stalls.map((p, i) => load(stallModels[i % 2][0], stallModels[i % 2][1]).then(m => { if (m) place(m.object, p, TOWN_Y, facing(p, town.well)); })),
    ...town.stalls.flatMap((p, i) => [0, 1].map(k => {
      const [name, height] = clutter[(i + k) % clutter.length];
      return load(`${PROPS}${name}.gltf`, height).then(m => { if (m) place(m.object, { x: p.x + (k ? 1.6 : -1.4), z: p.z + (k ? 0.9 : 1.3) }, TOWN_Y, i + k); });
    })),
    ...town.buildings.map(b => load(`${RED}building_${b.model}_red.gltf`, b.height).then(m => {
      if (!m) return;
      place(m.object, b, TOWN_Y, facing(b, at(b.along, 0)));
      const saw = m.object.getObjectByName('building_lumbermill_saw_red'); if (saw) saws.push(saw);
    })),
    load(`${RED}building_well_red.gltf`, town.well.height).then(m => {
      if (!m) return;
      place(m.object, town.well, TOWN_Y, facing(town.well, at(town.well.along, 0)));
    }),
    ...town.mills.map(mill => load(`${RED}building_watermill_red.gltf`, 9).then(m => {
      if (!m) return;
      // The wheel is on the model's -z side: turn it toward the canal so it dips into the water.
      const toCanal = facing(mill, at(mill.along, 0));
      place(m.object, mill, TOWN_Y - 0.6, toCanal + Math.PI);
      const wheel = m.object.getObjectByName('building_watermill_wheel_red');
      if (wheel) wheels.push(wheel);
    })),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([da, ds]) => load(`${PROPS}flag_red.gltf`, 4).then(m => {
      if (m) place(m.object, at(P.along + da * (P.plinth - 1), P.side + ds * (P.plinth - 1)), plinthTop, toTown);
    })),
    ...town.flowers.map((p, i) => load(`${NATURE}${['Flower_3_Group', 'Flower_4_Group', 'Bush_Common_Flowers'][i % 3]}.gltf`, i % 3 === 2 ? 1.2 : 0.7).then(m => {
      if (!m) return;
      m.object.visible = false;
      blooms.push(place(m.object, p, TOWN_Y, i * 1.3));
    })),
  ];
  Promise.all(jobs).then(() => onReady?.(root));

  // --- The throne hall: a keep you walk into, like Spade's castle and Diamond's Artificers' Hall. Rose stone
  // walls with a doorway toward town, corner turrets with red cone roofs, a battlemented parapet; inside, a red
  // runner to the throne on its dais, two rows of columns, heart banners, rose windows and hanging lanterns. ---
  function buildHall(floor) {
    const { a0, a1, s0, s1, height: H, wall: T, door, doorHeight } = HALL, ac = (a0 + a1) / 2, sc = (s0 + s1) / 2;
    const hallStone = new THREE.MeshStandardMaterial({ color: 0xd8b4a8, roughness: 0.85, flatShading: true });
    const roofRed = new THREE.MeshStandardMaterial({ color: 0xb8323a, roughness: 0.7, flatShading: true });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd36b, roughness: 0.35, metalness: 0.75 });
    const velvet = new THREE.MeshStandardMaterial({ color: 0x9a1f34, roughness: 0.95 });
    const rose = new THREE.MeshStandardMaterial({ color: 0xff9ab0, emissive: 0xc8406a, emissiveIntensity: 0.7, roughness: 0.1, transparent: true, opacity: 0.85 });
    // A box on the town's own axes: dAlong along the canal axis, dSide across it.
    const box = (material, along, side, y, dAlong, h, dSide, parent = root) => {
      const p = at(along, side);
      return mesh(new THREE.BoxGeometry(dSide, h, dAlong), material, p.x, y, p.z, axisYaw, parent);
    };
    // Walls (solid to walk into, and camera blockers): [along, side, dAlong, dSide], full height.
    const doorLo = ac - door / 2, doorHi = ac + door / 2;
    const walls = [[ac, s0, a1 - a0 + T, T], [a0, sc, T, s1 - s0 + T], [a1, sc, T, s1 - s0 + T],
      [(a0 + doorLo) / 2, s1, doorLo - a0, T], [(doorHi + a1) / 2, s1, a1 - doorHi, T]];
    for (const [along, side, dA, dS] of walls) {
      box(hallStone, along, side, floor + H / 2, dA, H, dS, obstacles);
      platforms.push({ name: 'palace-hall-wall', ...at(along, side), top: floor + H, bottom: floor - 1, solid: true,
        contains: (x, z, pad = 0) => { const q = local({ x, z }); return Math.abs(q.along - along) < dA / 2 + pad && Math.abs(q.side - side) < dS / 2 + pad; } });
    }
    box(hallStone, ac, s1, floor + (doorHeight + H) / 2, door, H - doorHeight, T, obstacles);   // over the door
    box(hallStone, ac, sc, floor + H + 0.15, a1 - a0 + T, 0.3, s1 - s0 + T, obstacles);         // ceiling
    // The parapet's merlons and a gold band under them.
    for (let along = a0; along <= a1 + 0.01; along += 2.5) for (const side of [s0, s1]) box(hallStone, along, side, floor + H + 0.75, 1.1, 0.9, T + 0.1);
    for (let side = s0 + 2.5; side < s1 - 0.1; side += 2.5) for (const along of [a0, a1]) box(hallStone, along, side, floor + H + 0.75, T + 0.1, 0.9, 1.1);
    for (const side of [s0 - T / 2 - 0.05, s1 + T / 2 + 0.05]) box(gold, ac, side, floor + H - 0.4, a1 - a0 + T, 0.18, 0.1);
    // Corner turrets: a stone drum taller than the hall and a red cone roof.
    for (const along of [a0, a1]) for (const side of [s0, s1]) {
      const p = at(along, side);
      mesh(new THREE.CylinderGeometry(2.1, 2.3, H + 4, 10), hallStone, p.x, floor + (H + 4) / 2, p.z, 0, obstacles);
      mesh(new THREE.ConeGeometry(2.7, 4.2, 10), roofRed, p.x, floor + H + 6.1, p.z);
      colliders.push({ x: p.x, z: p.z, radius: 2.3 });
    }
    // The doorway: a gold frame, and the Heart crest above it facing town.
    for (const along of [doorLo - 0.15, doorHi + 0.15]) box(gold, along, s1 + T / 2 + 0.06, floor + doorHeight / 2, 0.3, doorHeight, 0.12);
    box(gold, ac, s1 + T / 2 + 0.06, floor + doorHeight + 0.15, door + 0.6, 0.3, 0.12);
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -1); heartShape.bezierCurveTo(-1.6, 0, -1.1, 1.2, 0, 0.55); heartShape.bezierCurveTo(1.1, 1.2, 1.6, 0, 0, -1);
    const crestGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.2, bevelEnabled: false });
    const crest = (along, side, y, scale) => {
      const p = at(along, side), c = new THREE.Mesh(crestGeo, velvet);
      c.position.set(p.x, y, p.z); c.rotation.y = toTown; c.scale.setScalar(scale); root.add(c);
    };
    crest(ac, s1 + T / 2 + 0.1, floor + doorHeight + 1.6, 1.1);
    // Rose windows along both long walls (through the wall, so they show inside and out).
    for (const along of [a0, a1]) for (const side of [s0 + 5, sc, s1 - 5]) box(rose, along, side, floor + 5.2, T + 0.12, 2.6, 1.6);
    // Inside: the runner, the dais and the throne.
    box(velvet, ac, (s1 + s0 + 5) / 2, floor + 0.03, 2.6, 0.04, s1 - s0 - 6);
    for (const k of [-1, 1]) box(gold, ac + k * 1.35, (s1 + s0 + 5) / 2, floor + 0.04, 0.1, 0.05, s1 - s0 - 6);
    const daisTop = floor + 0.4, daisSide = s0 + T / 2 + 2.4;
    box(stone, ac, daisSide, floor + 0.2, 9, 0.4, 4.8);
    box(gold, ac, daisSide + 2.42, floor + 0.39, 9, 0.04, 0.08);
    platforms.push({ name: 'palace-dais', ...at(ac, daisSide), top: daisTop, bottom: floor - 0.5, solid: false,
      contains: (x, z, pad = 0) => { const q = local({ x, z }); return Math.abs(q.along - ac) < 4.5 + pad && Math.abs(q.side - daisSide) < 2.4 + pad; } });
    const throneSide = s0 + T / 2 + 1.2;
    box(velvet, ac, throneSide, daisTop + 0.35, 1.6, 0.7, 1.2);           // seat
    box(velvet, ac, throneSide - 0.55, daisTop + 1.6, 1.6, 3.2, 0.25);    // back
    for (const k of [-1, 1]) box(gold, ac + k * 0.9, throneSide, daisTop + 0.6, 0.2, 1.2, 1.3);
    box(gold, ac, throneSide - 0.6, daisTop + 3.3, 1.9, 0.2, 0.3);
    crest(ac, throneSide - 0.45, daisTop + 3.9, 0.45);
    colliders.push({ ...at(ac, throneSide), radius: 1.1 });
    // Columns: two rows down the hall, gold capitals.
    for (const side of [s1 - 5, sc, s0 + 7]) for (const k of [-1, 1]) {
      const p = at(ac + k * 5.5, side);
      mesh(new THREE.CylinderGeometry(0.5, 0.6, H, 10), hallStone, p.x, floor + H / 2, p.z);
      mesh(new THREE.CylinderGeometry(0.8, 0.55, 0.5, 10), gold, p.x, floor + H - 0.25, p.z);
      colliders.push({ x: p.x, z: p.z, radius: 0.75 });
    }
    // Heart banners on the long walls' inner faces, between the windows.
    for (const along of [a0 + T / 2 + 0.06, a1 - T / 2 - 0.06]) for (const side of [s0 + 7.5, s1 - 7.5]) {
      box(velvet, along, side, floor + 5.5, 0.06, 4.4, 1.7);
      box(gold, along, side, floor + 7.75, 0.1, 0.14, 1.9);
    }
    // Lanterns hang from the ceiling; they light with the town (lampMaterial).
    for (const side of [s1 - 5, sc, s0 + 7]) {
      const p = at(ac, side);
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), gold, p.x, floor + H - 0.8, p.z);
      mesh(new THREE.OctahedronGeometry(0.4, 0), lampMaterial, p.x, floor + H - 1.9, p.z).scale.y = 1.5;
    }
    const glow = new THREE.PointLight(0xffc0a0, 1.1, 26, 1.6);
    const g = at(ac, sc); glow.position.set(g.x, floor + H - 2.5, g.z); root.add(glow);
  }


  // 0 = dry, 1 = fully alive. Starts when the sigil is earned; a load into a restored state is simply alive.
  let started = -1, time = 0, first = true, memory = null;
  return {
    root, colliders, platforms, obstacles,
    // A flashback's town: life 0..1 overrides the present while it plays; null hands it back.
    setMemory(life) { memory = life; },
    update(dt, view) { // view: where terrain streams (the player, or a cutscene's destination)
      time += dt;
      root.visible = Math.hypot(view.x - layout.gate.x, view.z - layout.gate.z) < 360;
      lakeWater.uniforms.uTime.value = fallWater.uniforms.uTime.value = poolWater.uniforms.uTime.value = time;
      if (model.sigil && started < 0) started = first ? -100 : time;
      if (!model.sigil) started = -1;
      first = false;
      const life = memory ?? (started < 0 ? 0 : smooth((time - started) / 5));
      for (const w of waters) { w.object.visible = life > 0; if (life > 0) w.fill(life); }
      for (const wheel of wheels) wheel.rotation.z -= dt * 0.9 * life;
      for (const saw of saws) saw.rotation.x += dt * 6 * life;
      for (const fan of fans) fan.rotation.z += dt * (0.15 + 0.6 * life); // the wind never stopped; the mills grind again
      lampMaterial.emissive.copy(lampOff).lerp(lampOn, life);
      for (const f of blooms) { f.visible = life > 0.3; f.scale.setScalar(Math.max(0.01, smooth((life - 0.3) / 0.7))); }
      for (const { boat, b } of boats) {
        boat.position.y = town.canalBottom + (CANAL.depth - 0.9) * life + 0.05 * life * Math.sin(time * 1.3 + b.x);
        boat.rotation.z = (1 - life) * 0.28 * Math.sign(b.yaw || 1); // beached on its side, then upright
      }
    },
  };
}
