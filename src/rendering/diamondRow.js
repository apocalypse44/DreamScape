// Diamond · Artificers' Row (Phase 3). Four open-front workshops on a paved street west of the
// quarry, each hiding a conduit fragment on its bench, and Orin's Artificers' Hall at the street's
// end: slate walls with crystal windows, a tiled floor, a slate round-tile roof, a forge, benches,
// shelves and the Connector Study Wall (E turns its pages). One warm light inside the hall, like the
// Rootkeeper Archive. Layout and the study pages: src/models/diamondRow.js. Kit models: Fantasy Props
// and Medieval Village (Quaternius, CC0); missing models only log a warning.
import { loadModel } from './models.js';
import { createRow, SHOPS, SHOP, HALL, STREET, STUDY, studyPage } from '../models/diamondRow.js';
import { DIAMOND_BASE } from '../models/diamond.js';
import { hasSide, DIRS } from '../models/diamondWfc.js';

const PROPS = 'assets/Fantasy Props MegaKit[Standard]/Exports/glTF/';
const VILLAGE = 'assets/Medieval Village MegaKit[Standard]/glTF/';
const STEEL = 'assets/CorrugatedSteel005_1K-JPG/CorrugatedSteel005_1K-JPG_';
const BRASS = 0xb08d57, SLATE = 0x4a5568, WOOD = 0x6b5038, CANVAS = [0xc9a24a, 0x5a6f86, 0x8a4b3a, 0x6f7a52];
// Yaw that turns a kit model (front +z = +u) to face +u, -u, +v, -v.
const FACE = { '+u': 0, '-u': Math.PI, '+v': -Math.PI / 2, '-v': Math.PI / 2 };
const TRADES = {
  forge: { sign: 'FORGE', props: [['Anvil_Log', -2.4, 1.9, 1], ['Bucket_Metal', 2.6, 1, 0.5], ['Whetstone', 2.8, 2.6, 0.7]], hearth: true },
  cutting: { sign: 'CRYSTAL CUTTER', props: [['Workbench_Drawers', -2.5, 0.8, 1.1], ['Whetstone', 2.6, 1.2, 0.7]], offcuts: true },
  storage: { sign: 'STORES', props: [['Crate_Metal', -2.7, 0.9, 0.9], ['Crate_Metal', -2.6, 2.1, 0.9], ['Barrel', 2.7, 1, 1.1], ['Shelf_Simple', 2.8, 2.6, 1.6]] },
  armoury: { sign: 'ARMOURY', props: [['WeaponStand', -2.5, 1, 1.6], ['Shield_Wooden', 2.7, 0.6, 0.9], ['Sword_Bronze', 2.4, 2.2, 1]] },
};
// Hall interior: [model, u, v, height, facing, collider radius]
const HALL_PROPS = [
  ['Anvil', 92.6, 50.8, 0.9, '-u', 0.6], ['Bucket_Metal', 96.6, 51.4, 0.5, '-u', 0.4],
  ['Workbench', 86, 62.7, 1, '-v', 0.9], ['Workbench_Drawers', 90.2, 62.7, 1.1, '-v', 0.9], ['Peg_Rack', 88, 63.5, 1.1, '-v', 0],
  ['Shelf_Simple', 85.5, 46.6, 2, '+v', 0.6], ['Shelf_Simple', 88.5, 46.6, 2, '+v', 0.6],
  ['Table_Large', 89.5, 55, 0.9, '+u', 1.3], ['Scroll_1', 89.2, 54.6, 0.12, '+u', 0], ['Book_Stack_2', 90.2, 55.6, 0.3, '+u', 0],
  ['Crate_Metal', 83.6, 47.6, 0.9, '+u', 0.6], ['Crate_Metal', 83.6, 62.4, 0.9, '+u', 0.6],
  ['Lantern_Wall', 82.9, 51, 1.1, '+u', 0], ['Lantern_Wall', 82.9, 59, 1.1, '+u', 0],
];

