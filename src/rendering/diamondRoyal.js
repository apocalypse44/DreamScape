// Diamond · the Royal Enclave on the citadel mesa (DIAMOND_KINGDOM_TERRAIN.md §2b, §14). Everything the
// quarry digs ends up here: the Great Prism floating over the forecourt and throwing rainbow beams,
// a crystal garden, fountains, a gold balustrade the royals look down from, and gold lanterns lining
// the causeway. The lowland below gets dust; up here everything sparkles. No new lights.
import { CITADEL, CITADEL_TOP, CAUSEWAY, CAUSEWAY_BREAK, MARBLE } from '../models/diamond.js';

const GOLD = 0xffd36b, SLATE = 0x4a5568;
const SPECTRUM = [0xff5a5a, 0xffa94d, 0xffe066, 0x69db7c, 0x4dabf7, 0xb197fc];

// A soft rainbow star for the light the prism scatters onto the forecourt.
function causticTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.globalCompositeOperation = 'lighter';
  SPECTRUM.forEach((hex, i) => {
    const col = `#${hex.toString(16).padStart(6, '0')}`;
    for (let k = 0; k < 2; k++) {
      const a = (i / SPECTRUM.length + k / 2) * Math.PI * 2;
      const grad = g.createRadialGradient(128, 128, 8, 128, 128, 126);
      grad.addColorStop(0, `${col}aa`); grad.addColorStop(1, `${col}00`);
      g.fillStyle = grad; g.beginPath(); g.moveTo(128, 128);
      g.arc(128, 128, 126, a - 0.16, a + 0.16); g.closePath(); g.fill();
    }
  });
  return new THREE.CanvasTexture(c);
}

