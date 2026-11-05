// Diamond · the lowland the royals leave behind (DIAMOND_KINGDOM_TERRAIN.md §2b, §14). Dustward: a slum of
// scrap shacks across the east lowland, smelter chimneys trailing smoke, overseer watchtowers flying
// royal gold, the Tithe Yard where every crystal is weighed and taken, a rail cart hauling the tithe
// up the causeway to the enclave, and dust in the air. Up on the mesa the same particles glitter.
import { loadModel } from './models.js';
import { DIAMOND_BASE, DUSTWARD, STOCKADE, BARRACKS, TITHE_YARD, CAUSEWAY, CITADEL_TOP } from '../models/diamond.js';

const WALLS = [0x6b5a45, 0x7a6650, 0x5c4f42, 0x8a7458, 0x4f4a44, 0x655a4c];
const ROOFS = [0x8a4b2a, 0x6e6e6e, 0x4b6a80, 0x7a5a3a, 0x9a6a3a, 0x5a5550];
const TIMBER = 0x5e432a, GOLD = 0xffd36b;
const KITS = { props: 'assets/Fantasy Props MegaKit[Standard]/Exports/glTF/', nature: 'assets/Stylized Nature MegaKit[Standard]/glTF/',
  hex: 'assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Assets/gltf/decoration/props/' };
// [kit, model, height]: scrap of daily life beside the shacks.
const CLUTTER = [['props', 'Barrel', 1], ['props', 'Crate_Wooden', 0.8], ['props', 'Bucket_Wooden_1', 0.45],
  ['props', 'Stall_Cart_Empty', 2.2], ['props', 'Cauldron', 0.9], ['nature', 'DeadTree_1', 4.5], ['nature', 'DeadTree_3', 5],
  ['hex', 'tent', 2.2], ['hex', 'wheelbarrow', 0.9], ['hex', 'sack', 0.7], ['hex', 'pallet', 0.3], ['hex', 'crate_long_A', 0.9], ['hex', 'resource_stone', 0.9]];

