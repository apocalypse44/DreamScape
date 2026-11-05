// Diamond · Siege Yard and Barracks (Phase 4). Kenney Castle Kit siege engines, intact beside the
// wrecks the workers made of them, inside a sharpened log palisade; KayKit Medieval Hexagon barracks,
// archery range and a violet Triad sentry tower inside a slate wall; gold flags at both gates. In chaos
// the intact ballistas swing round to follow the player. Layout: src/models/diamondSiege.js.
import { loadModel } from './models.js';
import { siegeLayout } from '../models/diamondSiege.js';
import { DIAMOND_BASE } from '../models/diamond.js';

const HEX_PROPS = 'assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/decoration/props/';
const VIOLET = new THREE.Color(0xb48cff);
const FACE = { '+u': 0, '-u': Math.PI, '+v': -Math.PI / 2, '-v': Math.PI / 2 };   // kit front (+z) toward
const TRACK_RANGE = 50, CHAOS_START = 0.35;

// kingdom: world.diamond. surfaceHeight(x, z): drawn ground.
export function buildDiamondSiege({ scene, kingdom }) {
  const layout = siegeLayout(kingdom);
  const root = new THREE.Group(); root.name = 'diamond-siege'; scene.add(root);
  const a = kingdom.at(0, 0), b = kingdom.at(1, 0), yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const frame = new THREE.Group(); frame.position.set(a.x, DIAMOND_BASE, a.z); frame.rotation.y = yaw; root.add(frame);
  const local = (u, v, y = 0) => new THREE.Vector3(-v, y, u);
  const colliders = [];
  const dummy = new THREE.Object3D();

  // --- Kit models, loaded once per file and cloned. ---
  const tracked = [];
  const items = [...layout.yard, ...layout.barracks];
  const byPath = new Map();
  for (const it of items) { if (!byPath.has(it.path)) byPath.set(it.path, []); byPath.get(it.path).push(it); colliders.push({ x: it.x, z: it.z, radius: it.radius }); }
  for (const [path, list] of byPath) {
    loadModel(encodeURI(`assets/${path}`), list[0].height).then(({ object }) => {
      for (const it of list) {
        const copy = object.clone(true);
        copy.scale.multiplyScalar(it.height / list[0].height);
        copy.position.copy(local(it.u, it.v)); copy.rotation.y = FACE[it.facing];
        if (it.triad) copy.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.lerp(VIOLET, 0.55); } });
        frame.add(copy);
        if (it.track) tracked.push({ object: copy, base: copy.rotation.y, it });
      }
    }).catch(error => console.warn(`Siege Yard: ${path} unavailable.`, error));
  }

  // --- Log palisade round the Siege Yard: sharpened stakes, instanced. ---
  const logs = layout.palisade;
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.95, flatShading: true });
  const stakes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.26, 2.6, 6), stakeMat, logs.length);
  const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.6, 6), stakeMat, logs.length);
  logs.forEach((p, i) => {
    const lean = Math.sin(p.u * 3.1 + p.v * 1.7) * 0.04, h = 0.92 + Math.abs(Math.sin(p.u * 7 + p.v * 5)) * 0.16;
    dummy.position.copy(local(p.u, p.v, 1.3 * h)); dummy.rotation.set(lean, 0, -lean); dummy.scale.set(1, h, 1); dummy.updateMatrix(); stakes.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 2.6 * h + 0.3; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); tips.setMatrixAt(i, dummy.matrix);
    colliders.push({ x: p.x, z: p.z, radius: 0.5 });
  });
  stakes.castShadow = tips.castShadow = true;
  frame.add(stakes, tips);

  // --- Slate wall round the Barracks, with a brass coping. ---
  const wall = layout.wall;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.6, 1.04), new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.85, flatShading: true }), wall.length);
  const coping = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.12, 1.04), new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.8 }), wall.length);
  wall.forEach((p, i) => {
    const next = wall[(i + 1) % wall.length], alongU = Math.abs(next.u - p.u) > Math.abs(next.v - p.v);
    dummy.position.copy(local(p.u, p.v, 0.8)); dummy.rotation.set(0, alongU ? 0 : Math.PI / 2, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); blocks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 1.66; dummy.updateMatrix(); coping.setMatrixAt(i, dummy.matrix);
    colliders.push({ x: p.x, z: p.z, radius: 0.5 });
  });
  blocks.castShadow = true;
  frame.add(blocks, coping);

  // --- Flags: Diamond gold at the gates, Triad violet at the sentry post (KayKit hexagon flags). ---
  const flagFile = { gold: 'flag_yellow', triad: 'flag_red' };
  for (const kind of ['gold', 'triad']) {
    const list = layout.flags.filter(f => f.kind === kind);
    loadModel(encodeURI(`${HEX_PROPS}${flagFile[kind]}.gltf`), 4).then(({ object }) => {
      if (kind === 'triad') object.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.lerp(VIOLET, 0.7); } });
      for (const f of list) { const copy = object.clone(true); copy.position.copy(local(f.u, f.v)); copy.rotation.y = FACE['-v']; frame.add(copy); }
    }).catch(error => console.warn(`Siege Yard: ${flagFile[kind]} unavailable.`, error));
    for (const f of list) colliders.push({ x: f.x, z: f.z, radius: 0.3 });
  }

  const toPlayer = new THREE.Vector3();
  return {
    root, colliders, layout,
    update(dt, chaos, player) {
      // Intact ballistas track the player in chaos (they only aim), and settle back in calm.
      for (const t of tracked) {
        const d = Math.hypot(player.position.x - t.it.x, player.position.z - t.it.z);
        let target = t.base;
        if (chaos > CHAOS_START && d < TRACK_RANGE) {
          toPlayer.set(player.position.x, 0, player.position.z); frame.worldToLocal(toPlayer);
          target = Math.atan2(toPlayer.x - t.object.position.x, toPlayer.z - t.object.position.z);
        }
        let delta = target - t.object.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        t.object.rotation.y += delta * Math.min(1, dt * (0.8 + chaos));
      }
    },
  };
}
