// Diamond Kingdom skyline: the Prism Citadel on its mesa (Phases 1 and 5 of DIAMOND_KINGDOM_TERRAIN.md).
// Kenney Castle Kit hexagon towers and curtain walls (procedural stand-ins until they load), a north
// gatehouse, gold banners, a hexagonal keep and its crown of crystal spires; the drawbridge across the
// causeway's break; and the inversion core's beam from the quarry to the tallest spire when the relay
// runs. While the Triad holds the citadel its crystals glow violet; once the relay powers they clear
// to ice-white. No new lights.
import { CITADEL, CITADEL_TOP, CAUSEWAY_BREAK, BRIDGE } from '../models/diamond.js';
import { socketCenter, BOARD } from '../models/diamondCampaign.js';
import { DEFAULT_RELAY, DIRS } from '../models/diamondWfc.js';
import { loadModel } from './models.js';

const KENNEY = 'assets/kenney_castle-kit/Models/GLB format/';
const SLATE_TINT = new THREE.Color(0xaab6cc);
const STONE = 0x4a5568, ROOF = 0x2f3a4a, GOLD = 0xffd36b;
const ICE = new THREE.Color(0xcfe9ff), ICE_GLOW = new THREE.Color(0x3a6f9a);
const VIOLET = new THREE.Color(0xb48cff), VIOLET_GLOW = new THREE.Color(0x5a1f9a);

