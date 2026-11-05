// Diamond · the Workers' Stockade (Phase 2): crystal-barred fence wrapped in violet Triad chains, a
// sealed gate under the Triad sigil, a camp of KayKit Medieval Hexagon tents and wreckage, a violet
// sentry tower, and six workers. When the relay's pulse runs (stage 'report'), the buried conduit
// lights from the escape-gate port to the gate, the sigil breaks, the chains shatter to the ground,
// the gate swings open and the workers walk out. Timing and positions: src/models/diamondStockade.js.
import { loadModel } from './models.js';
import { stockadeLayout, workerAt, releaseState, GATE_HALF, RELEASE } from '../models/diamondStockade.js';
import { STOCKADE } from '../models/diamond.js';

const HEX = 'assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/';
const PARTICLES = 'assets/kenney_particle-pack/PNG (Transparent)/';
const VIOLET = new THREE.Color(0xb48cff), IRON = new THREE.Color(0x4a4650);
const CONDUIT_OFF = new THREE.Color(0x2a3340), CONDUIT_ON = new THREE.Color(0xbff3ff), CONDUIT_HEAD = new THREE.Color(0xffffff);
// [model path, u, v, height, collider radius]
const CAMP = [
  ...[[33, -66], [40, -67], [48, -67], [55, -66], [31, -57]].map(([u, v]) => ['decoration/props/tent', u, v, 2.4, 1.4]),
  ['buildings/yellow/building_well_yellow', 44, -59, 3.2, 1.3],
  ['buildings/neutral/building_destroyed', 31, -45, 3.5, 2.2],
  ['buildings/neutral/building_scaffolding', 55, -57, 5, 2.2],
  ...[[37, -58], [38.2, -59.2], [50, -58]].map(([u, v]) => ['decoration/props/sack', u, v, 0.7, 0.4]),
  ...[[35, -61], [52, -61], [46, -70]].map(([u, v]) => ['decoration/props/barrel', u, v, 1, 0.5]),
  ...[[29.5, -70], [31, -71.3], [58, -62]].map(([u, v]) => ['decoration/props/crate_A_big', u, v, 1, 0.6]),
  ...[[42, -55], [36, -70]].map(([u, v]) => ['decoration/props/wheelbarrow', u, v, 0.9, 0.6]),
  ...[[58.5, -50], [29.5, -51]].map(([u, v]) => ['decoration/props/resource_stone', u, v, 0.9, 0.7]),
  ...[[45.5, -57.2], [42.6, -60.6]].map(([u, v]) => ['decoration/props/bucket_water', u, v, 0.5, 0.3]),
  ...[[49, -71], [51.2, -71]].map(([u, v]) => ['decoration/props/pallet', u, v, 0.3, 0.6]),
];
const SENTRY = { path: 'buildings/red/building_tower_A_red', u: 57.4, v: -41.5, height: 10, radius: 2.2 };
const WORKER_TINTS = [0x5a4a3a, 0x4d4a44, 0x6a5440, 0x4a4036, 0x5c5146, 0x3f3a33];
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// kingdom: world.diamond. surfaceHeight(x, z): drawn ground. actor(def): npcs.actor, null until loaded.
export function buildDiamondStockade({ scene, kingdom, surfaceHeight, actor }) {
  const root = new THREE.Group(); root.name = 'diamond-stockade'; scene.add(root);
  const layout = stockadeLayout(kingdom);
  const colliders = [];
  const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const into = (() => { const a = kingdom.at(0, 0), b = kingdom.at(1, 0); return Math.atan2(b.x - a.x, b.z - a.z); })();
  const ground = p => surfaceHeight(p.x, p.z);
  const quarry = kingdom.layout.center;
  const texture = name => new THREE.TextureLoader().load(encodeURI(PARTICLES + name));

  const slate = new THREE.MeshStandardMaterial({ color: 0x3e4552, roughness: 0.85, flatShading: true });
  const barMat = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0x2a4f70, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.3, flatShading: true });
  const chainMat = new THREE.MeshStandardMaterial({ color: VIOLET.clone(), emissive: 0x5a1f9a, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.7 });

  // --- Fence posts and crystal bars. ---
  const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.38, 3.4, 6), slate, layout.posts.length);
  layout.posts.forEach((p, i) => {
    dummy.position.set(p.x, ground(p) + 1.7, p.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); postMesh.setMatrixAt(i, dummy.matrix);
    colliders.push({ x: p.x, z: p.z, radius: 0.45 });
  });
  const bars = [];
  for (const [a, b] of layout.runs) {
    const n = Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 0.45);
    for (let s = 1; s < n; s++) bars.push({ x: a.x + (b.x - a.x) * s / n, z: a.z + (b.z - a.z) * s / n });
    for (let s = 0.5; s < n; s += 1.2) { const t = s / n; colliders.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, radius: 0.35 }); }
  }
  const barMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 2.9, 6), barMat, bars.length);
  bars.forEach((p, i) => { dummy.position.set(p.x, ground(p) + 1.45, p.z); dummy.updateMatrix(); barMesh.setMatrixAt(i, dummy.matrix); });
  root.add(postMesh, barMesh);

  // --- The gate: two barred leaves hinged on the gap's posts. ---
  const g = layout.gate, gy = ground(g.centre);
  const across = new THREE.Vector3(...(() => { const a = kingdom.at(44 - 1, STOCKADE.v1), b = kingdom.at(44 + 1, STOCKADE.v1); return [b.x - a.x, 0, b.z - a.z]; })()).normalize();
  const leaves = [-1, 1].map(side => {
    const hinge = new THREE.Group();
    hinge.position.set(g.centre.x + across.x * side * GATE_HALF, gy, g.centre.z + across.z * side * GATE_HALF);
    hinge.rotation.y = Math.atan2(across.x, across.z); // local +z runs along the fence
    for (let s = 0.25; s < GATE_HALF; s += 0.42) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 6), barMat);
      bar.position.set(0, 1.4, -side * s); hinge.add(bar);
    }
    for (const y of [0.5, 2.5]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, GATE_HALF), slate); rail.position.set(0, y, -side * GATE_HALF / 2); hinge.add(rail); }
    root.add(hinge);
    return { hinge, side, base: hinge.rotation.y };
  });
  const gateBlock = { x: g.centre.x, z: g.centre.z, radius: GATE_HALF - 0.2 };
  colliders.push(gateBlock);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2 * GATE_HALF + 1.2), slate);
  lintel.position.set(g.centre.x, gy + 3.6, g.centre.z);
  lintel.rotation.y = Math.atan2(across.x, across.z);
  root.add(lintel);

  // --- Violet chains: two rows of links along every run and across the gate. ---
  const linkPath = [...layout.runs, [-1, 1].map(s => ({ x: g.centre.x + across.x * s * GATE_HALF, z: g.centre.z + across.z * s * GATE_HALF }))];
  const links = [];
  for (const [a, b] of linkPath) {
    const n = Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 0.3), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (const row of [1.0, 2.1]) for (let s = 0; s < n; s++) {
      const x = a.x + (b.x - a.x) * s / n, z = a.z + (b.z - a.z) * s / n, k = links.length;
      links.push({ x, z, y: surfaceHeight(x, z) + row + Math.sin(s * 0.9) * 0.06, yaw, roll: s % 2 ? Math.PI / 2 : 0,
        vx: (hash(k, 1) - 0.5) * 5, vy: 2 + hash(k, 2) * 4, vz: (hash(k, 3) - 0.5) * 5, spin: (hash(k, 4) - 0.5) * 20, floor: surfaceHeight(x, z) + 0.05 });
    }
  }
  const linkMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.13, 0.035, 4, 8), chainMat, links.length);
  linkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(linkMesh);
  function placeLinks(t) {             // t: seconds into the shatter (0 = whole)
    links.forEach((l, i) => {
      if (t <= 0) dummy.position.set(l.x, l.y, l.z);
      else dummy.position.set(l.x + l.vx * t, Math.max(l.floor, l.y + l.vy * t - 4.9 * t * t), l.z + l.vz * t);
      dummy.rotation.set(l.roll + l.spin * Math.min(t, 0.8), l.yaw, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      linkMesh.setMatrixAt(i, dummy.matrix);
    });
    linkMesh.instanceMatrix.needsUpdate = true;
  }
  placeLinks(0);

  // --- The Triad sigil over the gate: three interlocked violet rings and a magic glow. ---
  const sigil = new THREE.Group(); sigil.position.set(g.centre.x, gy + 5.4, g.centre.z); root.add(sigil);
  const ringMat = new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true });
  const rings = [0, 1, 2].map(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 6, 24), ringMat); r.rotation.set(i * Math.PI / 3, i * 1.1, 0); sigil.add(r); return r; });
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture('magic_02.png'), color: VIOLET, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.scale.set(4, 4, 1); sigil.add(aura);
  // Sparks when the sigil breaks.
  const sparkMat = new THREE.SpriteMaterial({ map: texture('spark_04.png'), color: 0xe9dcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparks = Array.from({ length: 24 }, (_, i) => {
    const sp = new THREE.Sprite(sparkMat); sp.visible = false; root.add(sp);
    const a = i / 24 * Math.PI * 2, e = (hash(i, 9) - 0.3) * 1.4;
    return { sp, dir: new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e) + 0.3, Math.sin(a) * Math.cos(e)).multiplyScalar(4 + hash(i, 8) * 4) };
  });

  // --- The buried conduit from the relay's escape gate: dark until the pulse runs along it. ---
  const conduit = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.06, 0.84), new THREE.MeshBasicMaterial({ color: 0xffffff }), layout.conduit.length - 1);
  for (let i = 0; i < layout.conduit.length - 1; i++) {
    const a = layout.conduit[i], b = layout.conduit[i + 1];
    dummy.position.set((a.x + b.x) / 2, (ground(a) + ground(b)) / 2 + 0.05, (a.z + b.z) / 2); dummy.rotation.set(0, 0, 0);
    dummy.lookAt(b.x, ground(b) + 0.05, b.z); dummy.updateMatrix();
    conduit.setMatrixAt(i, dummy.matrix); conduit.setColorAt(i, CONDUIT_OFF);
  }
  root.add(conduit);

  // --- Camp models (KayKit Medieval Hexagon Pack) and the violet sentry tower. ---
  const byModel = new Map();
  for (const item of CAMP) { if (!byModel.has(item[0])) byModel.set(item[0], []); byModel.get(item[0]).push(item); }
  for (const [path, list] of byModel) {
    loadModel(encodeURI(`${HEX}${path}.gltf`), list[0][3]).then(({ object }) => {
      for (const [, u, v, height] of list) {
        const p = kingdom.at(u, v), copy = object.clone(true);
        copy.scale.multiplyScalar(height / list[0][3]);
        copy.position.set(p.x, surfaceHeight(p.x, p.z), p.z); copy.rotation.y = into + hash(u, v) * Math.PI * 2;
        root.add(copy);
      }
    }).catch(error => console.warn(`Stockade: ${path} unavailable.`, error));
    for (const [, u, v, , radius] of list) colliders.push({ ...kingdom.at(u, v), radius });
  }
  const sentryAt = kingdom.at(SENTRY.u, SENTRY.v);
  loadModel(encodeURI(`${HEX}${SENTRY.path}.gltf`), SENTRY.height).then(({ object }) => {
    object.traverse(child => { if (child.isMesh) { child.material = child.material.clone(); child.material.color.lerp(VIOLET, 0.55); } });
    object.position.set(sentryAt.x, surfaceHeight(sentryAt.x, sentryAt.z), sentryAt.z); object.rotation.y = into;
    root.add(object);
  }).catch(error => console.warn('Stockade sentry tower unavailable.', error));
  colliders.push({ ...sentryAt, radius: SENTRY.radius });

  // --- Workers: villager mannequins, created once the NPC assets have loaded. ---
  let workers = null;
  function spawnWorkers() {
    const made = layout.workers.map((w, i) => actor?.({ body: i % 2 ? 'F' : 'M', tint: WORKER_TINTS[i] }));
    if (made.some(a => !a)) { made.forEach(a => a?.dispose()); return null; }
    made.forEach(a => root.add(a.group));
    return made;
  }

  let releasedAt = null, time = 0, wasFree = false, shown = -1, settled = false;
  const color = new THREE.Color();
  function reset() {
    releasedAt = null; shown = -1; settled = false;
    placeLinks(0); chainMat.color.copy(VIOLET); chainMat.emissiveIntensity = 0.9;
    for (let i = 0; i < conduit.count; i++) conduit.setColorAt(i, CONDUIT_OFF);
    conduit.instanceColor.needsUpdate = true;
    sigil.visible = true; sigil.scale.setScalar(1); ringMat.opacity = 1; aura.material.opacity = 1;
    for (const l of leaves) l.hinge.rotation.y = l.base;
    gateBlock.off = false;
    for (const s of sparks) s.sp.visible = false;
  }

  return {
    root, colliders, layout,
    // freed: the relay's pulse has run (stage 'report' or 'complete'). player: for distance culling.
    update(dt, chaos, freed, player) {
      time += dt;
      if (freed && !wasFree) releasedAt = time;
      if (!freed && wasFree) reset();
      wasFree = freed;
      const t = releasedAt === null ? null : time - releasedAt, st = releaseState(t);
      const near = Math.hypot(player.position.x - g.centre.x, player.position.z - g.centre.z) < 200;

      // Conduit: lit up to the pulse head.
      const lit = Math.floor(st.conduit * conduit.count);
      if (lit !== shown) {
        for (let i = 0; i < conduit.count; i++) conduit.setColorAt(i, i < lit - 2 ? CONDUIT_ON : i < lit ? CONDUIT_HEAD : CONDUIT_OFF);
        conduit.instanceColor.needsUpdate = true; shown = lit;
      }
      // Sigil: spins while held (faster in chaos), flares and fades when the pulse arrives.
      sigil.visible = st.sigil > 0;
      if (sigil.visible) {
        rings.forEach((r, i) => { r.rotation.y += dt * (0.6 + i * 0.3) * (1 + chaos * 2); });
        const flare = t === null ? 1 : 1 + (1 - st.sigil) * 1.5;
        sigil.scale.setScalar(flare); ringMat.opacity = st.sigil; aura.material.opacity = st.sigil * (0.7 + 0.3 * Math.sin(time * 3));
      }
      // Chains: shatter, fall and turn to dull iron on the ground.
      if (t !== null && t >= RELEASE.sigil && !settled) { placeLinks(Math.min(t - RELEASE.sigil, RELEASE.shatter)); settled = st.shatter >= 1; }
      chainMat.color.copy(color.copy(VIOLET).lerp(IRON, st.shatter));
      chainMat.emissiveIntensity = (1 - st.shatter) * (0.9 + chaos * 0.6 * Math.sin(time * 6));
      const sparkT = t === null ? -1 : t - RELEASE.sigil;
      for (const s of sparks) {
        s.sp.visible = sparkT >= 0 && sparkT < 1.2;
        if (s.sp.visible) { s.sp.position.copy(sigil.position).addScaledVector(s.dir, sparkT); s.sp.scale.setScalar(0.9 * (1.2 - sparkT)); }
      }
      // Gate leaves swing outward.
      for (const l of leaves) l.hinge.rotation.y = l.base + l.side * st.gate * 1.9;
      gateBlock.off = st.gate > 0.6;

      // Workers.
      if (!near) return;
      workers ||= spawnWorkers();
      if (!workers) return;
      layout.workers.forEach((w, i) => {
        const a = workers[i], p = t === null ? { ...w.from, walking: false, done: false } : workerAt(w, t);
        a.group.position.set(p.x, surfaceHeight(p.x, p.z), p.z);
        // Waiting: face the gate. Walking: face the way. Out: turn to look at the quarry and the relay.
        const look = p.done ? quarry : g.centre;
        a.group.rotation.y = p.walking ? p.heading : Math.atan2(look.x - p.x, look.z - p.z);
        a.play(p.walking ? 'Walk_Loop' : p.done ? 'Idle_Talking_Loop' : 'Idle_Loop');
        a.update(dt);
      });
    },
  };
}