function label(text, { width = 4, height = 0.7, ink = '#f3e7c9', ground = '#3a2c1d' } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(512 * height / width);
  const g = canvas.getContext('2d');
  g.fillStyle = ground; g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#b08d57'; g.lineWidth = 8; g.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${Math.round(canvas.height * 0.5)}px "DM Mono", monospace`;
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 40);
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), roughness: 0.8 }));
}

// One study page: the centre tile, the good neighbour on each side and a crossed-out bad one.
function drawStudy(g, w, h, page, number) {
  g.fillStyle = '#1d222b'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b08d57'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#ffd36b'; g.font = 'bold 44px "DM Mono", monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText('CONNECTOR STUDY', 34, 26);
  g.fillStyle = '#cfe9ff'; g.font = 'bold 34px "DM Mono", monospace'; g.fillText(page.title, 34, 80);
  g.fillStyle = '#8a93a3'; g.font = '24px "DM Mono", monospace'; g.textAlign = 'right'; g.fillText(`${number}`, w - 34, 30);
  const tile = (t, x, y, s, colour) => {
    g.fillStyle = '#323a47'; g.fillRect(x - s / 2, y - s / 2, s, s);
    g.strokeStyle = '#59606f'; g.lineWidth = 3; g.strokeRect(x - s / 2, y - s / 2, s, s);
    g.fillStyle = colour;
    for (let d = 0; d < 4; d++) if (hasSide(t, d)) {
      const [dx, dy] = DIRS[d], aw = s * 0.2;
      g.fillRect(dx ? (dx > 0 ? x : x - s / 2) : x - aw / 2, dy ? (dy > 0 ? y : y - s / 2) : y - aw / 2, dx ? s / 2 : aw, dy ? s / 2 : aw);
    }
    if (t) { g.beginPath(); g.arc(x, y, s * 0.16, 0, Math.PI * 2); g.fill(); }
  };
  g.textAlign = 'left'; g.textBaseline = 'top'; g.font = '26px "DM Mono", monospace';
  if (page.sides) {
    // Centre tile, a fitting neighbour on each side, and a crossed-out misfit beside each neighbour:
    // E/W misfits further out on their row, N/S misfits in the corners next to their neighbour.
    const cx = w * 0.3, cy = h * 0.6, S = 96;
    const misfitAt = [[cx + S, cy - S], [cx + 2 * S, cy], [cx - S, cy + S], [cx - 2 * S, cy]];
    tile(page.centre, cx, cy, S, '#ffd36b');
    for (const { dir, good, bad } of page.sides) {
      const [dx, dy] = DIRS[dir], [ex, ey] = misfitAt[dir], r = S * 0.28;
      tile(good, cx + dx * S, cy + dy * S, S, '#5fc9dc');
      tile(bad, ex, ey, S * 0.55, '#7b6f6f');
      g.strokeStyle = '#e05a5a'; g.lineWidth = 6; g.beginPath(); g.moveTo(ex - r, ey - r); g.lineTo(ex + r, ey + r); g.moveTo(ex + r, ey - r); g.lineTo(ex - r, ey + r); g.stroke();
    }
    g.fillStyle = '#e8edf3';
    page.lines.forEach((line, i) => g.fillText(line, w * 0.6, h * 0.36 + i * 44, w * 0.37));
    g.fillStyle = '#5fc9dc'; g.fillText('blue: may sit here', w * 0.6, h * 0.62);
    g.fillStyle = '#e05a5a'; g.fillText('crossed: may not', w * 0.6, h * 0.62 + 40);
  } else {
    g.fillStyle = '#e8edf3'; g.font = '30px "DM Mono", monospace';
    page.lines.forEach((line, i) => g.fillText(line, 34, 170 + i * 70, w - 68));
    g.fillStyle = '#8a93a3'; g.fillText('Press E to start again.', 34, 170 + page.lines.length * 70 + 20);
  }
}

