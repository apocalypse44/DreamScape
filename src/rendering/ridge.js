import { RIDGE, RIDGE_PATH, RIDGE_MARKERS, createRidgeExploration } from '../models/ridge.js';
import { loadModel } from './models.js';

export function createRidge({ scene, world, onReady }) {
  const root = new THREE.Group();
  root.name = 'Grimoire terraced ridge';
  scene.add(root);
  const grounded = [];
  const colliders = [];
  const exploration = createRidgeExploration();
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xb0ad92, roughness: 1 });
  const stoneGeometry = new THREE.CylinderGeometry(0.48, 0.55, 0.1, 7);
  for (let i = 0; i < RIDGE_PATH.length; i += 2) {
    const point = RIDGE_PATH[i];
    const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
    stone.position.set(point.x, 0, point.z);
    stone.rotation.y = world.hash(i, 731) * Math.PI;
    stone.receiveShadow = true;
    root.add(stone);
    grounded.push({ object: stone, offset: 0.05 });
  }
  const entrance = RIDGE_PATH[0];
  const summitY = RIDGE.base + RIDGE.rise;
  // A broad stone arch frames the summit and leaves the centre walkable.
  for (const dx of [-3.2, 3.2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1.2), stoneMaterial);
    post.position.set(RIDGE.x + dx, summitY + 2.5, RIDGE.z + 1);
    post.castShadow = post.receiveShadow = true;
    root.add(post);
    colliders.push({ x: post.position.x, z: post.position.z, radius: 0.65 });
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.85, 1.5), stoneMaterial);
  lintel.position.set(RIDGE.x, summitY + 5, RIDGE.z + 1);
  lintel.castShadow = lintel.receiveShadow = true;
  root.add(lintel);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.15),
    new THREE.MeshStandardMaterial({ color: 0xb8e6d8, emissive: 0x7cd5b6, emissiveIntensity: 0.8, roughness: 0.3 }));
  crystal.position.set(RIDGE.x, summitY + 6.8, RIDGE.z + 1);
  root.add(crystal);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 18, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xafe9cc, opacity: 0.18, transparent: true, depthWrite: false, fog: false }));
  beacon.position.set(RIDGE.x, summitY + 16, RIDGE.z + 1);
  root.add(beacon);
  const markerMeshes = RIDGE_MARKERS.map(p => {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5),
      new THREE.MeshStandardMaterial({ color: 0xffd47a, emissive: 0x93611a, emissiveIntensity: 0.8 }));
    mesh.position.set(p.x, p.y + 1.2, p.z);
    root.add(mesh);
    return mesh;
  });
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#344638'; ctx.fillRect(0, 0, 1024, 320);
  ctx.fillStyle = '#edf0cf'; ctx.textAlign = 'center'; ctx.font = 'bold 68px sans-serif';
  ctx.fillText('GRIMOIRE RIDGE', 512, 90);
  ctx.font = '42px sans-serif'; ctx.fillText('Follow the stone spiral to the summit', 512, 165);
  ctx.fillText('Jump the terrace banks for a shortcut', 512, 222);
  ctx.fillText('Discover 3 golden exploration crystals', 512, 282);
  const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.25),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  sign.position.set(entrance.x, 0, entrance.z - 3.6); sign.rotation.y = -Math.PI / 2;
  root.add(sign); grounded.push({ object: sign, offset: 1.7 });
  // Two low marker stones identify the trail without blocking it.
  for (const dz of [-2, 2]) {
    const marker = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65), stoneMaterial);
    marker.scale.set(0.7, 0.65, 0.7);
    marker.position.set(entrance.x, 0, entrance.z + dz);
    marker.castShadow = marker.receiveShadow = true;
    root.add(marker);
    grounded.push({ object: marker, offset: 0.3 });
  }
  for (const [name, height, count] of [['Rock_Medium_1', 0.45, 18], ['Plant_1', 0.55, 12], ['Clover_1', 0.3, 10]]) {
    loadModel(encodeURI(`assets/Stylized Nature MegaKit[Standard]/glTF/${name}.gltf`), height)
      .then(({ object }) => {
        for (let i = 0; i < count; i++) {
          const angle = world.hash(i, 751 + count) * Math.PI * 2;
          const radius = [7, 12, 17, 22, 27, 30][i % 6];
          const x = RIDGE.x + Math.cos(angle) * radius, z = RIDGE.z + Math.sin(angle) * radius;
          if (RIDGE_PATH.some(p => Math.hypot(p.x - x, p.z - z) < 4)) continue;
          const copy = object.clone(true);
          copy.position.set(x, world.terrainHeight(x, z) - 0.05, z);
          copy.rotation.y = angle;
          root.add(copy);
          grounded.push({ object: copy, offset: -0.05 });
        }
        onReady?.(root);
      }).catch(error => console.warn(`Ridge ${name} dressing unavailable.`, error));
  }
  const hint = document.createElement('small');
  document.querySelector('.compass').appendChild(hint);
  let terrainVersion = -1;
  function update(player) {
    crystal.rotation.y += 0.008;
    const newlyFound = exploration.update(player);
    for (const i of newlyFound) markerMeshes[i].material.color.set(0x84dfb0);
    markerMeshes.forEach((mesh, i) => { mesh.rotation.y += 0.012; mesh.visible = !exploration.found.has(i); });
    if (terrainVersion !== world.terrainVersion) {
      terrainVersion = world.terrainVersion;
      for (const { object, offset } of grounded) object.position.y = world.terrainHeight(object.position.x, object.position.z) + offset;
    }
    const radius = Math.hypot(player.x - RIDGE.x, player.z - RIDGE.z);
    const atSummit = radius < 6 && player.y > RIDGE.base + RIDGE.rise + 1.5;
    const progress = `${exploration.found.size}/3 CRYSTALS DISCOVERED`;
    const label = exploration.found.size === 3 && radius < 37 ? 'GRIMOIRE RIDGE · EXPLORATION COMPLETE · 3/3' :
      atSummit ? `GRIMOIRE RIDGE · SUMMIT VIEWPOINT · ${progress}` : radius < 37 ?
      `GRIMOIRE RIDGE · ${progress} · STONE TRAIL OR TERRACE JUMPS` :
      `GRIMOIRE RIDGE · ${Math.round(Math.hypot(player.x - entrance.x, player.z - entrance.z))} m TO TRAIL · SE OF SPAWN`;
    if (hint.textContent !== label) hint.textContent = label;
  }
  onReady?.(root);
  return { root, colliders, update, reset() {
    terrainVersion = -1; exploration.reset();
    markerMeshes.forEach(mesh => { mesh.visible = true; mesh.material.color.set(0xffd47a); });
  } };
}
