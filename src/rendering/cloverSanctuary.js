// The Clover sanctum on the High Valley summit (layout: models/cloverSanctum.js, CLOVER_SANCTUM_PLAN.md).
// Built for load time: every kit model here is one the game already downloads (the fern is the one new, 13 KB),
// the plaza, gate frame, lanterns, crystals, runes and petals are procedural, and repeated models are drawn as
// InstancedMesh (one draw call per mesh of each model). One light: the gate lanterns.
import { loadModel } from './models.js';
import { gateFrame, stoneMaterial } from './stonework.js';
import { SANCTUM_FLOOR as FLOOR, PATH, PLAZA, GATE, STONES, CRYSTALS, TREES, LANTERNS, LOOKOUT, sanctumDressing, sanctumColliders } from '../models/cloverSanctum.js';

const KIT = 'assets/Stylized Nature MegaKit[Standard]/glTF/';
const SHOW_WITHIN = 240; // metres: the whole sanctum is hidden beyond this (InstancedMesh in r128 cannot frustum-cull)
const RUNES = ['ᛉ', 'ᛟ', 'ᛜ', 'ᚷ']; // wind, flame, tide, earth: the grimoire's four mana runes
// Flat decals on the summit must win the depth test against its grass cap, which cliffBlock pulls toward the camera
// by its layer (15 of 31 caps). Only flat things get this, and only just more than the cap: any extra draws the decal
// over the soles of whoever stands on it (boots sank into the path at -24).
const ABOVE_CAP = { polygonOffset: true, polygonOffsetFactor: -17, polygonOffsetUnits: -17 };
// Looking straight down the offset's slope term vanishes, so height decides: the cap's top is lifted layer x 1 mm
// (24.015 here), and decals must sit physically above it.
const DECAL_Y = FLOOR + .027;