const PARTICLES = 'assets/kenney_particle-pack/PNG (Transparent)/';
const STEEL = 'assets/CorrugatedSteel005_1K-JPG/CorrugatedSteel005_1K-JPG_';
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// kingdom: world.diamond. surfaceHeight(x, z): drawn ground. player: the camera rig (for dust).
export function buildDiamondDustward({ scene, kingdom, surfaceHeight }) {
  const root = new THREE.Group(); root.name = 'diamond-dustward'; scene.add(root);
  const colliders = [];
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const timber = new THREE.MeshStandardMaterial({ color: TIMBER, roughness: 0.95, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0x6a4a10, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.75 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.85, flatShading: true });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0x3a6f9a, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3, flatShading: true });
  const yaw = kingdom.at(0, 0), ahead = kingdom.at(1, 0), into = Math.atan2(ahead.x - yaw.x, ahead.z - yaw.z);

  // Landmarks first; shacks keep clear of them.
  const CHIMNEYS = [[70, -40], [118, -66], [150, -28], [100, -78]];
  const TOWERS = [[13, 27], [13, -27], [82, -17], [100, 17], [112, -48], [156, -62], [66, -80]];
  const reserved = [...CHIMNEYS, ...TOWERS].map(([u, v]) => ({ u, v }));
  const inZone = (z, u, v, pad) => u > z.u0 - pad && u < z.u1 + pad && v > z.v0 - pad && v < z.v1 + pad;
  const inStockade = (u, v, pad) => inZone(STOCKADE, u, v, pad) || inZone(BARRACKS, u, v, pad);   // shacks keep out of both compounds
  const level = (x, z) => [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5], [0, 0]].every(([dx, dz]) => Math.abs(surfaceHeight(x + dx, z + dz) - DIAMOND_BASE) < 0.25);

  // --- Shacks: scrap walls, rusted and tarp roofs, a dark doorway. Three instanced meshes. ---
  const shacks = [];
  const CELL = 6.5;
  for (let u = DUSTWARD.u0; u < DUSTWARD.u1; u += CELL) for (let v = DUSTWARD.v0; v < DUSTWARD.v1; v += CELL) {
    const ju = u + (hash(u, v) - 0.5) * 2.4, jv = v + (hash(v, u) - 0.5) * 2.4;
    if (hash(u * 3, v * 7) < 0.22) continue;                                   // gaps and yards
    if (inStockade(ju, jv, 4) || reserved.some(r => Math.hypot(r.u - ju, r.v - jv) < 5.5)) continue;
    const p = kingdom.at(ju, jv);
    if (kingdom.clear(p.x, p.z, 1.5) || !level(p.x, p.z)) continue;
    const w = 3 + hash(u, v * 2) * 2.2, d = 2.8 + hash(u * 2, v) * 1.8, h = 2.1 + hash(u + 1, v) * 1.1;
    shacks.push({ ...p, w, d, h, yaw: into + Math.round(hash(v, u * 3) * 4) * Math.PI / 2 + (hash(u, v + 9) - 0.5) * 0.35, k: shacks.length });
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const wallMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), shacks.length);
  // Corrugated tin roofs (ambientCG CorrugatedSteel005, CC0), tinted per shack: rust, tin, faded tarp.
  const steel = name => { const t = new THREE.TextureLoader().load(`${STEEL}${name}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t; };
  const roofMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ map: steel('Color'), normalMap: steel('NormalGL'), roughness: 0.55, metalness: 0.45 }), shacks.length);
  const doorMesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0x15100c }), shacks.length);
  shacks.forEach((s, i) => {
    const y = surfaceHeight(s.x, s.z);
    dummy.position.set(s.x, y + s.h / 2 - 0.05, s.z); dummy.rotation.set(0, s.yaw, 0); dummy.scale.set(s.w, s.h, s.d); dummy.updateMatrix();
    wallMesh.setMatrixAt(i, dummy.matrix); wallMesh.setColorAt(i, color.set(WALLS[i % WALLS.length]).multiplyScalar(0.85 + hash(i, 4) * 0.3));
    dummy.position.set(s.x, y + s.h + 0.2, s.z); dummy.rotation.set(0.17 * (i % 2 ? 1 : -1), s.yaw, 0); dummy.scale.set(s.w + 0.7, 0.1, s.d + 0.9); dummy.updateMatrix();
    roofMesh.setMatrixAt(i, dummy.matrix); roofMesh.setColorAt(i, color.set(ROOFS[(i * 7) % ROOFS.length]));
    const front = new THREE.Vector3(0, 0, s.d / 2 + 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
    dummy.position.set(s.x + front.x, y + 0.85, s.z + front.z); dummy.rotation.set(0, s.yaw, 0); dummy.scale.set(0.9, 1.7, 0.05); dummy.updateMatrix();
    doorMesh.setMatrixAt(i, dummy.matrix);
    colliders.push({ x: s.x, z: s.z, radius: Math.min(s.w, s.d) / 2 + 0.35 });
  });
  wallMesh.castShadow = roofMesh.castShadow = true; wallMesh.receiveShadow = true;
  root.add(wallMesh, roofMesh, doorMesh);

  // Kit clutter at every third shack's door (barrels, crates, buckets, carts, a cauldron, dead trees).
  const spots = shacks.filter(s => s.k % 3 === 0).map((s, n) => {
    const side = new THREE.Vector3(s.w / 2 + 0.9, 0, s.d / 2 - 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
    return { x: s.x + side.x, z: s.z + side.z, yaw: s.yaw, item: CLUTTER[n % CLUTTER.length] };
  });
  const byModel = new Map();
  for (const spot of spots) { const key = spot.item.slice(0, 2).join('/'); if (!byModel.has(key)) byModel.set(key, []); byModel.get(key).push(spot); }
  for (const [, list] of byModel) {
    const [kit, name, height] = list[0].item;
    loadModel(encodeURI(`${KITS[kit]}${name}.gltf`), height).then(({ object }) => {
      for (const s of list) { const copy = object.clone(true); copy.position.set(s.x, surfaceHeight(s.x, s.z), s.z); copy.rotation.y = s.yaw; root.add(copy); }
    }).catch(error => console.warn(`Dustward: ${name} unavailable.`, error));
  }
  for (const s of spots) colliders.push({ x: s.x, z: s.z, radius: 0.5 });

  // --- Smelter chimneys and their smoke. ---
  const smokeTexture = new THREE.TextureLoader().load(encodeURI(`${PARTICLES}smoke_04.png`));
  const smoke = [];
  for (const [u, v] of CHIMNEYS) {
    const p = kingdom.at(u, v), y = surfaceHeight(p.x, p.z);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 11, 8), new THREE.MeshStandardMaterial({ color: 0x3d3430, roughness: 0.95 }));
    stack.position.set(p.x, y + 5.5, p.z); stack.castShadow = true;
    const hut = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x4a3d33, roughness: 0.95, flatShading: true }));
    hut.scale.set(5, 3.2, 4); hut.position.set(p.x + 2, y + 1.6, p.z); hut.rotation.y = into;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.1), new THREE.MeshBasicMaterial({ color: 0xff7a2e }));
    glow.position.set(p.x + 2, y + 0.9, p.z + 2.02); glow.rotation.y = into;            // furnace mouth
    root.add(stack, hut, glow);
    colliders.push({ x: p.x, z: p.z, radius: 1.5 }, { x: p.x + 2, z: p.z, radius: 2.2 });
    for (let k = 0; k < 12; k++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture, color: 0x2a2522, transparent: true, depthWrite: false }));
      root.add(sprite);
      smoke.push({ sprite, x: p.x, z: p.z, base: y + 11, t: k / 12 });
    }
  }

  // --- Overseer watchtowers flying royal gold. ---
  for (const [u, v] of TOWERS) {
    const p = kingdom.at(u, v), y = surfaceHeight(p.x, p.z), tower = new THREE.Group();
    tower.position.set(p.x, y, p.z); tower.rotation.y = into;
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, 0.3), timber); leg.position.set(x * 0.9, 4, z * 0.9); leg.rotation.set(z * -0.03, 0, x * 0.03); tower.add(leg);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 3.6), timber); deck.position.y = 7.6;
    const hutWalls = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 3.2), timber); hutWalls.position.y = 8.3;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.8, 4), slate); cap.position.y = 10.6; cap.rotation.y = Math.PI / 4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 4), timber); pole.position.set(0, 12.4, 0);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.04), gold); flag.position.set(0.72, 13.1, 0);
    tower.add(deck, hutWalls, cap, pole, flag);
    for (const m of tower.children) m.castShadow = true;
    root.add(tower);
    colliders.push({ x: p.x, z: p.z, radius: 1.9 });
  }

  // --- The Tithe Yard: a royal pavilion over a great gold balance, crates of crystal waiting to go up. ---
  const yard = new THREE.Group(), yc = kingdom.at(TITHE_YARD.u, TITHE_YARD.v);
  yard.position.set(yc.x, DIAMOND_BASE, yc.z); yard.rotation.y = into; root.add(yard);
  const yardBlock = (lx, lz, radius) => { const p = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), into).add(yard.position); colliders.push({ x: p.x, z: p.z, radius }); };
  // Pavilion beside the road (the road runs along local z through the centre).
  const PX = 7;
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 5, 6), slate); post.position.set(PX + x, 2.5, z); yard.add(post); yardBlock(PX + x, z, 0.5);
  }
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.6, 4), gold); canopy.position.set(PX, 6.3, 0); canopy.rotation.y = Math.PI / 4;
  const scalePost = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 3.4, 6), gold); scalePost.position.set(PX, 1.7, 0);
  const beam = new THREE.Group(); beam.position.set(PX, 3.4, 0);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.2), gold); beam.add(bar);
  const pans = [-1, 1].map(s => {
    const pan = new THREE.Group(); pan.position.set(0, -1.3, s * 2);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.6, 0.18, 10), gold);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 4), gold); chain.position.y = 0.65;
    pan.add(dish, chain); beam.add(pan); return pan;
  });
  for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), crystal); c.position.set((k % 3 - 1) * 0.3, 0.25 + (k > 2 ? 0.2 : 0), (k % 2) * 0.25 - 0.1); c.scale.y = 1.6; pans[0].add(c); }
  yard.add(canopy, scalePost, beam);
  yardBlock(PX, 0, 1.2);
  // Crates of crystal stacked on the other side of the road.
  const crates = [];
  for (let k = 0; k < 9; k++) crates.push([-6.5 - (k % 3) * 1.25, (Math.floor(k / 3) - 1) * 1.25, k > 5 ? 1 : 0]);
  crates.push([-6.5, -1.25, 1], [-7.75, 0, 1]);
  const crateMesh = new THREE.InstancedMesh(box, timber, crates.length), lidGems = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.3, 0), crystal, crates.length);
  crates.forEach(([x, z, tier], i) => {
    dummy.rotation.set(0, 0, 0); dummy.position.set(x, 0.55 + tier * 1.1, z); dummy.scale.set(1.1, 1.1, 1.1); dummy.updateMatrix(); crateMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 0.75; dummy.scale.set(1, 1.5, 1); dummy.updateMatrix(); lidGems.setMatrixAt(i, dummy.matrix);
  });
  yard.add(crateMesh, lidGems);
  yardBlock(-7.75, 0, 2.6);
  // Royal banners on poles around the yard.
  for (const [x, z] of [[-11, -9], [11, -9], [-11, 9], [11, 9]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), slate); pole.position.set(x, 3, z);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 1.2), gold); banner.position.set(x, 4.2, z + 0.65);
    yard.add(pole, banner); yardBlock(x, z, 0.3);
  }

  // --- The tithe rail: from the yard up the causeway to the enclave, with a cart that hauls crystal up. ---
  const RAIL0 = TITHE_YARD.u + 4, RAIL1 = CAUSEWAY.end + 5;
  // On the causeway the rail rides the causeway's grade, so it crosses the drawbridge instead of dipping into the break.
  const railPoint = (u, v) => { const p = kingdom.at(u, v), y = u >= CAUSEWAY.start && u <= CAUSEWAY.end ? kingdom.causewayY(u) : surfaceHeight(p.x, p.z); return new THREE.Vector3(p.x, Math.max(y, surfaceHeight(p.x, p.z)) + 0.12, p.z); };
  const segments = Math.round(RAIL1 - RAIL0);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 1.02), new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.4, metalness: 0.7 }), segments * 2);
  for (let s = 0; s < segments; s++) for (const [j, v] of [[0, -0.6], [1, 0.6]]) {
    const a = railPoint(RAIL0 + s, v), b = railPoint(RAIL0 + s + 1, v);
    dummy.position.copy(a).add(b).multiplyScalar(0.5); dummy.scale.set(1, 1, 1); dummy.lookAt(b); dummy.updateMatrix();
    rails.setMatrixAt(s * 2 + j, dummy.matrix);
  }
  root.add(rails);
  const cart = new THREE.Group();
  const bin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.8), timber); bin.position.y = 0.6;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.9), gold); trim.position.y = 0.98;
  const load = new THREE.Group();
  for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), crystal); c.position.set((k % 2 - 0.5) * 0.6, 1.2, (k - 2) * 0.32); c.scale.y = 1.5; load.add(c); }
  cart.add(bin, trim, load); root.add(cart);

  // --- Dust in the lowland, glitter on the enclave: one particle cloud that follows the player. ---
  const COUNT = 420, SPAN = 70, TALL = 22;
  const motes = new Float32Array(COUNT * 3), tints = new Float32Array(COUNT * 3), seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) { motes[i * 3] = (hash(i, 1) - 0.5) * SPAN; motes[i * 3 + 1] = hash(i, 2) * TALL; motes[i * 3 + 2] = (hash(i, 3) - 0.5) * SPAN; seeds[i] = hash(i, 4) * 10; }
  const cloud = new THREE.BufferGeometry();
  cloud.setAttribute('position', new THREE.BufferAttribute(motes, 3));
  cloud.setAttribute('color', new THREE.BufferAttribute(tints, 3));
  // Kenney Particle Pack sprites: soft circles for dust, four-point stars for the enclave's glitter.
  const dustSprite = new THREE.TextureLoader().load(encodeURI(`${PARTICLES}circle_05.png`));
  const starSprite = new THREE.TextureLoader().load(encodeURI(`${PARTICLES}star_06.png`));
  const dust = new THREE.Points(cloud, new THREE.PointsMaterial({ map: dustSprite, size: 0.35, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false }));
  dust.frustumCulled = false; root.add(dust);
  const DUST = new THREE.Color(0xb08a5a), GLITTER = [new THREE.Color(0xffffff), new THREE.Color(0xffe9a8), new THREE.Color(0xcfe9ff)];

  let time = 0;
  return {
    root, colliders,
    update(dt, chaos, player) {
      time += dt;
      // Smoke rises, spreads and fades; chaos makes it thicker and faster.
      for (const s of smoke) {
        s.t = (s.t + dt * (0.09 + chaos * 0.08)) % 1;
        const r = 1.5 + s.t * (6 + chaos * 4);
        s.sprite.position.set(s.x + s.t * 5, s.base + s.t * 16, s.z + Math.sin(s.t * 4 + s.x) * 1.5);
        s.sprite.scale.set(r, r, 1);
        s.sprite.material.opacity = Math.sin(s.t * Math.PI) * (0.55 + chaos * 0.3);
      }
      // The balance tips toward the crystals and back.
      beam.rotation.x = Math.sin(time * 0.6) * 0.12;
      for (const p of pans) p.rotation.x = -beam.rotation.x;
      // The cart: up the causeway loaded (40 s), back down empty.
      const loop = (time / 80) % 1, upward = loop < 0.5, k = upward ? loop * 2 : 2 - loop * 2;
      const at = railPoint(RAIL0 + 1 + k * (segments - 2), 0), next = railPoint(RAIL0 + 1 + Math.min(1, k + 0.01) * (segments - 2), 0);
      cart.position.copy(at); if (next.distanceToSquared(at) > 1e-6) cart.lookAt(next); load.visible = upward;
      // Particles: keep the cloud around the player; dust below, glitter on the enclave.
      const inside = kingdom.area(player.position.x, player.position.z);
      dust.visible = inside;
      if (!inside) return;
      const royal = player.position.y > CITADEL_TOP - 2 && kingdom.royal(player.position.x, player.position.z);
      dust.material.blending = royal ? THREE.AdditiveBlending : THREE.NormalBlending;
      dust.material.map = royal ? starSprite : dustSprite;
      dust.material.size = royal ? 0.55 : 0.35 + chaos * 0.15;
      dust.position.set(Math.floor(player.position.x / SPAN) * SPAN, royal ? CITADEL_TOP : surfaceHeight(player.position.x, player.position.z) - 2, Math.floor(player.position.z / SPAN) * SPAN);
      for (let i = 0; i < COUNT; i++) {
        let x = motes[i * 3] + dt * (0.6 + chaos * 3) , z = motes[i * 3 + 2];
        const wx = dust.position.x + x - player.position.x, wz = dust.position.z + z - player.position.z;
        if (wx > SPAN / 2) x -= SPAN; else if (wx < -SPAN / 2) x += SPAN;           // wrap around the player
        if (wz > SPAN / 2) motes[i * 3 + 2] -= SPAN; else if (wz < -SPAN / 2) motes[i * 3 + 2] += SPAN;
        motes[i * 3] = x;
        motes[i * 3 + 1] = (motes[i * 3 + 1] + dt * 0.15) % TALL;
        const c = royal ? GLITTER[i % 3] : DUST, twinkle = royal ? Math.max(0, Math.sin(time * 3 + seeds[i] * 7)) ** 3 : 0.6 + 0.4 * Math.sin(time + seeds[i]);
        tints[i * 3] = c.r * twinkle; tints[i * 3 + 1] = c.g * twinkle; tints[i * 3 + 2] = c.b * twinkle;
      }
      cloud.attributes.position.needsUpdate = true; cloud.attributes.color.needsUpdate = true;
    },
  };
}