// kingdom: world.diamond. keys: held-key set. notify(text, ms): toast.
export function buildDiamondRow({ scene, kingdom, keys, notify }) {
  const row = createRow(kingdom);
  const root = new THREE.Group(); root.name = 'diamond-row'; scene.add(root);
  const obstacles = new THREE.Group(); root.add(obstacles);     // walls and ceiling: the camera stays inside
  const a = kingdom.at(0, 0), b = kingdom.at(1, 0);
  const frame = new THREE.Group();                              // local x = -v, z = u, y = 0 at the floor
  frame.position.set(a.x, DIAMOND_BASE, a.z); frame.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  root.add(frame);
  const obstacleFrame = frame.clone(false); obstacles.add(obstacleFrame);
  const colliders = [...row.colliders];
  const block = (u, v, radius) => radius && colliders.push({ ...kingdom.at(u, v), radius });
  const box = (material, u, v, y, du, h, dv, parent = frame) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(dv, h, du), material);
    mesh.position.set(-v, y, u); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const kit = (path, u, v, height, facing, y = 0) => loadModel(encodeURI(path), height).then(({ object }) => {
    object.position.set(-v, y, u); object.rotation.y = FACE[facing]; frame.add(object); return object;
  }).catch(error => console.warn(`Artificers' Row: ${path} unavailable.`, error));

  const wood = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.95, flatShading: true });
  const planks = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.95 });
  const brass = new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.35, metalness: 0.8 });
  const slate = new THREE.MeshStandardMaterial({ color: SLATE, roughness: 0.85, flatShading: true });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0x3a6f9a, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3, flatShading: true });
  const steelTex = name => { const t = new THREE.TextureLoader().load(`${STEEL}${name}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t; };
  const steel = new THREE.MeshStandardMaterial({ map: steelTex('Color'), normalMap: steelTex('NormalGL'), color: 0xa08a70, roughness: 0.55, metalness: 0.45 });

  // --- Workshops ---
  SHOPS.forEach((shop, n) => {
    const { w, d, h } = SHOP, f = shop.face, back = shop.v - f * d / 2, front = shop.v + f * d / 2, trade = TRADES[shop.trade];
    const toward = f > 0 ? '+v' : '-v';
    box(planks, shop.u, shop.v, 0.06, w, 0.12, d);
    box(wood, shop.u, back, h / 2, w, h, 0.25);
    for (const s of [-1, 1]) {
      box(wood, shop.u + s * w / 2, (back + front - f * 0.4) / 2, h / 2, 0.25, h, d - 0.4);
      box(wood, shop.u + s * (w / 2 - 0.1), front - f * 0.2, h / 2, 0.3, h, 0.3);           // front posts
    }
    const roof = box(steel, shop.u, shop.v + f * 0.3, h + 0.3, w + 0.8, 0.08, d + 1.2); roof.rotation.z = 0.14 * f;
    const awning = box(new THREE.MeshStandardMaterial({ color: CANVAS[n % CANVAS.length], roughness: 0.9, side: THREE.DoubleSide }),
      shop.u, front + f * 0.9, h - 0.35, w - 0.4, 0.04, 1.8); awning.rotation.z = 0.32 * f;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, w + 0.6, 8), brass);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(-(back + f * 0.25), h - 0.2, shop.u); frame.add(pipe);
    const sign = label(trade.sign, { width: 3.4, height: 0.6 });
    sign.position.set(-(front + f * 0.05), h + 0.55, shop.u); sign.rotation.y = FACE[toward]; frame.add(sign);
    // Workbench against the back wall; the fragment floats in front of it (drawn by diamondCampaign.js).
    kit(`${PROPS}Workbench.gltf`, shop.u, back + f * 0.65, 1, toward);
    block(shop.u, back + f * 0.65, 0.7);
    for (const [model, du, dv, height] of trade.props) {
      kit(`${PROPS}${model}.gltf`, shop.u + du, back + f * dv, height, toward);
      block(shop.u + du, back + f * dv, 0.5);
    }
    if (trade.hearth) {                                  // a small brick hearth with live coals
      box(new THREE.MeshStandardMaterial({ color: 0x5a3a2e, roughness: 0.95, flatShading: true }), shop.u + 2.6, back + f * 2.4, 0.5, 1.4, 1, 1.2);
      box(new THREE.MeshBasicMaterial({ color: 0xff7a2e }), shop.u + 2.6, back + f * 2.4, 1.02, 1, 0.04, 0.8);
    }
    if (trade.offcuts) for (let k = 0; k < 6; k++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + (k % 3) * 0.05, 0), crystal);
      c.position.set(-(back + f * (1.1 + (k % 2) * 0.3)), 1.02, shop.u - 1.6 + k * 0.6); c.scale.y = 1.6; frame.add(c);
    }
  });

  // --- Orin's Artificers' Hall ---
  const { u0, u1, v0, v1, h: H, door } = HALL, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, T = 0.6;
  const doorLo = STREET.v - door / 2, doorHi = STREET.v + door / 2;
  box(slate, u0, (v0 + doorLo) / 2, H / 2, T, H, doorLo - v0, obstacleFrame);
  box(slate, u0, (doorHi + v1) / 2, H / 2, T, H, v1 - doorHi, obstacleFrame);
  box(slate, u0, STREET.v, (4.2 + H) / 2, T, H - 4.2, door, obstacleFrame);           // over the door
  box(slate, u1, vc, H / 2, T, H, v1 - v0 + T, obstacleFrame);
  box(slate, uc, v0, H / 2, u1 - u0, H, T, obstacleFrame);
  box(slate, uc, v1, H / 2, u1 - u0, H, T, obstacleFrame);
  box(slate, uc, vc, H + 0.15, u1 - u0 + T, 0.3, v1 - v0 + T, obstacleFrame);         // ceiling
  // Brass bands at the base and eaves, crystal windows in the long walls.
  for (const y of [0.25, H - 0.35]) {
    box(brass, uc, v0, y, u1 - u0 + 0.1, 0.18, T + 0.08); box(brass, uc, v1, y, u1 - u0 + 0.1, 0.18, T + 0.08);
    box(brass, u1, vc, y, T + 0.08, 0.18, v1 - v0 + 0.1);
  }
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x4a8fc0, emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 });
  for (const u of [85.5, 90, 94.5]) for (const v of [v0, v1]) {
    box(glass, u, v, 3.6, 1.5, 2.4, T + 0.1);
    box(brass, u, v, 4.85, 1.7, 0.14, T + 0.14); box(brass, u, v, 2.35, 1.7, 0.14, T + 0.14);
  }
  // Door frame and a gold diamond keystone, a sign over it.
  for (const s of [-1, 1]) box(brass, u0 - 0.05, STREET.v + s * (door / 2 + 0.1), 2.1, T + 0.2, 4.2, 0.2);
  const key = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0x6a4a10, emissiveIntensity: 0.5, metalness: 0.75, roughness: 0.3 }));
  key.scale.set(0.5, 1.3, 1); key.position.set(-STREET.v, 4.6, u0 - 0.4); frame.add(key);
  const hallSign = label('ARTIFICERS’ HALL', { width: 5, height: 0.8 });
  hallSign.position.set(-STREET.v, 5.6, u0 - 0.34); hallSign.rotation.y = FACE['-u']; frame.add(hallSign);
  // Tiled floor: slate squares with brass seams.
  const tiles = document.createElement('canvas'); tiles.width = tiles.height = 128;
  const tg = tiles.getContext('2d'); tg.fillStyle = '#3a414d'; tg.fillRect(0, 0, 128, 128);
  tg.fillStyle = '#454d5b'; tg.fillRect(0, 0, 64, 64); tg.fillRect(64, 64, 64, 64);
  tg.strokeStyle = '#8d7346'; tg.lineWidth = 3; tg.strokeRect(0, 0, 128, 128); tg.beginPath(); tg.moveTo(64, 0); tg.lineTo(64, 128); tg.moveTo(0, 64); tg.lineTo(128, 64); tg.stroke();
  const tileTex = new THREE.CanvasTexture(tiles); tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set((v1 - v0) / 2.4, (u1 - u0) / 2.4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(v1 - v0 - T, u1 - u0 - T), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-vc, 0.05, uc); floor.receiveShadow = true; frame.add(floor);
  // Slate round-tile roof (Medieval Village kit, recoloured), standing on the ceiling.
  loadModel(encodeURI(`${VILLAGE}Roof_RoundTiles_8x12.gltf`), 1).then(({ object, size }) => {
    object.traverse(child => { if (child.isMesh) { child.material = child.material.clone(); child.material.map = null; child.material.color.set(0x3d4a5e); } });
    object.scale.set((v1 - v0 + 1.6) / size.x, 4, (u1 - u0 + 1.6) / size.z); object.position.set(-vc, H + 0.3, uc);
    frame.add(object);
  }).catch(error => console.warn('Artificers’ Hall roof unavailable.', error));
  // The forge: brick hearth, coals, a chimney through the roof.
  const brick = new THREE.MeshStandardMaterial({ color: 0x5a3a2e, roughness: 0.95, flatShading: true });
  box(brick, 96.2, 48.4, 0.7, 2.4, 1.4, 2.6); box(brick, 96.9, 48.4, H / 2 + 2, 1, H + 4, 1.2);
  box(new THREE.MeshBasicMaterial({ color: 0xff7a2e }), 95.6, 48.4, 1.42, 1.2, 0.05, 1.8);
  block(96.2, 48.4, 1.6);
  for (const [model, u, v, height, facing, radius] of HALL_PROPS) {
    kit(`${PROPS}${model}.gltf`, u, v, height, facing, model === 'Lantern_Wall' ? 3.4 : model === 'Peg_Rack' ? 1.4 : ['Scroll_1', 'Book_Stack_2'].includes(model) ? 0.9 : 0);
    block(u, v, radius);
  }
  // Hanging crystal lamps on brass rods, and the hall's one warm light.
  for (const u of [85.5, 90, 94.5]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), brass); rod.position.set(-vc, H - 0.7, u);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), crystal); lamp.scale.y = 1.6; lamp.position.set(-vc, H - 1.8, u);
    frame.add(rod, lamp);
  }
  const light = new THREE.PointLight(0xffd8a0, 1.3, 20, 1.6); light.position.set(-vc, H - 2.2, uc); frame.add(light);

  // --- The Connector Study Wall ---
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const studyTex = new THREE.CanvasTexture(canvas);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(STUDY.width, STUDY.height), new THREE.MeshBasicMaterial({ map: studyTex }));
  panel.position.set(-STUDY.v, 1.1 + STUDY.height / 2, STUDY.u - 0.02); panel.rotation.y = FACE['-u']; frame.add(panel);
  for (const [dv, dy, sw, sh] of [[0, STUDY.height / 2 + 0.12, STUDY.width + 0.4, 0.2], [0, -STUDY.height / 2 - 0.12, STUDY.width + 0.4, 0.2],
    [STUDY.width / 2 + 0.12, 0, 0.2, STUDY.height], [-STUDY.width / 2 - 0.12, 0, 0.2, STUDY.height]])
    box(brass, STUDY.u - 0.05, STUDY.v + dv, 1.1 + STUDY.height / 2 + dy, 0.1, sh, sw);
  let pageIndex = 0;
  const showPage = () => { drawStudy(canvas.getContext('2d'), canvas.width, canvas.height, studyPage(pageIndex), `${pageIndex % 6 + 1} / 6`); studyTex.needsUpdate = true; };
  showPage();

  let held = false, hinted = false;
  return {
    root, obstacles, colliders, row,
    isInsideHall: p => row.insideHall(p.x, p.z) && p.y < DIAMOND_BASE + H + 2,
    update(dt, player) {
      const near = row.nearStudy(player.position.x, player.position.z) && row.insideHall(player.position.x, player.position.z);
      if (near && !hinted) { hinted = true; notify?.('CONNECTOR STUDY · How the relay’s conduits fit together. Press E to turn the page.', 6000); }
      if (!near) hinted = false;
      const down = keys.has('KeyE'), tapped = down && !held; held = down;
      if (near && tapped) { pageIndex++; showPage(); }
    },
  };
}