export function createCloverSanctuary({ root, world, onReady }) {
  const group = new THREE.Group(); group.name = 'Clover sanctum'; root.add(group);
  const colliders = sanctumColliders();
  const stone = new THREE.MeshStandardMaterial({ color: 0x5d6a5a, roughness: .95, flatShading: true }); // the Clover gate's stone
  const moss = new THREE.MeshStandardMaterial({ color: 0x2f6b3c, roughness: .8, emissive: 0x0f3a18, emissiveIntensity: .5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: .6, roughness: .35, emissive: 0x3a2a08 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x8fe36b, emissive: 0x4bd23a, emissiveIntensity: 1.2, roughness: .4 });
  const add = (mesh, x, y, z, shadow = true) => { mesh.position.set(x, y, z); mesh.castShadow = shadow; mesh.receiveShadow = true; group.add(mesh); return mesh; };

  // Kit models, instanced: placements { model, x, z, height, yaw, flat?, stretch?, lean?, tint? }.
  const placements = [
    ...sanctumDressing(world.hash),
    ...TREES.map(([x, z, model, height]) => ({ model, x, z, height, yaw: world.hash(x, z) * Math.PI * 2, shadow: true })),
    // Standing stones: kit rocks stood upright and darkened with moss, leaning a little.
    ...STONES.map(([x, z, height, lean], i) => ({ model: i % 2 ? 'Rock_Medium_1' : 'Rock_Medium_2', x, z, height, lean,
      yaw: world.hash(i, 990) * Math.PI * 2, stretch: [.55, 1, .45], tint: 0x8a9a7c, shadow: true })),
  ];
  const matrix = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const model of new Set(placements.map(p => p.model))) {
    loadModel(encodeURI(`${KIT}${model}.gltf`), 1).then(({ object }) => {
      const list = placements.filter(p => p.model === model);
      object.updateMatrixWorld(true);
      object.traverse(mesh => {
        if (!mesh.isMesh) return;
        const instanced = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
        list.forEach((p, i) => {
          // The model is 1 m tall: scale by height.
          const s = p.height;
          const [sx, sy, sz] = p.stretch ? p.stretch.map(k => k * s) : [s, s, s];
          e.set(p.lean || 0, p.yaw, 0); q.setFromEuler(e);
          // Standing stones are sunk a fifth of their height so a lean never lifts an edge.
          place.compose(new THREE.Vector3(p.x, FLOOR + (p.stretch ? -.2 * p.height : -.015), p.z), q, new THREE.Vector3(sx, sy, sz));
          instanced.setMatrixAt(i, matrix.multiplyMatrices(place, mesh.matrixWorld));
          if (p.tint) instanced.setColorAt(i, new THREE.Color(p.tint));
        });
        if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
        instanced.castShadow = list.some(p => p.shadow); instanced.receiveShadow = true;
        instanced.frustumCulled = false; // spread over the summit; the group is hidden by distance instead
        group.add(instanced);
      });
      onReady?.(group);
    }).catch(error => console.warn(`Sanctum ${model} unavailable.`, error));
  }

  // The clover-leaf plaza: one disc whose texture paints four paved leaves, a rune ring and a clover heart.
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.radius, 48), plazaMaterial(world));
  plaza.rotation.x = -Math.PI / 2; add(plaza, PLAZA.x, DECAL_Y, PLAZA.z, false);

  // The stepping-stone path: a flat ribbon along PATH, painted with irregular flags (a decal, like the plaza).
  add(pathRibbon(world), 0, 0, 0, false);

  // The gateway's carved frame (stonework.js, shared with the Sky Garden's return portal so both ends match).
  // The portal surface itself is drawn by skyIsland.js. Colliders for its pillars come from sanctumColliders().
  const { keystone } = gateFrame(group, { x: GATE.x, z: GATE.z, floor: FLOOR, half: GATE.half, rise: GATE.rise,
    stone: stoneMaterial(0x9aa694, 3, 2), gold, moss, leaf });

  // The four mana runes orbit the portal.
  // Decoration only: the game raycasts the scene (camera clearance, ground), and an r128 Sprite throws on a ray without a camera.
  const runes = RUNES.map(glyph => { const s = new THREE.Sprite(runeMaterial(glyph)); s.scale.setScalar(.95); s.raycast = () => {}; group.add(s); return s; });

  // Rune crystals at the plaza's leaf tips, each on a small stone foot.
  const crystalMaterial = new THREE.MeshStandardMaterial({ color: 0x4fd39c, emissive: 0x1fae74, emissiveIntensity: 1.1, roughness: .2, metalness: .1 });
  const crystals = CRYSTALS.map(([x, z]) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(.42, .52, .35, 6), stone), x, FLOOR + .17, z);
    const c = add(new THREE.Mesh(new THREE.OctahedronGeometry(.36), crystalMaterial), x, FLOOR + 1.05, z, false);
    c.scale.y = 1.8; return c;
  });

  // Two lanterns flank the gate; their one shared light is the sanctum's only light.
  const flame = new THREE.MeshStandardMaterial({ color: 0xffe3a0, emissive: 0xffc860, emissiveIntensity: 1.6 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2a22, metalness: .5, roughness: .5, transparent: true, opacity: .55 }); // the flame shows through
  for (const [x, z] of LANTERNS) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 1.9, 6), stone), x, FLOOR + .95, z);
    add(new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .42), iron), x, FLOOR + 2.1, z, false);
    add(new THREE.Mesh(new THREE.BoxGeometry(.3, .36, .3), flame), x, FLOOR + 2.1, z, false);
    add(new THREE.Mesh(new THREE.ConeGeometry(.34, .28, 4), gold), x, FLOOR + 2.5, z, false).rotation.y = Math.PI / 4;
  }
  const light = new THREE.PointLight(0xffd88a, .9, 15, 2); light.position.set(GATE.x, FLOOR + 2.4, GATE.z - 2.5); group.add(light);

  // The lookout stone at the east overlook, facing Heavenly Falls.
  const bench = add(new THREE.Mesh(new THREE.BoxGeometry(2.2, .45, .75), stone), LOOKOUT.x, FLOOR + .22, LOOKOUT.z);
  bench.rotation.y = LOOKOUT.yaw;

  // Clover petals drifting on the wind across the summit.
  const PETALS = 46, petalPositions = new Float32Array(PETALS * 3), petalGeometry = new THREE.BufferGeometry();
  petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  const petals = new THREE.Points(petalGeometry, new THREE.PointsMaterial({ map: petalTexture(), size: .32, transparent: true, depthWrite: false, alphaTest: .05 }));
  petals.frustumCulled = false; petals.raycast = () => {}; group.add(petals); // a ray hits any point within 1 m: it would pull the camera in

  onReady?.(group);

  let time = 0, arrived = false, arrivalTime = 0;
  function update(player, dt) {
    group.visible = Math.hypot(player.x - PLAZA.x, player.z - PLAZA.z) < SHOW_WITHIN;
    if (!group.visible) return null;
    time += dt;
    runes.forEach((s, i) => {
      const a = time * .35 + i * Math.PI / 2, r = GATE.half + 1.1;
      s.position.set(GATE.x + Math.cos(a) * r, FLOOR + GATE.rise + Math.sin(a) * r * .9, GATE.z - .45);
      s.visible = s.position.y > FLOOR + .6; // they dip behind the ground at the bottom of the orbit
    });
    keystone.rotation.y = Math.sin(time * .6) * .35;
    crystals.forEach((c, i) => { c.rotation.y += dt * .5; c.position.y = FLOOR + 1.05 + Math.sin(time * 1.3 + i * 1.7) * .1; });
    for (let i = 0; i < PETALS; i++) {
      const h = world.hash(i, 951), k = world.hash(i, 952), drift = (time * (.35 + h * .25) + k * 64) % 64;
      petalPositions.set([-10 + ((h * 26 + Math.sin(time * .4 + i) * 1.5) % 26 + 26) % 26, FLOOR + .4 + ((k * 4.5 + Math.sin(time * .9 + i * 1.3) * .5) % 4.5 + 4.5) % 4.5,
        -542 + drift], i * 3);
    }
    petalGeometry.attributes.position.needsUpdate = true;
    arrivalTime = Math.max(0, arrivalTime - dt);
    const inside = Math.hypot(player.x - PLAZA.x, player.z - (PLAZA.z - 12)) < 16 && Math.abs(player.y - FLOOR - 2.05) < 1.5;
    if (inside && !arrived) { arrived = true; arrivalTime = 5; }
    return arrivalTime > 0 ? 'CLOVER SANCTUM · THE CLOVER WALK' : inside ? 'CLOVER SANCTUM · THE GATEWAY TO THE SKY GARDEN' : null;
  }
  return { colliders, update, reset() { time = 0; arrived = false; arrivalTime = 0; } };
}

