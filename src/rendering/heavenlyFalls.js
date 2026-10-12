import { SKY_LAKE, HEAVENLY_RIM } from '../models/skyIsland.js';
import { createWaterSurface, createSoftDot } from './waterfall.js';
import { loadModel } from './models.js';
import { fitText } from './canvasText.js';

// Heavenly Falls: the ground-level landmark where the Sky Garden's four falls land.
// A walkable fountain rim, paved plaza, benches, lamps, a tiered centre fountain and an
// entrance arch you can read, so ground explorers find it without climbing Clover.
const C = SKY_LAKE;
const PLAZA = 1.6;

export function createHeavenlyFalls({ scene, world, onReady }) {
  const root = new THREE.Group(); root.name = 'Heavenly Falls'; scene.add(root);
  const colliders = [];
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8d0bd, roughness: 0.85 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x8f8775, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c3330, roughness: 0.5, metalness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffd98a, emissiveIntensity: 1.2 });
  const couch = new THREE.MeshStandardMaterial({ color: 0xc8662a, roughness: 0.95 });
  const poolMat = createWaterSurface('pool'), fallMat = createWaterSurface('fall');
  const at = (r, a) => [C.x + Math.cos(a) * r, C.z + Math.sin(a) * r];
  function add(geometry, material, x, y, z, ry = 0) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true; root.add(m); return m;
  }
  // Faces the fountain centre from (x, z): local +z points inward.
  const facing = (x, z) => Math.atan2(C.x - x, C.z - z);

  // --- Fountain rim (matches HEAVENLY_RIM collision) and paved plaza ----------------
  const rimShape = new THREE.Shape(); rimShape.absarc(0, 0, HEAVENLY_RIM.outer, 0, Math.PI * 2);
  const hole = new THREE.Path(); hole.absarc(0, 0, HEAVENLY_RIM.inner, 0, Math.PI * 2, true); rimShape.holes.push(hole);
  // Bevel grows the extrusion by its thickness at both ends, so shorten it to keep the
  // visible top exactly at the collision top (feet were sinking into the rim).
  const bevel = 0.06;
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: HEAVENLY_RIM.top - HEAVENLY_RIM.bottom - bevel * 2, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 96 });
  rimGeo.rotateX(-Math.PI / 2);
  add(rimGeo, stone, C.x, HEAVENLY_RIM.bottom + bevel, C.z);
  // It's a fountain: visitors sit and walk on the rim, but the basin itself is off limits.
  colliders.push({ x: C.x, z: C.z, radius: HEAVENLY_RIM.inner - 0.2 });

  const tiles = document.createElement('canvas'); tiles.width = tiles.height = 256;
  const ctx = tiles.getContext('2d');
  ctx.fillStyle = '#9d9483'; ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const shade = 168 + world.hash(x, y + 40) * 40 | 0;
    ctx.fillStyle = `rgb(${shade},${shade - 8},${shade - 22})`;
    ctx.fillRect(x * 64 + 3 + (y % 2) * 32, y * 64 + 3, 58, 58);
    ctx.fillRect(x * 64 + 3 + (y % 2) * 32 - 256, y * 64 + 3, 58, 58);
  }
  const paving = new THREE.CanvasTexture(tiles);
  paving.wrapS = paving.wrapT = THREE.RepeatWrapping; paving.repeat.set(14, 14); paving.encoding = THREE.sRGBEncoding;
  const plaza = new THREE.Mesh(new THREE.RingGeometry(HEAVENLY_RIM.outer, 37.5, 120, 1),
    new THREE.MeshStandardMaterial({ map: paving, roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(C.x, PLAZA + 0.03, C.z); plaza.receiveShadow = true;
  root.add(plaza);

  // --- Centre fountain: three tiers, a spilling curtain and an arcing jet ----------------
  add(new THREE.CylinderGeometry(3.2, 3.6, 1.4, 32), darkStone, C.x, 0.3, C.z);
  add(new THREE.CylinderGeometry(0.55, 0.75, 3, 16), stone, C.x, 2.4, C.z);
  add(new THREE.CylinderGeometry(2.1, 1.2, 0.5, 32), stone, C.x, 3.9, C.z);
  add(new THREE.CylinderGeometry(0.3, 0.45, 1.4, 12), stone, C.x, 4.8, C.z);
  add(new THREE.CylinderGeometry(1.1, 0.6, 0.35, 24), stone, C.x, 5.6, C.z);
  for (const [r, y] of [[3.0, 1.03], [1.95, 4.17], [1.0, 5.79]]) {
    const water = add(new THREE.CircleGeometry(r, 32), poolMat, C.x, y, C.z); water.rotation.x = -Math.PI / 2; water.castShadow = false;
  }
  for (const [r, top, bottom] of [[2.08, 4.12, 1.05], [1.08, 5.75, 4.15]]) {
    const curtain = add(new THREE.CylinderGeometry(r, r + 0.35, top - bottom, 32, 6, true), fallMat, C.x, (top + bottom) / 2, C.z);
    curtain.castShadow = false;
  }
  const jetCount = 160, jetPositions = new Float32Array(jetCount * 3);
  const jetGeo = new THREE.BufferGeometry(); jetGeo.setAttribute('position', new THREE.BufferAttribute(jetPositions, 3));
  const jet = new THREE.Points(jetGeo, new THREE.PointsMaterial({ color: 0xe8f7f4, map: createSoftDot(), size: 0.3, transparent: true, opacity: 0.85, depthWrite: false }));
  jet.frustumCulled = false; scene.add(jet);

  // --- Entrance arch facing the way ground explorers arrive (from Grimoire Tower) -------
  const entrance = Math.atan2(-C.z, -C.x); // world angle pointing back toward the centre of the map
  const [ax, az] = at(36.5, entrance), archYaw = facing(ax, az);
  const side = [Math.cos(archYaw), -Math.sin(archYaw)];
  for (const s of [-1, 1]) {
    const px = ax + side[0] * 3.4 * s, pz = az + side[1] * 3.4 * s;
    add(new THREE.BoxGeometry(1, 5.2, 1), stone, px, PLAZA + 2.6, pz, archYaw);
    add(new THREE.BoxGeometry(1.4, 0.4, 1.4), darkStone, px, PLAZA + 0.2, pz, archYaw);
    colliders.push({ x: px, z: pz, radius: 0.75 });
  }
  add(new THREE.BoxGeometry(8.2, 0.7, 1.3), stone, ax, PLAZA + 5.5, az, archYaw);
  sign(['HEAVENLY FALLS', 'Where the Sky Garden pours into the earth'], ax, PLAZA + 4.4, az, archYaw, 6.4);
  // A reading plaque just inside the arch.
  const [lx, lz] = at(34.2, entrance + 0.12);
  add(new THREE.BoxGeometry(0.7, 1.1, 0.5), darkStone, lx, PLAZA + 0.55, lz, facing(lx, lz));
  sign(['HEAVENLY FALLS', 'Four rivers fall from the floating isle above',
    'and meet in this basin. Toss a wish into the', 'water; the Sky Garden hears it.'], lx, PLAZA + 1.45, lz, facing(lx, lz) + Math.PI, 2.4, true);
  colliders.push({ x: lx, z: lz, radius: 0.5 });

  // --- Benches, lamps, flowers and the orange couch ---------------------------------------
  for (let i = 0; i < 10; i++) {
    const a = entrance + 0.45 + i * Math.PI * 2 / 10;
    const [x, z] = at(34.3, a), ry = facing(x, z);
    add(new THREE.BoxGeometry(2.2, 0.12, 0.7), wood, x, PLAZA + 0.5, z, ry);
    add(new THREE.BoxGeometry(2.2, 0.5, 0.1), wood, x - Math.sin(ry) * 0.33, PLAZA + 0.85, z - Math.cos(ry) * 0.33, ry);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.12, 0.45, 0.6), iron,
      x + Math.cos(ry) * s, PLAZA + 0.22, z - Math.sin(ry) * s, ry);
    colliders.push({ x, z, radius: 0.9 });
  }
  for (let i = 0; i < 16; i++) {
    const a = entrance + i * Math.PI * 2 / 16 + 0.2;
    const [x, z] = at(37, a);
    add(new THREE.CylinderGeometry(0.07, 0.1, 3, 8), iron, x, PLAZA + 1.5, z);
    add(new THREE.SphereGeometry(0.28, 12, 8), glow, x, PLAZA + 3.1, z).castShadow = false;
    colliders.push({ x, z, radius: 0.25 });
  }
  {
    const [x, z] = at(33.6, entrance - 0.32), ry = facing(x, z);
    const back = [-Math.sin(ry), -Math.cos(ry)], right = [Math.cos(ry), -Math.sin(ry)];
    add(new THREE.BoxGeometry(2.6, 0.45, 1), couch, x, PLAZA + 0.32, z, ry);
    add(new THREE.BoxGeometry(2.6, 0.75, 0.3), couch, x + back[0] * 0.5, PLAZA + 0.85, z + back[1] * 0.5, ry);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.6, 1), couch, x + right[0] * 1.3 * s, PLAZA + 0.6, z + right[1] * 1.3 * s, ry);
    colliders.push({ x, z, radius: 1.3 });
  }
  const flowers = [];
  for (let i = 0; i < 24; i++) {
    const a = entrance + i * Math.PI * 2 / 24;
    flowers.push(at(32.3, a));
  }
  loadModel(encodeURI('assets/Stylized Nature MegaKit[Standard]/glTF/Flower_3_Group.gltf'), 0.55).then(({ object }) => {
    for (const [x, z] of flowers) { const f = object.clone(true); f.position.set(x, PLAZA, z); f.rotation.y = x; root.add(f); }
    onReady?.(root);
  }).catch(error => console.warn('Heavenly Falls flowers unavailable.', error));

  // A signpost where the north road meets Clover points ground explorers east.
  const postX = 9, postZ = -320, postY = world.terrainHeight(postX, postZ);
  add(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8), wood, postX, postY + 1.3, postZ);
  // Faces south toward walkers on the north road; text avoids arrows so both faces read true.
  sign(['HEAVENLY FALLS', 'East of the Clover cliffs, under the Sky Garden'], postX, postY + 2.3, postZ, 0, 2.6);
  colliders.push({ x: postX, z: postZ, radius: 0.3 });

  function sign(lines, x, y, z, ry, width, small = false) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = small ? 512 : 256;
    const g = canvas.getContext('2d');
    g.fillStyle = '#2f3b36'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = '#d9c99a'; g.lineWidth = 10; g.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    g.textAlign = 'center'; g.fillStyle = '#f4ead0';
    lines.forEach((line, i) => {
      g.font = i === 0 ? `bold ${small ? 72 : 96}px serif` : `${small ? 46 : 44}px serif`;
      fitText(g, line, 512, (small ? 105 : 120) + i * (small ? 112 : 90) - (i ? 0 : 10), 940);
    });
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const height = width * canvas.height / canvas.width;
    // Two front faces so the lettering reads correctly from both sides.
    for (const flip of [0, Math.PI]) {
      const m = add(new THREE.PlaneGeometry(width, height), material, x, y, z, ry + flip);
      m.position.x += Math.sin(ry + flip) * 0.03; m.position.z += Math.cos(ry + flip) * 0.03; m.castShadow = false;
    }
  }

  const hint = document.createElement('small'); document.querySelector('.compass').appendChild(hint);
  let time = 0;
  onReady?.(root);
  return {
    root, jet, colliders, platforms: [HEAVENLY_RIM],
    update(dt, player) {
      time += dt;
      poolMat.uniforms.uTime.value = fallMat.uniforms.uTime.value = time;
      for (let i = 0; i < jetCount; i++) {
        const t = (time * 0.8 + world.hash(i, 3301)) % 1, a = world.hash(i, 3302) * Math.PI * 2, out = 0.4 + world.hash(i, 3303) * 0.5;
        jetPositions.set([C.x + Math.cos(a) * out * t * 2, 5.9 + 6 * t - 6.4 * t * t, C.z + Math.sin(a) * out * t * 2], i * 3);
      }
      jetGeo.attributes.position.needsUpdate = true;
      const d = Math.round(Math.hypot(player.x - C.x, player.z - C.z));
      const label = d < 40 ? 'HEAVENLY FALLS · FOUR SKY RIVERS MEET · REST A WHILE' : d < 260 ? `HEAVENLY FALLS · ${d} m` : '';
      if (hint.textContent !== label) hint.textContent = label;
    }
  };
}