// kingdom: world.diamond. surfaceHeight(x, z): drawn ground. held(): whether the Triad still holds the citadel.
export function buildDiamondKingdom({ scene, kingdom, surfaceHeight, held = () => true }) {
  const root = new THREE.Group();
  root.name = 'diamond-kingdom';
  scene.add(root);
  const colliders = [];
  const centre = kingdom.at(CITADEL.u, CITADEL.v);
  const into = kingdom.at(CITADEL.u + 1, CITADEL.v);
  // Local frame: +z runs into the kingdom (south), +x is east (-v). The gatehouse faces -z.
  const citadel = new THREE.Group();
  citadel.position.set(centre.x, CITADEL_TOP, centre.z);
  citadel.rotation.y = Math.atan2(into.x - centre.x, into.z - centre.z);
  root.add(citadel);
  const toWorld = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), citadel.rotation.y).add(citadel.position);
  const block = (lx, lz, radius) => { const p = toWorld(lx, lz); colliders.push({ x: p.x, z: p.z, radius }); };

  const stone = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.85, flatShading: true });
  const roof = new THREE.MeshStandardMaterial({ color: ROOF, roughness: 0.7, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0x6a4a10, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.6 });
  const crystal = new THREE.MeshStandardMaterial({ color: VIOLET.clone(), emissive: VIOLET_GLOW.clone(), emissiveIntensity: 0.9,
    roughness: 0.12, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.93 });

  // Mesa body: the terrain cliff only exists where chunks are loaded, so from far away this keeps the
  // citadel standing on rock. It sits just inside the terrain, which hides it up close.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(CITADEL.r - 1, CITADEL.r + 2, CITADEL.h - 0.5, 9),
    new THREE.MeshStandardMaterial({ color: 0xa98450, roughness: 0.95, flatShading: true }));
  body.position.y = -(CITADEL.h + 0.5) / 2;
  citadel.add(body);

  // Procedural stand-ins: shown until the Kenney modules load (and kept if they never do).
  const standIns = [], towers = [], walls = [];
  const hexTower = (lx, lz, radius, height, roofHeight) => {
    towers.push({ lx, lz, width: radius * 2 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.12, height, 6), stone);
    tower.position.set(lx, height / 2, lz);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.08, radius * 1.08, 0.5, 6), gold);
    band.position.set(lx, height - 0.6, lz);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.2, roofHeight, 6), roof);
    cap.position.set(lx, height + roofHeight / 2, lz);
    citadel.add(tower, band, cap); standIns.push(tower, band, cap);
    block(lx, lz, radius * 1.12 + 0.2);
  };

  // Curtain walls on a 32 m square, gatehouse gap on the north (-z) side.
  const H = 16, WALL = 7, GAP = 3.5;
  const merlonGeo = new THREE.BoxGeometry(0.8, 0.8, 1.7);
  const wall = (lx, lz, w, d) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, WALL, d), stone);
    mesh.position.set(lx, WALL / 2, lz);
    citadel.add(mesh); standIns.push(mesh);
    const along = w > d, length = Math.max(w, d);
    walls.push({ lx, lz, along, length });
    for (let s = -length / 2 + 1; s <= length / 2 - 1; s += 1.8) block(along ? lx + s : lx, along ? lz : lz + s, 1.05);
    for (let s = -length / 2 + 0.8; s < length / 2; s += 1.6) {     // crenellations
      const merlon = new THREE.Mesh(merlonGeo, stone);
      merlon.position.set(along ? lx + s : lx, WALL + 0.4, along ? lz : lz + s);
      citadel.add(merlon); standIns.push(merlon);
    }
  };
  wall(0, H, 2 * H, 1.6);                                   // south
  wall(-H, 0, 1.6, 2 * H); wall(H, 0, 1.6, 2 * H);          // west, east
  const side = (H - GAP) / 2 + GAP;                         // north, either side of the gate
  wall(-side, -H, H - GAP, 1.6); wall(side, -H, H - GAP, 1.6);
  for (const [x, z] of [[-H, -H], [H, -H], [-H, H], [H, H]]) hexTower(x, z, 3.2, 14, 5);
  for (const s of [-1, 1]) hexTower(s * (GAP + 1.2), -H, 1.9, 10.5, 3.5);   // gatehouse
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2 * GAP + 1, 1.4, 1.8), stone);
  lintel.position.set(0, 8.2, -H);
  const keystone = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), gold);
  keystone.scale.set(0.8, 1.2, 0.4);
  keystone.position.set(0, 8.2, -H - 1);
  citadel.add(lintel, keystone);
  // Diamond banners on the north wall, facing the causeway.
  const bannerGeo = new THREE.BoxGeometry(1.4, 4, 0.1);
  for (const x of [-11, -6.5, 6.5, 11]) {
    const banner = new THREE.Mesh(bannerGeo, gold);
    banner.position.set(x, 4.6, -H - 0.9);
    citadel.add(banner); standIns.push(banner);
  }

  // The keep and its crystal crown: a tall central spire, six more leaning out from the rim.
  const KEEP_R = 6.5, KEEP_H = 18;
  const keep = new THREE.Mesh(new THREE.CylinderGeometry(KEEP_R, KEEP_R * 1.1, KEEP_H, 6), stone);
  keep.position.y = KEEP_H / 2;
  const keepBand = new THREE.Mesh(new THREE.CylinderGeometry(KEEP_R * 1.06, KEEP_R * 1.06, 0.7, 6), gold);
  keepBand.position.y = KEEP_H - 0.5;
  const door = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.4), roof);            // sealed: "The Citadel is held"
  door.position.set(0, 2.5, -KEEP_R * 0.94);
  citadel.add(keep, keepBand, door);
  block(0, 0, KEEP_R * 1.1 + 0.2);
  const spireGeo = new THREE.CylinderGeometry(0, 1, 1, 6);
  const spire = (x, z, radius, height, leanX, leanZ, base = KEEP_H - 1) => {
    const mesh = new THREE.Mesh(spireGeo, crystal);
    mesh.scale.set(radius, height, radius);
    mesh.position.set(x, base + height / 2, z);
    mesh.rotation.set(leanZ, 0, -leanX);
    mesh.castShadow = true;
    citadel.add(mesh);
    return mesh;
  };
  spire(0, 0, 2.6, 30, 0, 0);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2 + Math.PI / 6;
    spire(Math.sin(a) * 3.8, Math.cos(a) * 3.8, 1.5, 14 + (k % 3) * 4, Math.sin(a) * 0.28, Math.cos(a) * 0.28);
  }
  // Corner towers carry smaller crystal finials; the tallest spire carries the spinning diamond.
  const cornerFinials = [[-H, -H], [H, -H], [-H, H], [H, H]].map(([x, z]) => spire(x, z, 0.8, 4, 0, 0, 14 + 4.2));
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), gold);
  finial.scale.y = 1.6;
  finial.position.y = KEEP_H + 30 + 1.5;
  citadel.add(finial);
  for (const m of citadel.children) if (m !== body) m.castShadow = true;

  // --- Kenney Castle Kit: hexagon towers (base, mid, top, roof) and curtain-wall modules replace the
  // stand-ins once all of them have loaded. The hexagon pieces share a footprint, so each is scaled
  // to its tower's width and stacked; everything is slate-tinted to match the kingdom.
  const kit = name => loadModel(encodeURI(`${KENNEY}${name}.glb`), 1).then(m => {
    m.object.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.multiply(SLATE_TINT); } });
    return m;
  });
  Promise.all(['tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-top', 'tower-hexagon-roof', 'wall', 'flag-banner-long'].map(kit))
    .then(([base, mid, top, roofKit, wallKit, banner]) => {
      for (const t of towers) {
        let y = 0;
        for (const m of [base, ...(t.width > 5 ? [mid] : []), top, roofKit]) {
          const copy = m.object.clone(true), f = t.width / m.size.x;
          copy.scale.multiplyScalar(f); copy.position.set(t.lx, y, t.lz); citadel.add(copy);
          y += m.size.y * f;
        }
        t.top = y;
      }
      cornerFinials.forEach((f, i) => { f.position.y = towers[i].top + 1.2; });
      for (const w of walls) {
        const n = Math.max(1, Math.round(w.length / 5.3)), width = w.length / n, height = width * wallKit.size.y / wallKit.size.x;
        for (let k = 0; k < n; k++) {
          const copy = wallKit.object.clone(true), s = -w.length / 2 + width * (k + 0.5);
          copy.scale.set(width / wallKit.size.x, height / wallKit.size.y, 1.7 / wallKit.size.z);
          copy.position.set(w.along ? w.lx + s : w.lx, 0, w.along ? w.lz : w.lz + s);
          copy.rotation.y = w.along ? 0 : Math.PI / 2;
          citadel.add(copy);
        }
      }
      for (const x of [-11, -6.5, 6.5, 11]) {
        const copy = banner.object.clone(true);
        copy.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.set(GOLD); } });
        copy.scale.multiplyScalar(5); copy.position.set(x, 1.6, -H - 0.95); copy.rotation.y = Math.PI / 2;
        citadel.add(copy);
      }
      for (const m of standIns) m.visible = false;
    }).catch(error => console.warn('Prism Citadel: Kenney castle modules unavailable, keeping the blockout.', error));

  // --- The drawbridge across the causeway's break: plank deck, rail posts, two bridge towers, chains. ---
  const ga = kingdom.at(0, 0), gb = kingdom.at(1, 0), yaw = Math.atan2(gb.x - ga.x, gb.z - ga.z);
  const reach = CAUSEWAY_BREAK.half + 1 + BRIDGE.overlap, mid = kingdom.at(CAUSEWAY_BREAK.u, 0);
  const deckY = u => kingdom.causewayY(u);
  const slope = Math.atan2(deckY(CAUSEWAY_BREAK.u + 1) - deckY(CAUSEWAY_BREAK.u - 1), 2);
  const deck = new THREE.Group();
  deck.rotation.order = 'YXZ'; deck.rotation.set(-slope, yaw, 0);       // tilt with the causeway, then face along it
  deck.position.set(mid.x, deckY(CAUSEWAY_BREAK.u) - 0.35, mid.z); root.add(deck);
  const planks = new THREE.Mesh(new THREE.BoxGeometry(2 * BRIDGE.half, 0.35, 2 * reach), new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.95 }));
  planks.position.y = 0.175; planks.receiveShadow = true; deck.add(planks);
  loadModel(encodeURI(`${KENNEY}bridge-draw.glb`), 1).then(({ object, size }) => {
    object.scale.set(2 * reach / size.x, 0.35 / size.y, 2 * BRIDGE.half / size.z); object.rotation.y = Math.PI / 2;
    deck.add(object); planks.visible = false;
  }).catch(error => console.warn('Drawbridge model unavailable, keeping the planks.', error));
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.5, metalness: 0.7 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.8 });
  const railPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6), brassMat, kingdom.bridge.rails.length);
  const dummy = new THREE.Object3D();
  kingdom.bridge.rails.forEach((r, i) => {
    dummy.position.set(r.x, deckY(kingdom.local(r.x, r.z).u) + 0.55, r.z); dummy.updateMatrix(); railPosts.setMatrixAt(i, dummy.matrix);
  });
  root.add(railPosts);
  const nearTop = deckY(CAUSEWAY_BREAK.u - reach);
  for (const s of [-1, 1]) {
    const foot = kingdom.at(CAUSEWAY_BREAK.u - reach - 0.6, s * 4.6), fy = surfaceHeight(foot.x, foot.z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, nearTop + 5 - fy, 6), stone);
    post.position.set(foot.x, (fy + nearTop + 5) / 2, foot.z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2, 6), roof); cap.position.set(foot.x, nearTop + 6, foot.z);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), gold); gem.scale.y = 1.5; gem.position.set(foot.x, nearTop + 7.4, foot.z);
    post.castShadow = cap.castShadow = true;
    root.add(post, cap, gem);
    colliders.push({ x: foot.x, z: foot.z, radius: 1.2 });
    // A chain from the tower top to the deck's far corner.
    const far = kingdom.at(CAUSEWAY_BREAK.u + reach - 0.3, s * BRIDGE.half);
    const a = new THREE.Vector3(foot.x, nearTop + 4.6, foot.z), b = new THREE.Vector3(far.x, deckY(CAUSEWAY_BREAK.u + reach) + 0.2, far.z);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, a.distanceTo(b), 4), ironMat);
    chain.position.copy(a).add(b).multiplyScalar(0.5); chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    root.add(chain);
  }

  // --- The inversion core's beam: from the relay's core port on the quarry floor to the tallest spire. ---
  const corePort = DEFAULT_RELAY.ports.find(p => p.role === 'core');
  const coreCell = socketCenter(kingdom.layout, corePort.x, corePort.y);
  const coreAt = { x: coreCell.x + DIRS[corePort.dir][0] * BOARD.socket * 0.95, z: coreCell.z + DIRS[corePort.dir][1] * BOARD.socket * 0.95 };
  const from = new THREE.Vector3(coreAt.x, kingdom.quarry.pit(coreAt.x, coreAt.z) + 2.6, coreAt.z);   // the core crystal
  const to = toWorld(0, 0).setY(CITADEL_TOP + KEEP_H + 26);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 10, 1, true), beamMat);
  beam.position.copy(from).add(to).multiplyScalar(0.5); beam.scale.y = from.distanceTo(to);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  beam.visible = false; beam.frustumCulled = false; root.add(beam);

  // --- Chaos: violet lightning cracks down onto the spires and the corner finials. ---
  const strikeTargets = [toWorld(0, 0).setY(CITADEL_TOP + KEEP_H + 29), ...[[-H, -H], [H, -H], [-H, H], [H, H]].map(([x, z]) => toWorld(x, z).setY(CITADEL_TOP + 22))];
  const BOLT = 9, boltPositions = new Float32Array(BOLT * 3);
  const boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPositions, 3));
  const bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: 0xe2d0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  bolt.frustumCulled = false; root.add(bolt);
  let nextStrike = 0, struckAt = -10;
  function strike() {
    const target = strikeTargets[Math.floor(Math.random() * strikeTargets.length)];
    const sx = target.x + (Math.random() - 0.5) * 30, sz = target.z + (Math.random() - 0.5) * 30, sy = target.y + 40;
    for (let i = 0; i < BOLT; i++) {
      const k = i / (BOLT - 1), jag = i && i < BOLT - 1 ? 3.2 * (1 - k * 0.6) : 0;
      boltPositions.set([sx + (target.x - sx) * k + (Math.random() - 0.5) * jag, sy + (target.y - sy) * k, sz + (target.z - sz) * k + (Math.random() - 0.5) * jag], i * 3);
    }
    boltGeo.attributes.position.needsUpdate = true;
  }

  const tint = new THREE.Color(), glow = new THREE.Color();
  let time = 0, clear = held() ? 0 : 1, firedAt = null, wasHeld = held();
  return {
    root, colliders, citadel,
    // Height of the citadel courtyard (for spawns and tests) and the beam's target.
    courtyard: { ...centre, y: CITADEL_TOP }, spireTop: () => to.clone(),
    update(dt, chaos) {
      time += dt;
      finial.rotation.y = time * 0.8;
      clear += ((held() ? 0 : 1) - clear) * Math.min(1, dt * 0.6);   // fades over a few seconds when freed
      crystal.color.copy(tint.copy(VIOLET).lerp(ICE, clear));
      crystal.emissive.copy(glow.copy(VIOLET_GLOW).lerp(ICE_GLOW, clear));
      crystal.emissiveIntensity = 0.7 + (1 - clear) * (0.25 + chaos * 0.6) * (0.75 + 0.25 * Math.sin(time * 2.2));
      if (chaos > 0.5 && time > nextStrike) { strike(); struckAt = time; nextStrike = time + 1.2 + Math.random() * 4 / chaos; }
      const flash = Math.max(0, 1 - (time - struckAt) / 0.22);
      bolt.material.opacity = flash; bolt.visible = flash > 0;
      crystal.emissiveIntensity += flash * 2;
      // The beam fires when the Triad loses the citadel, burns bright, then settles to a faint thread.
      const isHeld = held();
      if (wasHeld && !isHeld) firedAt = time;
      if (isHeld) firedAt = null;
      wasHeld = isHeld;
      beam.visible = firedAt !== null;
      if (beam.visible) {
        const t = time - firedAt, grow = Math.min(1, t / 1.2), fade = t < 7 ? 1 : Math.max(0.22, 1 - (t - 7) / 3);
        beamMat.opacity = grow * fade * (0.85 + 0.15 * Math.sin(time * 9));
        beam.scale.x = beam.scale.z = (t < 7 ? 1.2 : 0.5) * (1 + 0.15 * Math.sin(time * 6));
      }
    },
  };
}