// The plaza floor: four heart-shaped paved leaves around a clover heart, ringed by the four runes in gold.
function plazaMaterial(world) {
  const N = 1024, c = N / 2, R = N / 2;
  const make = () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = N; return [canvas, canvas.getContext('2d')]; };
  const [canvas, ctx] = make(), [glowCanvas, gctx] = make();
  const leafPath = (g, a) => { // adds one heart leaf, from the centre toward angle a, to the current path
    g.save(); g.translate(c, c); g.rotate(a);
    g.moveTo(0, 0); g.bezierCurveTo(-R * .2, -R * .15, -R * .52, -R * .38, -R * .38, -R * .72);
    g.bezierCurveTo(-R * .28, -R * .93, -R * .06, -R * .9, 0, -R * .7);
    g.bezierCurveTo(R * .06, -R * .9, R * .28, -R * .93, R * .38, -R * .72);
    g.bezierCurveTo(R * .52, -R * .38, R * .2, -R * .15, 0, 0); g.closePath(); g.restore();
  };
  const leaves = [1, 3, 5, 7].map(k => k * Math.PI / 4);
  // Paving: pale stone with per-flag tone, laid in rings and radial joints, clipped to the leaves.
  ctx.save(); ctx.beginPath(); for (const a of leaves) { leafPath(ctx, a); } ctx.clip('nonzero');
  ctx.fillStyle = '#7f8875'; ctx.fillRect(0, 0, N, N);
  for (let ring = 0; ring < 9; ring++) for (let k = 0; k < 10 + ring * 5; k++) {
    const r0 = ring * R * .11, r1 = r0 + R * .11, a0 = k / (10 + ring * 5) * Math.PI * 2, a1 = (k + 1) / (10 + ring * 5) * Math.PI * 2;
    const tone = 104 + world.hash(ring, k + 930) * 30 | 0; // darker than the bright summit grass, so the leaves read
    ctx.fillStyle = `rgb(${tone},${tone + 8},${tone - 6})`; ctx.beginPath(); ctx.arc(c, c, r1, a0, a1); ctx.arc(c, c, r0, a1, a0, true); ctx.fill();
    ctx.strokeStyle = 'rgba(40,48,34,.7)'; ctx.lineWidth = 4; ctx.stroke();
  }
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${i % 2 ? '74,92,52' : '210,214,190'},.18)`; ctx.fillRect(world.hash(i, 931) * N, world.hash(i, 932) * N, 3, 3); } // moss and grit
  ctx.restore();
  ctx.lineWidth = 10; ctx.strokeStyle = '#5d6a5a'; ctx.beginPath(); for (const a of leaves) leafPath(ctx, a); ctx.stroke(); // kerb
  // Heart of the clover and the rune ring, gold; the same marks glow faintly (emissive map).
  for (const [g, colour, width] of [[ctx, '#d8b25a', 9], [gctx, '#b8ffb0', 9]]) {
    g.strokeStyle = colour; g.fillStyle = colour; g.lineWidth = width;
    g.beginPath(); g.arc(c, c, R * .3, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(c, c, R * .2, 0, Math.PI * 2); g.stroke();
    g.font = `${R * .085 | 0}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillText(RUNES[i % 4], c + Math.cos(a) * R * .25, c + Math.sin(a) * R * .25); }
  }
  ctx.fillStyle = '#2f6b3c'; ctx.beginPath(); ctx.arc(c, c, R * .19, 0, Math.PI * 2); ctx.fill();
  gctx.fillStyle = '#4bd23a'; gctx.font = `${R * .3 | 0}px Georgia, serif`; gctx.fillText('♣', c, c + R * .02);
  ctx.fillStyle = '#8fe36b'; ctx.font = `${R * .3 | 0}px Georgia, serif`; ctx.fillText('♣', c, c + R * .02);
  const map = new THREE.CanvasTexture(canvas), emissiveMap = new THREE.CanvasTexture(glowCanvas);
  map.encoding = emissiveMap.encoding = THREE.sRGBEncoding; map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: .55, roughness: .95, transparent: true, alphaTest: .5,
    ...ABOVE_CAP });
}

