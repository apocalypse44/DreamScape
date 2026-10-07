import { PLAZA_ROUTES } from '../models/plaza.js';
import { loadModel } from './models.js';

export function createPlaza({ scene, world, onReady }) {
  const root = new THREE.Group(); root.name = 'Spawn plaza and landmark paths'; scene.add(root);
  const stone = new THREE.MeshStandardMaterial({ color: 0x49534b, roughness: 1, envMapIntensity: 0.15 });
  const pavingMaterial = new THREE.MeshStandardMaterial({ color: 0x515950, roughness: 1,
    envMapIntensity: 0.15, vertexColors: true });
  const wood = new THREE.MeshStandardMaterial({ color: 0x70543c, roughness: 1 });
  const colliders = [], seated = [];
  // One mesh for the paving, including individually spaced trail stones.
  const vertices = [], colors = [];
  function tile(x, z, width, depth, yaw) {
    const corners = [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]];
    const points = corners.map(([dx, dz]) => [x + dx * Math.cos(yaw) + dz * Math.sin(yaw),
      z - dx * Math.sin(yaw) + dz * Math.cos(yaw)]);
    const shade = 0.72 + world.hash(x + 71, z + 93) * 0.28;
    for (const i of [0, 2, 1, 0, 3, 2]) {
      vertices.push(points[i][0], 0, points[i][1]);
      colors.push(shade, shade, shade);
    }
  }
  for (let row = -9; row <= 9; row++) for (let column = -9; column <= 9; column++) {
    const x = column * 0.8 + (row % 2) * 0.4, z = row * 0.8;
    const r = Math.hypot(x, z);
    if (r > 7.2 || (r > 6.2 && world.hash(column, row + 812) > 0.6)) continue;
    const jitter = (world.hash(column + 811, row) - 0.5) * 0.06;
    tile(x + jitter, z, 0.72 + jitter, 0.69 - jitter, jitter * 0.7);
  }
  for (const route of PLAZA_ROUTES) for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const steps = Math.ceil(Math.hypot(dx, dz) / 1.25), yaw = Math.atan2(dx, dz);
    for (let j = 0; j < steps; j++) {
      const t = (j + 0.5) / steps, x = a[0] + dx * t, z = a[1] + dz * t;
      if (Math.hypot(x, z) > 7.7) {
        const jitter = (world.hash(i * 17 + j, x) - 0.5) * 0.15;
        tile(x, z, 0.85 + jitter, 0.75, yaw + jitter);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const paving = new THREE.Mesh(geometry, pavingMaterial); paving.receiveShadow = true; root.add(paving);
  function box(group, size, position, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  for (const x of [-8.8, 8.8]) {
    const bench = new THREE.Group(); bench.position.set(x, 0, 1); bench.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    box(bench, [2.4, 0.15, 0.75], [0, 0.6, 0], wood);
    box(bench, [2.4, 0.55, 0.12], [0, 1, -0.35], wood);
    for (const dx of [-0.85, 0.85]) box(bench, [0.2, 0.6, 0.55], [dx, 0.3, 0], stone);
    root.add(bench); seated.push(bench); colliders.push({ x, z: 1, radius: 1.3 });
  }
  const planters = [[-7, -6], [7, -6], [-5, 8], [5, 8]].map(([x, z]) => {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.4, 10), stone);
    pot.position.y = 0.2; pot.castShadow = pot.receiveShadow = true; group.add(pot);
    root.add(group); seated.push(group); colliders.push({ x, z, radius: 0.7 }); return group;
  });
  loadModel(encodeURI('assets/Stylized Nature MegaKit[Standard]/glTF/Bush_Common_Flowers.gltf'), 0.8)
    .then(({ object }) => { for (const planter of planters) { const plant = object.clone(true); plant.position.y = 0.3; planter.add(plant); } onReady?.(root); })
    .catch(error => console.warn('Plaza planting unavailable.', error));
  let version = -1;
  function update() {
    if (version === world.terrainVersion) return;
    version = world.terrainVersion;
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, world.terrainHeight(positions.getX(i), positions.getZ(i)) + 0.025);
    positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    for (const object of seated) object.position.y = world.terrainHeight(object.position.x, object.position.z);
  }
  update(); onReady?.(root);
  return { root, colliders, update, reset() { version = -1; update(); } };
}
