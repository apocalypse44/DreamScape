import { createCloverCampaign, CLOVER_STORY, ROOT_APPROACH, ARCHIVE_HALL, ARCHIVE_WALLS } from '../models/cloverCampaign.js';
import { CLOVER_PLATEAUS } from '../models/cloverTerrain.js';
import { ROOT_START, ROOT_LANDINGS, ROOT_OBSTACLES, ROOT_HEADINGS, ROOT_LIMITS, growRoots, rootConnects } from '../models/cloverGrowth.js';
import { fitText } from './canvasText.js';
import { cloverGroundTexture } from './cloverDressing.js';
import { guideYaw, visibleRoadSegments } from './cloverRoadLayout.js';
import { SKY, SKY_ARRIVAL, SKY_JUMPS, SUMMIT_DOOR } from '../models/skyIsland.js';
import { cliffBlock } from './cloverTerrain.js';
import { createWaterSurface } from './waterfall.js';
import { cloverShapes, banner } from './kingdomGates.js';
import { dressLivingRoad, shrineLayout, ARCH_SPAN } from './cloverArchiveProps.js';
import { createVineRoad } from './cloverVines.js';
import { loadModel } from './models.js';

export function buildCloverCampaign({ scene, world, keys, ready, notify, onSigil, onHook, onScene, onReady }) {
  const model = createCloverCampaign({ seed: world.seed, ready });
  const root = new THREE.Group(); root.name = 'Clover · The Living Road'; scene.add(root);
  const obstacles = new THREE.Group(); root.add(obstacles);
  const vineRoad = createVineRoad({ root, world });
  const colliders = [];
  // Flat, readable story surfaces: environment captures must not wash out guide
  // colors. Distance fog still connects the chapter to the surrounding climate.
  const mat = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const stone = mat(0x545c43), bark = mat(0x51351e), gold = mat(0xe1cb6b), ivory = mat(0xe9e2cc);
  const moss = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: cloverGroundTexture(world) });
  const ink = new THREE.MeshBasicMaterial({ color: 0x48d7ed, toneMapped: false });
  const dark = mat(0x263e2f), rootMaterial = mat(0x1f3d1c); // shadowed underlay beneath the braided vine deck
  const previewMaterial = new THREE.MeshBasicMaterial({ color: 0x8ddca8, transparent: true, opacity: .35, depthWrite: false });
  function grassUvs(geometry, x = 0, z = 0) {
    const pos = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + pos.getX(i)) / 12, (z + pos.getZ(i)) / 12);
  }
  function box(x, y, z, w, h, d, material = stone, blocks = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    if (material === moss) grassUvs(mesh.geometry, x, z);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    if (blocks) {
      const cameraWall = mesh.clone(); obstacles.add(cameraWall); root.remove(mesh);
      colliders.push({ x, z, radius: Math.min(w, d) / 2 + .15, minY: y - h / 2, maxY: y + h / 2 });
    }
    return mesh;
  }
  function plaque(title, subtitle, x, y, z, width = 5, yaw = 0, bothSides = true) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#173e2a'; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#8eab64'; ctx.lineWidth = 9; ctx.strokeRect(8, 8, 1008, 240);
    ctx.fillStyle = '#edf0c6'; ctx.textAlign = 'center'; ctx.font = 'bold 60px sans-serif'; fitText(ctx, title, 512, 95, 956);
    ctx.font = '35px sans-serif'; fitText(ctx, subtitle, 512, 183, 956);
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture }));
    face.position.set(x, y, z); face.rotation.y = yaw; root.add(face);
    if (!bothSides) return;
    const back = face.clone(); back.rotation.y += Math.PI;
    back.position.add(new THREE.Vector3(-Math.sin(yaw) * .03, 0, -Math.cos(yaw) * .03)); root.add(back);
  }
  function sign(title, subtitle, x, y, z, width, yaw = 0, floor = ROOT_START.top) {
    // Both readable faces sit in front of a slim backing, with posts behind the
    // lettering. All boards are beside the road and above the player's head.
    const nx = Math.sin(yaw), nz = Math.cos(yaw), halfHeight = width / 8;
    const backing = box(x, y, z, width + .12, width / 4 + .12, .12, bark);
    backing.rotation.y = yaw;
    for (const side of [-1, 1]) {
      const px = x + Math.cos(yaw) * side * width * .38;
      const pz = z - Math.sin(yaw) * side * width * .38;
      const height = y + halfHeight - floor;
      box(px, floor + height / 2, pz, .12, height, .12, bark, true);
    }
    plaque(title, subtitle, x + nx * .085, y, z + nz * .085, width, yaw, false);
    plaque(title, subtitle, x - nx * .085, y, z - nz * .085, width, yaw + Math.PI, false);
  }
  // The approach meets, rather than overlaps, the Archive and the third terrace.
  // Follow the terrace's authored polygon so its angled edge leaves no visible gap.
  const terrace = CLOVER_PLATEAUS[2], archive = ROOT_LANDINGS[0];
  const approachSouth = ROOT_APPROACH.z + ROOT_APPROACH.depth / 2;
  const approachNorth = ROOT_APPROACH.z - ROOT_APPROACH.depth / 2;
  const west = archive.x + archive.width / 2;
  const outline = terrace.outline.map(([x, z]) => [x + terrace.x, z + terrace.z]);
  const levels = [...new Set([approachNorth, approachSouth,
    ...outline.map(p => p[1]).filter(z => z > approachNorth && z < approachSouth)])].sort((a, b) => a - b);
  const terraceWestAt = z => {
    const crossings = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      if (a[1] === b[1]) { if (z === a[1]) crossings.push(a[0], b[0]); continue; }
      if (z >= Math.min(a[1], b[1]) && z <= Math.max(a[1], b[1]))
        crossings.push(a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]));
    }
    return Math.min(ROOT_APPROACH.x + ROOT_APPROACH.width / 2, ...crossings);
  };
  const approachShape = new THREE.Shape();
  approachShape.moveTo(west, -approachNorth);
  for (const z of levels) approachShape.lineTo(terraceWestAt(z), -z);
  approachShape.lineTo(west, -approachSouth); approachShape.closePath();
  function approachLayer(bottom, top, material) {
    const geometry = new THREE.ExtrudeGeometry(approachShape, { depth: top - bottom, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    if (material === moss) grassUvs(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.y = bottom;
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  }
  approachLayer(ROOT_APPROACH.bottom, ROOT_APPROACH.top - .12, stone);
  approachLayer(ROOT_APPROACH.top - .16, ROOT_APPROACH.top, moss);
  // Stone ends below the grass surface. Coincident top faces caused gray/green
  // depth fighting when moving; the cap still ends at the exact collision height.
  // Landings are terrace cliffs: the same roughened, tapered rock and drooping turf lip, so the
  // ravine reads as part of Clover Terraces. Walking tops still match the collision exactly.
  const cliffRock = new THREE.MeshStandardMaterial({ color: 0x4a4136, roughness: 1, flatShading: true }); // terrace rock
  for (const p of model.platforms.filter(p => p.name === 'root-landing')) {
    cliffBlock(root, world, p, cliffRock); cliffBlock(root, world, p, moss, true, 1);
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), cliffRock);
      rib.scale.set(2, 6, 3); rib.position.set(p.x + side * (p.width / 2 - 1), 5, p.z);
      rib.rotation.y = world.hash(p.x, side) * Math.PI; rib.castShadow = rib.receiveShadow = true; root.add(rib);
    }
  }
  // The ravine holds the terraces' lake water at the same level. It stops at the terrace lake's
  // west edge (x = -43) so the two planes never overlap; added to the scene, as the terraces do.
  const lakeMat = createWaterSurface('lake');
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(82, 80), lakeMat);
  lake.rotation.x = -Math.PI / 2; lake.position.set(-84, -4, -437); scene.add(lake);
  // A royal Clover library, enclosed like Spade's castle hall: ivory walls on the column lines with an
  // emerald wainscot and gold rail, clover stained-glass windows, a tiled floor, a ceiling and one warm
  // chandelier light. Bookcases, roof and furnishings are kit models (cloverArchiveProps.js).
  for (const x of [-42, -26]) for (const z of [-410, -431]) {
    box(x, 15, z, .7, 6, .7, ivory, true); box(x, 18, z, 1.2, .3, 1.2, gold); box(x, 12.15, z, 1.05, .3, 1.05, gold);
  }
  for (const z of [-410, -431]) { box(-34, 18.2, z, 17, .6, 1.2, ivory); box(-34, 17.87, z, 17, .08, 1.26, gold); }
  box(-42, 18.2, -420.5, 1, .5, 22, ivory); box(-26, 18.2, -420.5, 1, .5, 22, ivory);
  for (const x of [-42, -26]) box(x, 17.92, -420.5, 1.06, .08, 22, gold);
  // Walls are lit (not flat story colours) so the hall has depth; they double as camera obstacles.
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xefe6cf, roughness: .85 });
  const wainscot = new THREE.MeshStandardMaterial({ color: 0x2f7a4a, roughness: .7 });
  for (const w of ARCHIVE_WALLS) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.width, w.top - w.bottom, w.depth), wallMaterial);
    mesh.position.set(w.x, (w.top + w.bottom) / 2, w.z); mesh.castShadow = mesh.receiveShadow = true; obstacles.add(mesh);
    if (w.bottom > ARCHIVE_HALL.floor) continue; // lintels have no wainscot
    const alongX = w.width > w.depth, grow = (a, b) => alongX ? [w.width, b, w.depth + a] : [w.width + a, b, w.depth];
    const band = new THREE.Mesh(new THREE.BoxGeometry(...grow(.1, 1.2)), wainscot); band.position.set(w.x, 12.6, w.z); root.add(band);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(...grow(.14, .08)), gold); rail.position.set(w.x, 13.24, w.z); root.add(rail);
  }
  // Glowing panes with a green four-leaf clover on each face: stained glass in the long walls.
  const paneMaterial = mat(0xfff1c2), glassClover = new THREE.ShapeGeometry(cloverShapes(.9));
  const cloverGlass = new THREE.MeshBasicMaterial({ color: 0x3fae5e, toneMapped: false, side: THREE.DoubleSide });
  for (const z of [-410, -431]) for (const x of [-38, -34, -30]) {
    box(x, 16.1, z, 1.5, 2.6, .66, paneMaterial); box(x, 16.1, z, 1.7, 2.8, .62, gold);
    for (const side of [-1, 1]) {
      const glyph = new THREE.Mesh(glassClover, cloverGlass); glyph.position.set(x, 16.2, z + side * .34); root.add(glyph);
    }
  }
  // Tiled floor (cream and pale green, gold joints) just above the landing grass, below the guide marks.
  const tiles = document.createElement('canvas'); tiles.width = tiles.height = 256;
  const tg = tiles.getContext('2d');
  for (let i = 0; i < 4; i++) { tg.fillStyle = i % 3 ? '#efe7d2' : '#d3e6c3'; tg.fillRect((i % 2) * 128, (i >> 1) * 128, 128, 128); }
  tg.strokeStyle = '#c9a94e'; tg.lineWidth = 6; tg.strokeRect(0, 0, 256, 256);
  tg.beginPath(); tg.moveTo(128, 0); tg.lineTo(128, 256); tg.moveTo(0, 128); tg.lineTo(256, 128); tg.stroke();
  const tileTexture = new THREE.CanvasTexture(tiles); tileTexture.encoding = THREE.sRGBEncoding;
  tileTexture.wrapS = tileTexture.wrapT = THREE.RepeatWrapping; tileTexture.repeat.set(16 / 3.2, 21 / 3.2);
  const floorMaterial = new THREE.MeshStandardMaterial({ map: tileTexture, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 21), floorMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.set(-34, ARCHIVE_HALL.floor + .01, -420.5); floor.receiveShadow = true; root.add(floor);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(16.6, .12, 21.6), wallMaterial);
  ceiling.position.set(-34, ARCHIVE_HALL.top + .06, -420.5); obstacles.add(ceiling);
  // One warm light at the chandelier, no shadow map; the hall reads bright at any hour.
  const hallLight = new THREE.PointLight(0xffe0a6, 1.3, 24, 1.6); hallLight.position.set(-34, 16.4, -420.5); root.add(hallLight);
  // Bookcases against the south wall face into the hall; Iven's reading stand beside them.
  for (const x of [-40.8, -39.3, -37.8]) colliders.push({ x, z: -410.6, radius: .55, minY: 12, maxY: 14.6 });
  colliders.push({ x: -37.6, z: -412.6, radius: .35, minY: 12, maxY: 13.5 });
  const dummy = new THREE.Object3D();
  // Clover banners hang from the east beam beside the name board, clear of the east door.
  for (const z of [-413, -419.5]) {
    const cloth = banner('#2f8f4e'); cloth.position.set(-25.45, 17.9, z); cloth.rotation.y = Math.PI / 2; root.add(cloth);
  }
  // Gold four-leaf emblems on both roof gables, facing out: north (-z) over the ravine, south toward the terraces.
  const emblemGeometry = new THREE.ExtrudeGeometry(cloverShapes(1.4), { depth: .12, bevelEnabled: false });
  for (const [z, yaw] of [[-432.35, Math.PI], [-408.65, 0]]) {
    const emblem = new THREE.Group(); emblem.position.set(-34, 20.2, z); emblem.rotation.y = yaw;
    emblem.add(new THREE.Mesh(emblemGeometry, gold), new THREE.Mesh(new THREE.TorusGeometry(.95, .07, 6, 32), gold));
    root.add(emblem);
  }
  // Mount the header below and in front of the east beam, facing the approach.
  const headerBacking = box(-25.46, 17, -424.5, 6.12, 1.62, .12, bark);
  headerBacking.rotation.y = Math.PI / 2;
  for (const z of [-426.5, -422.5]) {
    box(-25.7, 17.98, z, .7, .12, .12, bark);
    box(-25.35, 17.88, z, .08, .28, .08, gold);
  }
  plaque('ROOTKEEPER ARCHIVE', 'Iven preserves what the Triad tried to erase', -25.35, 17, -424.5, 6, Math.PI / 2, false);
  sign('← ROOTKEEPER ARCHIVE', 'Iven waits across the grass walkway', -7, 14.8, -433.5, 3.2);
  sign('IVEN', 'Listen in calm · E to speak', -41, 14.6, -411.8, 2.1);
  sign('THE LIVING ROAD', 'Calm: turn · Chaos: grow · Wait, then cross', -39, 14.6, -429, 3.2);
  // The blocking stones are identical to the circles used by the turtle sweep.
  // Inside the Archive the stones are round ivory planters with a gold rim (flowers are kit models),
  // so the root still "meets stone" without boulders in a library. Stones beyond a landing's edge
  // are sealed on the landing itself by briar thickets (below).
  const STONE_TOP = ROOT_START.top + 1.5;
  for (const p of ROOT_OBSTACLES) {
    const landing = ROOT_LANDINGS[p.junction];
    const onLanding = Math.abs(p.x - landing.x) < landing.width / 2 && Math.abs(p.z - landing.z) < landing.depth / 2;
    if (onLanding) {
      const planter = new THREE.Mesh(new THREE.CylinderGeometry(p.radius, p.radius * .92, .6, 24), wallMaterial);
      planter.position.set(p.x, ROOT_START.top + .3, p.z); planter.castShadow = planter.receiveShadow = true; obstacles.add(planter);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(p.radius, .07, 6, 32), gold);
      rim.rotation.x = Math.PI / 2; rim.position.set(p.x, ROOT_START.top + .6, p.z); root.add(rim);
      const soil = new THREE.Mesh(new THREE.CircleGeometry(p.radius - .08, 24), moss);
      soil.rotation.x = -Math.PI / 2; soil.position.set(p.x, ROOT_START.top + .61, p.z); root.add(soil);
    }
    colliders.push({ x: p.x, z: p.z, radius: p.radius, minY: ROOT_START.top, maxY: STONE_TOP });
  }
  // Clover growth shrines on the outer landings (layout shared with the movement tests): briar
  // thickets seal the wrong exits, ivory pillars with gold caps, emerald orbs and spinning gold
  // clovers stand on the diagonals, and an ivory-and-gold arch with a clover keystone frames every
  // road. Junction landings also get an ivory four-leaf inlay under the guide, inside its gold leaf.
  const shrines = shrineLayout();
  for (const t of shrines.thickets) vineRoad.thicket(t, t.ax, t.az);
  colliders.push(...shrines.colliders);
  const orbMaterial = mat(0x7dffa8), spinners = [];
  const shaftGeometry = new THREE.CylinderGeometry(.3, .36, 1, 12), capGeometry = new THREE.CylinderGeometry(.48, .38, .3, 12);
  const orbGeometry = new THREE.IcosahedronGeometry(.3, 1), smallClover = new THREE.ExtrudeGeometry(cloverShapes(.8), { depth: .06, bevelEnabled: false }).center();
  function shrinePillar(x, z, floor, height, crowned) {
    box(x, floor + .12, z, .95, .24, .95, gold);
    const shaft = new THREE.Mesh(shaftGeometry, wallMaterial); shaft.scale.y = height; shaft.position.set(x, floor + height / 2, z);
    shaft.castShadow = true; obstacles.add(shaft);
    const cap = new THREE.Mesh(capGeometry, gold); cap.position.set(x, floor + height + .15, z); root.add(cap);
    if (!crowned) return;
    const orb = new THREE.Mesh(orbGeometry, orbMaterial); orb.position.set(x, floor + height + .62, z); root.add(orb);
    const emblem = new THREE.Mesh(smallClover, gold); emblem.position.set(x, floor + height + 1.25, z); root.add(emblem); spinners.push(emblem);
  }
  for (const p of shrines.pillars) shrinePillar(p.x, p.z, p.floor, 3.2, true);
  for (const p of shrines.archPillars) shrinePillar(p.x, p.z, p.floor, 4.2, false);
  const archGeometry = new THREE.TorusGeometry(ARCH_SPAN, .16, 8, 28, Math.PI), keystone = new THREE.ExtrudeGeometry(cloverShapes(1.2), { depth: .1, bevelEnabled: false }).center();
  for (const a of shrines.arches) {
    const yaw = Math.atan2(-a.dx, -a.dz); // turns the torus's local x onto (-dz, dx): across the road, between its pillars
    const ring = new THREE.Mesh(archGeometry, gold); ring.position.set(a.x, a.floor + 4.35, a.z); ring.rotation.y = yaw; root.add(ring);
    const key = new THREE.Mesh(keystone, gold); key.position.set(a.x, a.floor + 4.35 + ARCH_SPAN, a.z); key.rotation.y = yaw; root.add(key);
  }
  const daisGold = gold.clone(), daisIvory = mat(0xf3ecd8);
  for (const [material, offset] of [[daisGold, -2], [daisIvory, -3]]) {
    material.polygonOffset = true; material.polygonOffsetFactor = material.polygonOffsetUnits = offset;
  }
  for (const landing of ROOT_LANDINGS.slice(1, 3)) for (const [scale, material] of [[3.2, daisGold], [2.9, daisIvory]]) {
    const geometry = new THREE.ShapeGeometry(cloverShapes(scale)); geometry.rotateX(-Math.PI / 2);
    const dais = new THREE.Mesh(geometry, material); dais.position.set(landing.x, landing.top + .02, landing.z); root.add(dais);
  }
  // Model symbols in the XZ plane with an unmistakable north-facing tip. Rotate
  // their parent around Y, rather than mixing Euler axes on a cone.
  function symbol(points, material, outlined = true) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    const group = new THREE.Group();
    if (outlined) {
      const border = new THREE.Mesh(geometry, dark); border.scale.set(1.18, 1, 1.18); group.add(border);
    }
    const face = new THREE.Mesh(geometry, material); face.position.y = .06; group.add(face);
    return group;
  }
  const leafPoints = [[0,-1.15],[.5,-.3],[.4,.25],[.1,.5],[.1,.95],[-.1,.95],[-.1,.5],[-.4,.25],[-.5,-.3]];
  const arrowPoints = [[0,-1.05],[.48,-.35],[.15,-.35],[.15,.65],[-.15,.65],[-.15,-.35],[-.48,-.35]];
  const guideSigns = [[-39,-424.5,Math.PI/2],[-71.5,-423,Math.PI/2],[-64.2,-458,0]];
  // Gold leaves are fixed targets. Cyan arrows on the dials are player choices.
  const dials = ROOT_LANDINGS.slice(0, 3).map((p, i) => {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.65, .85, .55, 16), wallMaterial);
    pedestal.position.set(p.x, p.top + .275, p.z); obstacles.add(pedestal);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.67, .05, 6, 24), gold);
    band.rotation.x = Math.PI / 2; band.position.set(p.x, p.top + .55, p.z); root.add(band);
    colliders.push({ x: p.x, z: p.z, radius: .7, minY: p.top, maxY: p.top + .55 });
    const dial = new THREE.Group(); dial.position.set(p.x, p.top + 1.1, p.z); root.add(dial);
    const arrow = symbol(arrowPoints, ink); arrow.scale.setScalar(.65); dial.add(arrow);
    const mark = symbol(leafPoints, gold);
    mark.rotation.y = guideYaw(ROOT_HEADINGS[i]);
    const vein = new THREE.Mesh(new THREE.BoxGeometry(.045, .035, 1.25), dark);
    vein.position.set(0, .135, -.12); mark.add(vein);
    const a = ROOT_HEADINGS[i] * Math.PI / 2;
    mark.position.set(p.x + Math.sin(a) * 3.1, p.top + .04, p.z - Math.cos(a) * 3.1); root.add(mark);
    const [sx, sz, yaw] = guideSigns[i];
    sign(`GROWTH GUIDE ${i + 1}`, `Gold leaf: ${['NORTH', 'EAST', 'SOUTH', 'WEST'][ROOT_HEADINGS[i]]} · Cyan arrow: your choice`, sx, 14.6, sz, 2.8, yaw);
    return dial;
  });
  const scar = CLOVER_STORY.scar;
  // The Scar is a sealed clover dais: a gold four-leaf inlay in a gold ring, drawn just above the
  // grass (stronger depth offset than the landing cap), and the Root Sigil as an emerald clover.
  const inlay = gold.clone(); inlay.polygonOffset = true; inlay.polygonOffsetFactor = inlay.polygonOffsetUnits = -4;
  const inlayGeometry = new THREE.ShapeGeometry(cloverShapes(9)); inlayGeometry.rotateX(-Math.PI / 2);
  const ringGeometry = new THREE.RingGeometry(6.1, 6.5, 64); ringGeometry.rotateX(-Math.PI / 2);
  for (const geometry of [inlayGeometry, ringGeometry]) {
    const mesh = new THREE.Mesh(geometry, inlay); mesh.position.set(scar.x, scar.top + .02, scar.z); root.add(mesh);
  }
  const sigilGeometry = new THREE.ExtrudeGeometry(cloverShapes(1.3), { depth: .2, bevelEnabled: false }).center();
  const sigil = new THREE.Mesh(sigilGeometry, mat(0x63d483));
  sigil.position.set(scar.x, 14, scar.z); root.add(sigil);
  sign('STORMLEAF SCAR', 'The original pattern survives · Read in calm', scar.x, 14.8, scar.z - 7, 4.5);
  // The Scar's memory for its cutscene: the whole L-system road, shrunk onto the ground, traced in
  // light, while three red decoy marks (Veyr's false bindings) flicker out.
  const pattern = growRoots({ seed: world.seed }).segments;
  const xs = pattern.flatMap(s => [s.from.x, s.to.x]), zs = pattern.flatMap(s => [s.from.z, s.to.z]);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2, midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const traceGeometry = new THREE.BufferGeometry().setFromPoints(pattern.flatMap(s => [s.from, s.to])
    .map(p => new THREE.Vector3(scar.x + (p.x - midX) * .12, 12.3, scar.z + (p.z - midZ) * .12)));
  const trace = new THREE.LineSegments(traceGeometry, new THREE.LineBasicMaterial({ color: 0xc8ff9a, toneMapped: false }));
  trace.visible = false; root.add(trace);
  const decoyMaterial = new THREE.LineBasicMaterial({ color: 0xff4a3a, transparent: true, toneMapped: false });
  const decoys = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[-3, 2], [3, 1.5], [0, -3]]
    .flatMap(([x, z]) => [[-.6, -.6, .6, .6], [-.6, .6, .6, -.6]].flatMap(([a, b, c, d]) =>
      [new THREE.Vector3(scar.x + x + a, 12.32, scar.z + z + b), new THREE.Vector3(scar.x + x + c, 12.32, scar.z + z + d)]))), decoyMaterial);
  decoys.visible = false; root.add(decoys);
  // --- Flashback staging ("The Severing"): the whole road as it was, Veyr's chains crawling from the
  // Scar along it, the vines withering, crossings snapping (last first) into falling root debris, his
  // decoy marks, and Iven's green seal. memoryStage(stage) each frame; memoryStage(null) restores now.
  const fullRoad = growRoots({ seed: world.seed }), branches = fullRoad.segments.filter(s => !s.road);
  const chainLinks = new THREE.InstancedMesh(new THREE.TorusGeometry(.17, .045, 4, 8), mat(0x9b6bff), 260);
  chainLinks.count = 0; chainLinks.frustumCulled = false; root.add(chainLinks);
  const chainPath = [...ROOT_LANDINGS].reverse().map(p => new THREE.Vector3(p.x, p.top + .38, p.z));
  const chainLength = chainPath.slice(1).reduce((sum, p, i) => sum + p.distanceTo(chainPath[i]), 0);
  const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x3b3029, roughness: .9 });
  const debris = Array.from({ length: 18 }, () => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.24, .3, 1.7, 6), debrisMaterial);
    mesh.visible = false; mesh.castShadow = true; root.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3() };
  });
  const sealBeam = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x7dff9a,
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sealBeam.visible = false; root.add(sealBeam);
  let memoryOn = false, roadShown = -1;
  function snap(i) { // throw this crossing's span into the ravine as falling root pieces
    const segment = visibleRoadSegments(fullRoad.backbone[i])[0];
    if (!segment) return;
    debris.slice(i * 6, i * 6 + 6).forEach((d, k) => {
      const t = (k + .5) / 6;
      d.mesh.position.set(segment.from.x + (segment.to.x - segment.from.x) * t, 11.7, segment.from.z + (segment.to.z - segment.from.z) * t);
      d.mesh.rotation.set(Math.PI / 2, world.hash(i, k) * 3, 0); d.mesh.visible = true;
      d.velocity.set((world.hash(k, i) - .5) * 3, 1.5 + world.hash(k + 9, i) * 2, (world.hash(i + 9, k) - .5) * 3);
      d.spin.set((world.hash(k, 4) - .5) * 4, (world.hash(4, k) - .5) * 4, (world.hash(k, 7) - .5) * 4);
    });
  }
  function memoryStage(stage) {
    if (!stage) {
      if (!memoryOn) return;
      memoryOn = false; roadShown = -1; seen = -1; // the next refresh redraws the present road
      vineRoad.memory({}); chainLinks.count = 0; sealBeam.visible = false; trace.visible = decoys.visible = false;
      for (const d of debris) d.mesh.visible = false;
      return;
    }
    memoryOn = true;
    vineRoad.memory({ blacken: stage.blacken, hedges: false });
    const intact = fullRoad.backbone.filter((s, i) => i < 3 - stage.broken);
    if (roadShown !== stage.broken) {
      if (stage.broken > Math.max(0, roadShown)) for (let i = 3 - Math.max(0, roadShown) - 1; i >= 3 - stage.broken; i--) snap(i);
      roadShown = stage.broken;
      drawSegments(roots, intact); vineRoad.draw(intact, branches); preview.count = 0;
    }
    // Chains: links along the road from the Scar toward the Archive, as far as the binding has crawled.
    const reach = stage.chains * chainLength, step = .42;
    let count = 0, walked = 0;
    for (let i = 1; i < chainPath.length && walked < reach; i++) {
      const a = chainPath[i - 1], b = chainPath[i], length = a.distanceTo(b);
      for (let d = 0; d < length && walked + d < reach && count < chainLinks.instanceMatrix.count; d += step) {
        dummy.position.lerpVectors(a, b, d / length); dummy.position.y += Math.sin((walked + d) * 1.3 + time * 3) * .05;
        dummy.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z), count % 2 ? Math.PI / 2 : 0); dummy.scale.setScalar(1);
        dummy.updateMatrix(); chainLinks.setMatrixAt(count++, dummy.matrix);
      }
      walked += length;
    }
    chainLinks.count = count; chainLinks.instanceMatrix.needsUpdate = true;
    decoys.visible = stage.decoys > 0; decoyMaterial.opacity = Math.min(1, stage.decoys);
    trace.visible = stage.seal > 0; traceGeometry.setDrawRange(0, 2 * Math.ceil(pattern.length * Math.min(1, stage.seal)));
    sealBeam.visible = Boolean(stage.beam && stage.beamFrom);
    if (sealBeam.visible) {
      const from = stage.beamFrom, to = new THREE.Vector3(scar.x, scar.top + .4, scar.z), length = from.distanceTo(to);
      sealBeam.position.lerpVectors(from, to, .5); sealBeam.scale.set(1, length, 1);
      sealBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      sealBeam.material.opacity = Math.min(1, stage.beam) * .85;
    }
  }
  // The reward finishes the terrace climb, gateway journey and Starlight jumps.
  const chestAt = CLOVER_STORY.chest;
  colliders.push({ x: chestAt.x, z: chestAt.z, radius: .65, minY: chestAt.top, maxY: chestAt.top + 1 });
  // The Spade castle's KayKit chest (assets/spade/chest.glb). It faces +z, toward the ledge route
  // arriving from the south; its lid is a separate node hinged at the rear edge, so it opens backward.
  let lid = null;
  loadModel('assets/spade/chest.glb', 1.15).then(({ object }) => {
    object.position.set(chestAt.x, chestAt.top, chestAt.z); root.add(object);
    lid = object.getObjectByName('chest_lid'); onReady?.(root);
  }).catch(error => console.warn('Clover chest model unavailable.', error));
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.25, .055, 6, 16, Math.PI * 1.6), ink);
  hook.position.set(chestAt.x, chestAt.top + 1.6, chestAt.z); hook.visible = false; root.add(hook);
  sign('IVEN’S SKY CHEST', 'The Root Sigil opens the way to Heart', chestAt.x, chestAt.top + 2.6, chestAt.z - 1.4, 2.8, 0, chestAt.top);
  function routeBoard(title, subtitle, x, z, floor, target, width = 3.6) {
    sign(title, subtitle, x, floor + 2.6, z, width, 0, floor);
    const arrow = symbol(arrowPoints, gold);
    arrow.position.set(x, floor + .04, z - 1.8);
    arrow.rotation.y = Math.atan2(-(target.x - x), -(target.z - (z - 1.8)));
    root.add(arrow);
  }
  routeBoard('CHEST VIA SKY GARDEN', 'Gateway south along the summit path · Press E', 6, -530, 24, SUMMIT_DOOR);
  routeBoard('TELEPORT TO THE CHEST', 'Press E at gateway · Then climb Starlight Ledges', 8, SUMMIT_DOOR.z - 5, SUMMIT_DOOR.top, SUMMIT_DOOR);
  routeBoard('CHEST: STARLIGHT LEDGES', 'Follow the signs · Jump to the highest perch', SKY.x + 6, SKY_ARRIVAL.z - 2, SKY.top, SKY_JUMPS[0]);

  const roots = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rootMaterial, ROOT_LIMITS.segments);
  const preview = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), previewMaterial, ROOT_LIMITS.segments);
  roots.count = preview.count = 0; roots.frustumCulled = preview.frustumCulled = false;
  roots.castShadow = roots.receiveShadow = true; root.add(roots, preview);
  // Drifting gold motes over the Archive and the ravine: Clover's brightness, no extra lights.
  const MOTES = 90, motePositions = new Float32Array(MOTES * 3), moteBase = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    moteBase[i] = 12.6 + world.hash(i, 903) * 4.5;
    motePositions.set([-108 + world.hash(i, 901) * 84, moteBase[i], -462 + world.hash(i, 902) * 56], i * 3);
  }
  const moteGeometry = new THREE.BufferGeometry(); moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({ color: 0xffe9a0, size: .22, transparent: true, opacity: .8,
    depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false; root.add(motes);
  const along = new THREE.Vector3(), center = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  function drawSegments(mesh, segments, progress = 1, capacity = ROOT_LIMITS.segments) {
    const visible = segments.flatMap(s => s.road ? visibleRoadSegments(s, progress) : [{ ...s,
      to: { x: s.from.x + (s.to.x - s.from.x) * progress, y: s.from.y + (s.to.y - s.from.y) * progress, z: s.from.z + (s.to.z - s.from.z) * progress } }]);
    mesh.count = Math.min(capacity, visible.length);
    visible.slice(0, mesh.count).forEach((s, i) => {
      const p = 1, dx = s.to.x - s.from.x, dy = s.to.y - s.from.y, dz = s.to.z - s.from.z;
      const length = Math.hypot(dx, dy, dz);
      center.set(s.from.x + dx * p / 2, s.from.y + dy * p / 2, s.from.z + dz * p / 2);
      along.set(dx, dy, dz).normalize(); dummy.position.copy(center); dummy.quaternion.setFromUnitVectors(up, along);
      dummy.scale.set(s.road ? 3.4 : .2, s.road ? .3 : .2, Math.max(.001, length * p)); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  const prompt = document.createElement('aside'); prompt.className = 'clover-action'; prompt.hidden = true; prompt.setAttribute('role', 'status'); document.body.append(prompt);
  const debug = document.createElement('aside'); debug.className = 'clover-growth-study'; debug.hidden = true; document.body.append(debug);
  let debugOn = new URLSearchParams(location.search).get('growth') === '1';
  let pressed = false, studyPressed = false, seen = -1, time = 0, open = 0, inspecting = false;
  let revealed = Infinity; // seconds since the chest opened; the Tide Hook only shows as it rises out
  function event(result) {
    if (!result) return;
    notify?.(result.text); // the shared dialogue box; a cutscene hides it, and it reads as a recap afterwards
    if (result.kind === 'sigil') onSigil?.();
    if (result.kind === 'hook') onHook?.();
    onScene?.(result.kind);
  }
  const signature = s => `${s.from.x},${s.from.y},${s.from.z}:${s.to.x},${s.to.y},${s.to.z}`;
  function refresh(player, state) {
    const committed = model.growth;
    drawSegments(roots, committed.segments.filter(s => s.road));
    const snapshot = model.pending || model.trial ||
      (model.stage === 'road' && model.interaction(player.position)?.kind === 'guide' && state.mode === 'calm'
        ? growRoots({ rounds: model.generation + 1, guides: model.guides, seed: world.seed }) : null);
    if (snapshot) {
      const existing = new Set(committed.segments.map(signature));
      drawSegments(preview, snapshot.segments.filter(s => !existing.has(signature(s))), model.pending ? model.progress : 1, ROOT_LIMITS.segments - roots.count);
      previewMaterial.color.set(!rootConnects(snapshot.backbone[model.generation], ROOT_LANDINGS[model.generation + 1]) ? 0xf18c67 : 0x8ddca8);
    } else preview.count = 0;
    const visibleRoads = [...committed.backbone];
    if (model.pending) {
      const next = model.pending.backbone[model.generation], p = model.progress;
      visibleRoads.push({ from: next.from, to: { x: next.from.x + (next.to.x - next.from.x) * p, y: next.to.y, z: next.from.z + (next.to.z - next.from.z) * p } });
    }
    vineRoad.draw(visibleRoads, committed.segments.filter(s => !s.road));
    dials.forEach((dial, i) => { dial.rotation.y = guideYaw(model.guides[i]); dial.visible = i >= model.generation; });
    if (debugOn) debug.textContent = `GROWTH STUDY · L-SYSTEM\nSeed ${world.seed} · Round ${model.generation}/3\nTurtle segments ${committed.segments.length} · Root bodies + previews ${roots.count + preview.count}/128 · Vine parts ${vineRoad.count}\nX → F[+B][-B]X\nB → d[+B][-B]\nF = walkable road; d = decorative branch\n[ ] save/restore turtle; + / − turn\n${(snapshot || committed).word}\nL · hide study · Completed road symbols never move.`;
    seen = model.version;
  }
  dressLivingRoad({ root, world, onReady });
  onReady?.(root);
  return {
    model, root, obstacles, colliders, platforms: model.platforms,
    atInteraction: position => Boolean(model.interaction(position)),
    // Cutscene effects, k from 0 to 1; Infinity ends the effect.
    memoryStage,
    scarReveal(k) {
      trace.visible = decoys.visible = k < Infinity;
      traceGeometry.setDrawRange(0, 2 * Math.ceil(pattern.length * Math.min(1, k)));
      decoyMaterial.opacity = k < .7 ? 1 : Math.max(0, 1 - (k - .7) / .3) * (.6 + .4 * Math.sin(time * 40));
    },
    hookRise(k) {
      hook.visible = k < Infinity;
      hook.position.y = CLOVER_STORY.chest.top + .9 + Math.min(1, k) * 1.3;
    },
    update(dt, player, state, active = true) {
      time += dt;
      lakeMat.uniforms.uTime.value += dt;
      const down = keys.has('KeyE'), tapped = down && !pressed; pressed = down;
      const studyDown = keys.has('KeyL'), studyTap = studyDown && !studyPressed; studyPressed = studyDown;
      const close = Math.hypot(player.position.x + 65, player.position.z + 435) < 115;
      // Keep the landmark visible from the kingdom entrance, as with the Sky
      // Garden. Proximity only gates detailed updates/UI, never the scenery.
      if (active && state.locked && !state.mapOpen && !state.cinematic) {
        if (studyTap && close) debugOn = !debugOn;
        if (tapped) event(model.interact(player.position, state.mode));
        event(model.update(dt, player));
      }
      prompt.hidden = !active || !state.locked || state.mapOpen || state.cinematic;
      const hint = model.hint(player.position, state.mode);
      prompt.hidden ||= !hint;
      if (hint && prompt.textContent !== hint) prompt.textContent = hint;
      debug.hidden = !debugOn || !close || !state.locked || state.cinematic || state.mapOpen;
      // Only the currently growing roots animate their matrices. Otherwise update on
      // state changes or while inspecting a guide; no allocations on distant frames.
      const atGuide = model.interaction(player.position)?.kind === 'guide';
      if (memoryOn) for (const d of debris) if (d.mesh.visible) { // falling root pieces during the flashback
        d.velocity.y -= 18 * dt; d.mesh.position.addScaledVector(d.velocity, dt);
        d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt; d.mesh.rotation.z += d.spin.z * dt;
        if (d.mesh.position.y < -6) d.mesh.visible = false;
      }
      if (!memoryOn && close && (seen !== model.version || model.pending || atGuide || inspecting !== atGuide || debugOn)) refresh(player, state);
      inspecting = atGuide;
      if (close) {
        for (const emblem of spinners) emblem.rotation.y += dt * .8;
        for (let i = 0; i < MOTES; i++) motePositions[i * 3 + 1] = moteBase[i] + Math.sin(time * .7 + i * 1.3) * .35;
        moteGeometry.attributes.position.needsUpdate = true;
      }
      open += ((model.hook ? 1 : 0) - open) * (1 - Math.exp(-5 * dt)); if (lid) lid.rotation.x = -open * 1.9;
      // Hidden until the chest opens, then it rises from the open chest for 3 s (the cutscene shows the
      // same rise through hookRise; skipping the cutscene still shows the rest of it).
      if (model.hook && revealed === Infinity) revealed = 0;
      if (!model.hook) revealed = Infinity; else revealed += dt;
      if (!state.cinematic) { hook.visible = revealed < 3; hook.position.y = CLOVER_STORY.chest.top + .9 + Math.min(1, revealed / 2) * 1.3; }
      hook.rotation.y += dt;
      sigil.rotation.y += dt * .4; sigil.visible = !model.sigil;
    },
    recovery: player => model.recovery(player),
    reset() { model.reset(); trace.visible = decoys.visible = hook.visible = false; revealed = Infinity; pressed = studyPressed = inspecting = false; seen = -1; open = 0; prompt.hidden = debug.hidden = true; roots.count = preview.count = 0; vineRoad.clear(); },
  };
}