function runeMaterial(glyph) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const halo = ctx.createRadialGradient(64, 64, 4, 64, 64, 60); halo.addColorStop(0, 'rgba(184,255,176,.55)'); halo.addColorStop(1, 'rgba(184,255,176,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, 128, 128);
  ctx.font = '76px Georgia, serif'; ctx.fillStyle = '#f3dc8e'; ctx.shadowColor = '#d8b25a'; ctx.shadowBlur = 14; ctx.fillText(glyph, 64, 68);
  const map = new THREE.CanvasTexture(canvas); map.encoding = THREE.sRGBEncoding;
  return new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false });
}

function petalTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.translate(32, 32); ctx.rotate(.6);
  ctx.fillStyle = '#b7f08f'; ctx.beginPath(); ctx.ellipse(-6, 0, 10, 16, 0, 0, Math.PI * 2); ctx.ellipse(6, 0, 10, 16, 0, 0, Math.PI * 2); ctx.fill(); // a clover leaflet
  ctx.strokeStyle = 'rgba(60,120,40,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
  const map = new THREE.CanvasTexture(canvas); map.encoding = THREE.sRGBEncoding; return map;
}

// A 1.8 m ribbon following PATH (smoothed), its texture a strip of flat stepping stones that repeats along it.
function pathRibbon(world) {
  const curve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, DECAL_Y, z)));
  const steps = 120, half = .9, positions = [], uvs = [], index = [];
  let along = 0, last = curve.getPoint(0);
  for (let i = 0; i <= steps; i++) {
    const p = curve.getPoint(i / steps), t = curve.getTangent(i / steps);
    along += p.distanceTo(last); last = p;
    positions.push(p.x - t.z * half, p.y, p.z + t.x * half, p.x + t.z * half, p.y, p.z - t.x * half);
    uvs.push(0, along / 3.6, 1, along / 3.6); // one texture tile per 3.6 m
    if (i) { const k = i * 2; index.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  // Two staggered columns of rounded flags per tile, each a jittered polygon with a darker joint and a light top.
  for (let i = 0; i < 6; i++) {
    const cx = 128 + (i % 2 ? 48 : -48) + (world.hash(i, 1001) - .5) * 30, cy = 42 + i * 85, r = 40 + world.hash(i, 1002) * 12;
    ctx.beginPath();
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = r * (.82 + world.hash(i * 9 + k, 1003) * .3); ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr * 1.15, cy + Math.sin(a) * rr * .9); }
    ctx.closePath();
    const tone = 112 + world.hash(i, 1004) * 30 | 0;
    ctx.fillStyle = `rgb(${tone},${tone + 6},${tone - 4})`; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(52,60,44,.85)'; ctx.stroke();
    ctx.fillStyle = 'rgba(230,232,210,.16)'; ctx.beginPath(); ctx.ellipse(cx - r * .2, cy - r * .25, r * .55, r * .32, -.3, 0, Math.PI * 2); ctx.fill();
  }
  const map = new THREE.CanvasTexture(canvas); map.encoding = THREE.sRGBEncoding; map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, roughness: 1, transparent: true, alphaTest: .5, side: THREE.DoubleSide, ...ABOVE_CAP }));
}
