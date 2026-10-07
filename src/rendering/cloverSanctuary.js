import { loadModel } from './models.js';
import { CLOVER_VALLEY } from '../models/cloverTerrain.js';

export function createCloverSanctuary({ root, world, onReady }) {
  const colliders = [];
  const summit = CLOVER_VALLEY.find(p => p.x === 2 && p.top === 24);
  const stone = new THREE.MeshStandardMaterial({ color: 0x394138, roughness: 1, flatShading: true });
  const moss = new THREE.MeshStandardMaterial({ color: 0x344720, roughness: 1 });
  const floor = 24;
  function box(x, z, w, h, d, yaw = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
    mesh.position.set(x, floor + h / 2, z); mesh.rotation.y = yaw;
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    colliders.push({ x, z, radius: Math.hypot(w, d) / 2 });
  }
  // Broken courtyard walls leave the longitudinal summit route open.
  for (const [x, z, h] of [[-6, -516, 2.7], [-6, -511, 1.4], [11, -516, 3.3], [11, -511, 1.8]]) {
    box(x, z, 0.8, h, 3.4);
    const coping = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 3.4), moss);
    coping.position.set(x, floor + h, z); root.add(coping);
  }
  for (const x of [-2.5, 6.5]) box(x, -499, 0.8, 3.2, 0.9);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.42, 6, 12, Math.PI), stone);
  arch.position.set(2, floor + 3.2, -499); arch.castShadow = true; root.add(arch);
  for (const [x, z, height] of [[-6, -500, 2.5], [10, -500, 3], [-5, -526, 1.6], [10, -525, 2.1]]) box(x, z, 0.9, height, 0.9, 0.2);
  box(-6.5, -521, 3.4, 0.55, 0.7, -0.4);
  box(10, -520, 2.8, 0.6, 0.9, 0.3);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.7, 8), stone);
  pedestal.position.set(6, floor + 0.35, -505); pedestal.castShadow = pedestal.receiveShadow = true; root.add(pedestal);
  colliders.push({ x: 6, z: -505, radius: 1.35 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.05),
    new THREE.MeshStandardMaterial({ color: 0x92ddc2, emissive: 0x3d987b, emissiveIntensity: 0.7, roughness: 0.25 }));
  crystal.scale.y = 1.6; crystal.position.set(6, floor + 2.55, -505); root.add(crystal);
  const glow = new THREE.PointLight(0x7ddab2, 0.6, 10); glow.position.copy(crystal.position); root.add(glow);
  // The gateway owns its courtyard. No stepping-stone overlays cross it.
  const placements = [];
  for (const [x, z, model, height] of [[-6, -534, 'CommonTree_2', 5.5], [9, -533, 'CommonTree_3', 6],
    [-7, -506, 'CommonTree_1', 5], [10, -488, 'CommonTree_2', 5.5], [-5, -488, 'Pine_2', 5],
    [11, -522, 'Pine_1', 4.5]]) {
    placements.push({ x, z, model, height }); colliders.push({ x, z, radius: 0.85 });
  }
  for (const [cx, cz] of [[-6, -534], [9, -533], [-7, -506], [10, -488], [-5, -488], [11, -522]]) {
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4, radius = 1.1 + world.hash(i, cz) * 1.2;
      placements.push({ x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius,
        model: ['Bush_Common', 'Flower_4_Group', 'Clover_2', 'Rock_Medium_1', 'Plant_1'][i],
        height: [0.8, 0.4, 0.22, 0.4, 0.6][i] });
    }
  }
  for (const model of new Set(placements.map(p => p.model))) loadModel(
    encodeURI(`assets/Stylized Nature MegaKit[Standard]/glTF/${model}.gltf`), 1)
    .then(({ object }) => {
      for (const p of placements.filter(p => p.model === model && summit.contains(p.x, p.z, 0))) {
        const copy = object.clone(true); copy.scale.setScalar(p.height);
        copy.position.set(p.x, floor - 0.015, p.z); copy.rotation.y = world.hash(p.x, p.z) * Math.PI * 2; root.add(copy);
      }
      onReady?.(root);
    }).catch(error => console.warn(`Sanctuary ${model} unavailable.`, error));
  const particleCount = 32, positions = new Float32Array(particleCount * 3);
  const particleGeometry = new THREE.BufferGeometry(); particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0xa3eec8, size: 0.07, transparent: true, opacity: 0.65, depthWrite: false }));
  motes.frustumCulled = false; root.add(motes);
  let time = 0, arrived = false, arrivalTime = 0;
  function update(player, dt) {
    time += dt; crystal.rotation.y += dt * 0.4; crystal.position.y = floor + 2.55 + Math.sin(time * 1.3) * 0.12;
    arrivalTime = Math.max(0, arrivalTime - dt);
    const inside = Math.hypot(player.x - 2, player.z + 508) < 8 && Math.abs(player.y - floor - 2.05) < 1;
    if (inside && !arrived) { arrived = true; arrivalTime = 5; }
    for (let i = 0; i < particleCount; i++) {
      const a = world.hash(i, 941) * Math.PI * 2 + time * 0.12, r = 1 + world.hash(i, 942) * 3;
      positions.set([6 + Math.cos(a) * r, floor + 0.8 + ((time * 0.25 + world.hash(i, 943)) % 1) * 3.5, -505 + Math.sin(a) * r], i * 3);
    }
    particleGeometry.attributes.position.needsUpdate = true;
    return arrivalTime > 0 ? 'CLOVER SANCTUARY · THE ANCIENT GROVE' : inside ? 'CLOVER SANCTUARY · EXPLORE THE RUINS AND EAST OVERLOOK' : null;
  }
  return { colliders, update, reset() { time = 0; arrived = false; arrivalTime = 0; } };
}
