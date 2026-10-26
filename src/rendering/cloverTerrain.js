import { CLOVER_ENTRANCE, CLOVER_PLATEAUS, CLOVER_RAMPS, CLOVER_JUMPS,
  CLOVER_SURFACES, CLOVER_VALLEY, CLOVER_ASCENT_JUMPS, createCloverRecovery, cloverArea } from '../models/cloverTerrain.js';
import { loadModel } from './models.js';
import { createWaterSurface } from './waterfall.js';
import { createCloverDressing, cloverGroundTexture } from './cloverDressing.js';
import { createCloverSanctuary } from './cloverSanctuary.js';
import { fitText } from './canvasText.js';

let capLayer = 0;
// Natural cliff faces: push side vertices in/out along the outward direction with layered
// noise (strongest mid-cliff, zero at the walking edge so visuals still match collision).
// Grass caps get a drooping, irregular turf lip instead of a square slab edge.
function roughen(world, pos, levelOf, p, originY, cap) {
  const hw = p.width / 2, hd = p.depth / 2;
  for (let i = 0; i < pos.count; i++) {
    const level = levelOf(pos.getY(i));
    if (level > 0.99) continue;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const dx = x / hw, dz = z / hd, len = Math.hypot(dx, dz);
    if (len < 0.2) continue;
    const wx = p.x + x, wy = originY + y, wz = p.z + z;
    const n = world.noise(wx * 0.21 + wy * 0.13, wz * 0.21 - wy * 0.17) - 0.5 +
      (world.noise(wx * 0.63 + wy * 0.41, wz * 0.63 - wy * 0.37) - 0.5) * 0.5;
    const amp = Math.min(2.6, 0.35 * Math.min(p.width, p.depth));
    const push = cap ? 0.3 + n * 0.5 : (n - 0.2) * amp * (1 - level * level);
    pos.setX(i, x + dx / len * push);
    pos.setZ(i, z + dz / len * push);
    if (cap) pos.setY(i, y - 0.1 - Math.max(0, n) * 0.5);
  }
}
// Terrace cliff block: a tapered, noise-roughened rock body or grass cap whose walking top
// matches the platform p exactly. Shared with the Living Road's landings.
// layer: the cap's depth-offset layer. Terrace caps stack (each one higher than the last); a cap
// that carries small objects (guide pedestals, leaf marks) passes 1 so it cannot draw over them.
export function cliffBlock(root, world, p, material, cap = false, layer = cap ? ++capLayer : 0) {
  const capBias = layer * 0.001;
  if (cap) {
    material = material.clone(); material.polygonOffset = true;
    material.polygonOffsetFactor = -layer; material.polygonOffsetUnits = -layer;
  }
  // Keep the rock body below the grass cap: coincident top faces caused
  // the striped depth fighting visible on the plateau and stepping rocks.
  const bodyTop = p.top - 0.2;
  const height = cap ? 0.45 : bodyTop - p.bottom;
  if (p.outline) {
    const shape = new THREE.Shape();
    p.outline.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: cap ? 1 : 12 });
    geo.rotateX(Math.PI / 2);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      // Extrusion starts at the top and descends; narrow the lower cliff rings.
      const level = 1 + positions.getY(i) / height;
      const scale = cap || level > 0.99 ? 1 : 0.73 + level * 0.2 + world.hash(positions.getX(i) + p.z, positions.getZ(i)) * 0.06;
      positions.setXYZ(i, positions.getX(i) * scale, positions.getY(i), -positions.getZ(i) * scale);
    }
    roughen(world, positions, y => 1 + y / height, p, cap ? p.top : bodyTop, cap);
    // The final Z flip preserves the model's exact collision outline.
    const indices = geo.index;
    if (!indices) {
      for (let i = 0; i < positions.count; i += 3) {
        const x = positions.getX(i + 1), y = positions.getY(i + 1), z = positions.getZ(i + 1);
        positions.setXYZ(i + 1, positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2));
        positions.setXYZ(i + 2, x, y, z);
      }
    }
    geo.computeVertexNormals();
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.x + positions.getX(i)) / 12, (p.z + positions.getZ(i)) / 12);
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(p.x, cap ? p.top + capBias : bodyTop, p.z);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return;
  }
  const seg = v => Math.max(2, Math.ceil(v / 1.5));
  const geometry = new THREE.BoxGeometry(p.width, height, p.depth, seg(p.width), cap ? 1 : seg(height), seg(p.depth));
  roughen(world, geometry.attributes.position, y => (y + height / 2) / height, p,
    cap ? p.top - height / 2 : (bodyTop + p.bottom) / 2, cap);
  if (cap) geometry.computeVertexNormals();
  if (!cap) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const level = (pos.getY(i) + height / 2) / height;
      const variation = world.hash(pos.getX(i) + p.z, pos.getZ(i) + pos.getY(i) * 7);
      const taper = level > 0.99 ? 1 : 0.74 + level * 0.18 + variation * 0.1;
      pos.setX(i, pos.getX(i) * taper); pos.setZ(i, pos.getZ(i) * taper);
    }
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geometry, material);
  if (cap) {
    const pos = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.x + pos.getX(i)) / 12, (p.z + pos.getZ(i)) / 12);
  }
  mesh.position.set(p.x, cap ? p.top - height / 2 + capBias : (bodyTop + p.bottom) / 2, p.z);
  mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
}