// kingdom: world.diamond. surfaceHeight(x, z): drawn ground.
export function buildDiamondRoyal({ scene, kingdom, surfaceHeight }) {
  const root = new THREE.Group(); root.name = 'diamond-royal'; scene.add(root);
  const colliders = [];
  const centre = kingdom.at(CITADEL.u, CITADEL.v), into = kingdom.at(CITADEL.u + 1, CITADEL.v);
  // Same local frame as the citadel: +z into the kingdom, the causeway arrives from -z.
  const enclave = new THREE.Group();
  enclave.position.set(centre.x, CITADEL_TOP, centre.z);
  enclave.rotation.y = Math.atan2(into.x - centre.x, into.z - centre.z);
  root.add(enclave);
  const up = new THREE.Vector3(0, 1, 0);
  const block = (lx, lz, radius) => { const p = new THREE.Vector3(lx, 0, lz).applyAxisAngle(up, enclave.rotation.y).add(enclave.position); colliders.push({ x: p.x, z: p.z, radius }); };

  const gold = new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0x6a4a10, emissiveIntensity: 0.45, roughness: 0.3, metalness: 0.75 });
  const marble = new THREE.MeshStandardMaterial({ color: MARBLE, roughness: 0.4, metalness: 0.05, flatShading: true });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xdff3ff, emissive: 0x3a7fb0, emissiveIntensity: 0.55,
    roughness: 0.05, metalness: 0.55, flatShading: true, transparent: true, opacity: 0.9 });
  const water = new THREE.MeshStandardMaterial({ color: 0x8fd8ff, emissive: 0x1d6b8f, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.3 });
  const dummy = new THREE.Object3D();

  // --- The Great Prism: a brilliant-cut diamond the size of a house, over the forecourt. ---
  const FORECOURT = new THREE.Vector3(0, 0, -25), PRISM_Y = 17;
  const cut = [[0, -4.6], [4.2, 0], [4.2, 0.35], [2.5, 1.9], [0, 1.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const prism = new THREE.Group();
  prism.position.set(FORECOURT.x, PRISM_Y, FORECOURT.z);
  const shell = new THREE.Mesh(new THREE.LatheGeometry(cut, 8), crystal);
  const core = new THREE.Mesh(new THREE.LatheGeometry(cut, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.setScalar(0.55);
  const girdle = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.12, 4, 8), gold);
  girdle.rotation.x = Math.PI / 2; girdle.position.y = 0.17;
  prism.add(shell, core, girdle);
  enclave.add(prism);
  // Shards orbit on a tilted ring.
  const orbit = new THREE.Group(); orbit.position.copy(prism.position); orbit.rotation.set(0.35, 0, 0.2); enclave.add(orbit);
  const shards = Array.from({ length: 8 }, (_, k) => {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), crystal);
    const a = k / 8 * Math.PI * 2; s.position.set(Math.cos(a) * 8, 0, Math.sin(a) * 8); s.scale.y = 1.8;
    orbit.add(s); return s;
  });
  // Rainbow beams from the tip to a ring on the forecourt, and the scattered light on the floor.
  const beams = SPECTRUM.map((hex, i) => {
    const a = i / SPECTRUM.length * Math.PI * 2, foot = new THREE.Vector3(Math.cos(a) * 8, 0.05, Math.sin(a) * 8 - 25);
    const tip = new THREE.Vector3(FORECOURT.x, PRISM_Y - 4.6, FORECOURT.z), len = tip.distanceTo(foot);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 1.3, len, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.copy(tip).add(foot).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(up, tip.clone().sub(foot).normalize());
    enclave.add(mesh); return mesh;
  });
  const caustic = new THREE.Mesh(new THREE.CircleGeometry(10, 48), new THREE.MeshBasicMaterial({ map: causticTexture(), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  caustic.rotation.x = -Math.PI / 2; caustic.position.set(FORECOURT.x, 0.06, FORECOURT.z);
  enclave.add(caustic);
  // Star glints flashing on the prism's facets (Kenney Particle Pack).
  const glintMat = new THREE.SpriteMaterial({ map: new THREE.TextureLoader().load(encodeURI('assets/kenney_particle-pack/PNG (Transparent)/star_06.png')),
    color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const glints = Array.from({ length: 10 }, (_, k) => {
    const g = new THREE.Sprite(glintMat.clone()), a = k * 2.4, y = (k % 5) / 4 * 5.5 - 4;
    const r = y > 0 ? 4.2 - y * 0.9 : 4.2 * (1 + y / 4.6);
    g.position.set(Math.cos(a) * r, y, Math.sin(a) * r); prism.add(g); return { g, phase: k * 1.7 };
  });
  // A gold hexagon inlaid under the prism.
  const inlay = new THREE.Mesh(new THREE.RingGeometry(9.2, 9.8, 6), gold);
  inlay.rotation.x = -Math.PI / 2; inlay.position.set(FORECOURT.x, 0.04, FORECOURT.z);
  enclave.add(inlay);

  // --- Crystal garden: gold-trunked trees with crystal crowns, between the palace and the rim. ---
  const trees = [];
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2 + 0.2, r = k % 2 ? 24 : 28.5;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (z < -17 && Math.abs(x) < 19) continue;          // keep the forecourt and the causeway open
    trees.push({ x, z, h: 2.6 + (k % 3) * 0.6 });
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.24, 1, 6), gold, trees.length);
  const crowns = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.55, 0), crystal, trees.length * 5);
  trees.forEach((t, i) => {
    dummy.position.set(t.x, t.h / 2, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, t.h, 1); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let c = 0; c < 5; c++) {
      const a = c / 5 * Math.PI * 2 + i;
      dummy.position.set(t.x + (c ? Math.cos(a) * 0.7 : 0), t.h + (c ? 0.2 : 0.8), t.z + (c ? Math.sin(a) * 0.7 : 0));
      dummy.rotation.set(c * 0.3, a, c ? 0.5 : 0); dummy.scale.set(1, c ? 1.4 : 2, 1); dummy.updateMatrix();
      crowns.setMatrixAt(i * 5 + c, dummy.matrix);
    }
    block(t.x, t.z, 0.4);
  });
  enclave.add(trunks, crowns);

  // --- Two fountains flanking the forecourt: marble basins, gold rims, a crystal jet. ---
  const jets = [];
  for (const sx of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(sx * 12.5, 0, -24);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.9, 6), marble); basin.position.y = 0.45;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.14, 4, 6), gold); rim.rotation.x = Math.PI / 2; rim.position.y = 0.92;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.8, 6), water); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.8;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.2, 6), marble); column.position.y = 1.9;
    const jet = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), crystal); jet.position.y = 3.6; jet.scale.y = 1.6;
    f.add(basin, rim, pool, column, jet); enclave.add(f); jets.push(jet);
    block(sx * 12.5, -24, 3.3);
  }

  // --- Gold balustrade on the mesa rim, open where the causeway arrives. ---
  const RIM = CITADEL.r - 1.2, posts = [];
  for (let a = 0; a < Math.PI * 2; a += 1.6 / RIM) {
    const x = Math.sin(a) * RIM, z = Math.cos(a) * RIM;
    if (z < 0 && Math.abs(x) < CAUSEWAY.half + 1.5) continue;
    posts.push({ x, z, a });
  }
  const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 6), marble, posts.length);
  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.12, 1.62), gold, posts.length);
  posts.forEach((p, i) => {
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.position.set(p.x, 0.55, p.z); dummy.updateMatrix(); postMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 1.12, p.z); dummy.rotation.y = p.a + Math.PI / 2; dummy.updateMatrix(); railMesh.setMatrixAt(i, dummy.matrix);
    block(p.x, p.z, 0.45);
  });
  enclave.add(postMesh, railMesh);

  // --- Gold lanterns up the causeway: the royal road is lit, the lowland is not. ---
  const lanterns = [];
  for (let u = CAUSEWAY.start + 2; u < CAUSEWAY.end; u += 8) {
    if (Math.abs(u - CAUSEWAY_BREAK.u) < CAUSEWAY_BREAK.half + 5) continue;     // none over the gap or beside the bridge towers
    for (const v of [-4, 4]) lanterns.push(kingdom.at(u, v));
  }
  const lanternPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 6), new THREE.MeshStandardMaterial({ color: SLATE, roughness: 0.8, flatShading: true }), lanterns.length);
  const lanternGems = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xfff1c6 }), lanterns.length);
  lanterns.forEach((p, i) => {
    const y = surfaceHeight(p.x, p.z);
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.position.set(p.x, y + 1.3, p.z); dummy.updateMatrix(); lanternPosts.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, y + 2.95, p.z); dummy.scale.set(1, 1.5, 1); dummy.updateMatrix(); lanternGems.setMatrixAt(i, dummy.matrix);
    colliders.push({ x: p.x, z: p.z, radius: 0.4 });
  });
  root.add(lanternPosts, lanternGems);

  let time = 0;
  return {
    root, colliders,
    update(dt, chaos) {
      time += dt;
      prism.rotation.y = time * (0.25 + chaos * 0.6);
      prism.position.y = PRISM_Y + Math.sin(time * 0.7) * 0.5;
      orbit.rotation.y = -time * (0.3 + chaos);
      for (const s of shards) s.rotation.y = time * 2;
      beams.forEach((b, i) => { b.material.opacity = 0.16 + 0.08 * Math.sin(time * 1.7 + i) - chaos * 0.08; });
      caustic.rotation.z = time * 0.2;
      core.material.opacity = 0.45 + 0.15 * Math.sin(time * 2.3);
      for (const { g, phase } of glints) { const f = Math.max(0, Math.sin(time * 1.3 + phase)) ** 8; g.material.opacity = f; g.scale.setScalar(0.4 + f * 2.2); }
      for (const j of jets) j.rotation.y = time;
    },
  };
}