export function createCloverTerrain({ scene, world, onReady }) {
  const root = new THREE.Group(); root.name = 'Clover cliff terraces'; scene.add(root);
  const rock = new THREE.MeshStandardMaterial({ color: 0x4a4136, roughness: 1, flatShading: true });
  const grass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: cloverGroundTexture(world) });
  const wood = new THREE.MeshStandardMaterial({ color: 0x382515, roughness: 1 });
  const colliders = [], recovery = createCloverRecovery();
  const dressing = createCloverDressing({ root, world, onReady });
  colliders.push(...dressing.colliders);
  const sanctuary = createCloverSanctuary({ root, world, onReady });
  colliders.push(...sanctuary.colliders);
  for (const p of CLOVER_PLATEAUS) for (const x of [-7, 7]) colliders.push({ x, z: p.z - 3, radius: 0.8 });
  for (const p of [...CLOVER_PLATEAUS, ...CLOVER_JUMPS, ...CLOVER_VALLEY, ...CLOVER_ASCENT_JUMPS]) { cliffBlock(root, world, p, rock); cliffBlock(root, world, p, grass, true); }
  // Buried angular rock ribs break up the cliff outline below the walking top.
  for (const p of CLOVER_PLATEAUS) for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rock);
    const height = 3 + world.hash(i, p.z + side) * 3;
    rib.scale.set(1.4, height / 2, 1.8);
    rib.position.set(p.x + side * (p.width / 2 - 0.4), p.top - height / 2 - 0.3,
      p.z - p.depth / 2 + 2 + i * (p.depth - 4) / 3);
    rib.rotation.y = world.hash(p.z, i + side) * Math.PI;
    rib.castShadow = rib.receiveShadow = true; root.add(rib);
  }
  for (const p of CLOVER_RAMPS) {
    const geo = new THREE.BoxGeometry(p.width, 0.35, p.depth, 1, 1, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + p.topAt(p.x + pos.getX(i), p.z + pos.getZ(i)));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, wood); mesh.position.set(p.x, -0.295, p.z);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    // Individual deck boards follow the same slope as the collision surface.
    const boards = Math.ceil(p.depth / 0.85);
    const slope = (p.topAt(0, p.z - p.depth / 2) - p.topAt(0, p.z + p.depth / 2)) / p.depth;
    for (let i = 0; i < boards; i++) {
      const z = p.z + p.depth / 2 - (i + 0.5) * p.depth / boards;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(p.width - 0.2, 0.08, p.depth / boards - 0.05), wood);
      plank.position.set(p.x, p.topAt(0, z) - 0.04, z);
      plank.rotation.x = Math.atan(slope);
      plank.castShadow = plank.receiveShadow = true; root.add(plank);
    }
    // Low edge curbs clarify the walking route without obstructing the centre.
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, p.depth), wood);
      const edgePos = edge.geometry.attributes.position;
      for (let i = 0; i < edgePos.count; i++) edgePos.setY(i, edgePos.getY(i) + p.topAt(0, p.z + edgePos.getZ(i)));
      edge.geometry.computeVertexNormals(); edge.position.set(p.x + side * (p.width / 2 - 0.08), 0.05, p.z);
      root.add(edge);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, p.depth), wood);
      const beamPos = beam.geometry.attributes.position;
      for (let i = 0; i < beamPos.count; i++) beamPos.setY(i, beamPos.getY(i) + p.topAt(0, p.z + beamPos.getZ(i)));
      beam.geometry.computeVertexNormals(); beam.position.set(p.x + side * p.width * 0.32, -0.55, p.z);
      beam.castShadow = true; root.add(beam);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, p.depth), wood);
      const railPos = rail.geometry.attributes.position;
      for (let i = 0; i < railPos.count; i++) railPos.setY(i, railPos.getY(i) + p.topAt(0, p.z + railPos.getZ(i)));
      rail.geometry.computeVertexNormals();
      rail.position.set(p.x + side * (p.width / 2 - 0.08), 0.95, p.z); rail.castShadow = true; root.add(rail);
      for (let i = 0; i <= Math.ceil(p.depth / 3); i++) {
        const z = p.z - p.depth / 2 + i * p.depth / Math.ceil(p.depth / 3);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.15), wood);
        post.position.set(p.x + side * (p.width / 2 - 0.08), p.topAt(0, z) + 0.45, z);
        post.castShadow = true; root.add(post);
      }
    }
  }
  // Existing trees give the grass-topped cliffs their Clover identity.
  loadModel(encodeURI('assets/Stylized Nature MegaKit[Standard]/glTF/Pine_1.gltf'), 5)
    .then(({ object }) => {
      for (const p of CLOVER_PLATEAUS) for (const x of [-7, 7]) {
        const tree = object.clone(true); tree.position.set(x, p.top, p.z - 3);
        root.add(tree);
      }
      onReady?.(root);
    }).catch(error => console.warn('Clover terrace trees unavailable.', error));
  const last = CLOVER_PLATEAUS[2];
  for (const x of [-3.5, 3.5]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), rock);
    pillar.position.set(x, last.top + 2, last.z - 3); pillar.castShadow = true; root.add(pillar);
    colliders.push({ x, z: last.z - 3, radius: 0.65 });
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 1.2), rock);
  lintel.position.set(0, last.top + 4, last.z - 3); root.add(lintel);
  function label(text, x, y, z, width = 5, readableBothSides = false) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#304b37'; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#e0eeb8'; ctx.textAlign = 'center'; ctx.font = 'bold 58px sans-serif';
    fitText(ctx, text[0], 512, 93, 960); ctx.font = '36px sans-serif'; fitText(ctx, text[1], 512, 176, 960);
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: readableBothSides ? THREE.FrontSide : THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), material);
    mesh.position.set(x, y, z); root.add(mesh);
    if (readableBothSides) { const back=mesh.clone();back.rotation.y=Math.PI;back.position.z-=.04;root.add(back); }
  }
  label(['CLOVER CLIFF TERRACES', 'Walk the central bridges · Jump the east-side rocks'], -6, 3.5, CLOVER_ENTRANCE.z + 1);
  label(['JUMP ROUTE →', 'Optional · Space to jump'], 6, CLOVER_PLATEAUS[0].top + 1.5, -376, 3);
  label(['CLOVER HIGH VALLEY', 'West: winding climb · North: rock jumps · East: overlook'], 5, 14, -443, 6);
  label(['HIGH VALLEY SUMMIT', 'Sky Garden gateway · Press E'], -5.3, 25.8, -497.3, 4, true);
  const approach = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45, 0.5, 0.08, 7), rock, 76);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 76; i++) {
    dummy.position.set(0, 1.53, -35 - i * 4); dummy.rotation.y = i * 0.7;
    dummy.updateMatrix(); approach.setMatrixAt(i, dummy.matrix);
  }
  approach.instanceMatrix.needsUpdate = true; approach.frustumCulled = false; approach.receiveShadow = true; root.add(approach);
  // Lake filling the ravine under the elevated kingdom. Added to the scene, not root,
  // so the camera's obstacle raycast against clover.root ignores it.
  const lakeMat = createWaterSurface('lake');
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(86, 216), lakeMat);
  lake.rotation.x = -Math.PI / 2; lake.position.set(0, -4, -452); scene.add(lake);
  const hint = document.createElement('small'); document.querySelector('.compass').appendChild(hint);
  hint.dataset.kingdom = 'CLOVER KINGDOM';
  let messageTime = 0, recoveredAtSummit = false;
  function courseRecovery(player) {
    const target = recovery.update(player);
    if (target) { messageTime = 3; recoveredAtSummit = target.top === 24; }
    return target;
  }
  function update(player, dt = 0) {
    messageTime = Math.max(0, messageTime - dt);
    lakeMat.uniforms.uTime.value += dt;
    const sanctuaryLabel = sanctuary.update(player, dt);
    const distance = Math.round(Math.hypot(player.x, player.z - CLOVER_ENTRANCE.z));
    const label = messageTime > 0 ? (recoveredAtSummit ? 'CLOVER SUMMIT · RETURNED TO SUMMIT ENTRANCE' : 'CLOVER TERRACES · RETURNED TO ENTRANCE') : sanctuaryLabel ||
      (cloverArea(player.x, player.z) ? (player.z < -478 && player.y > 25 ? 'CLOVER HIGH VALLEY · SUMMIT REACHED' :
        'CLOVER TERRACES · WALK THE BRIDGES OR JUMP THE EAST LEDGES') :
        `CLOVER TERRACES · ${distance} m · FOLLOW NORTH FROM SPAWN`);
    if (hint.textContent !== label) hint.textContent = label;
  }
  onReady?.(root);
  return { root, lake, platforms: CLOVER_SURFACES, colliders, update, courseRecovery,
    reset() { recovery.reset(); sanctuary.reset(); messageTime = 0; } };
}
