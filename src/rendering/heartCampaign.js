import { createHeartCampaign, HEART_QUAKE } from '../models/heartCampaign.js';
import { addShake } from './fx.js';
import { createSoftDot, createWaterSurface } from './waterfall.js';
import { createWaterSpirit } from './waterSpirit.js';
import { createGrapple } from '../models/grapple.js';

// Heart's risen reef: a ring of upside-down mountains over the crater, joined by crystal bridges.
// Each island is built at its final height inside its own group; the group slides up from underground
// during the earthquake (model.islandTop), so quest markers parented to it ride along.
// onVision(kind): play the earthquake vision; 'nim' when Nim shows it in Clover, 'gate' on arrival in Heart.
// talkHint(position): the game's other talk prompts (Neris, Orin, the Shrine Keeper), shown in the same box as Nim's.
// onMeet: the first talk with Sera (the game plays the Listening Spring's memory).
export function buildHeartCampaign({ scene, world, keys, ready, notify, onSigil, onReady, onVision, onMeet, scout = null, talkHint = () => null }) {
  const model = createHeartCampaign({
    layout: world.heart,
    ready,
    terrainHeight: world.terrainHeight,
    scout,
  });
  const layout = model.layout;
  const root = new THREE.Group();
  root.name = 'Heart · The Risen Reef';
  scene.add(root);
  const routeRoot = new THREE.Group();
  routeRoot.name = 'Heart · A* route';
  scene.add(routeRoot);
  const colliders = [];
  const platforms = [];
  const basic = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xff5264, roughness: 0.26, metalness: 0.12, emissive: 0x740b22, emissiveIntensity: 1.1, flatShading: true });
  const dormant = new THREE.MeshStandardMaterial({ color: 0x5b3941, roughness: 0.35, emissive: 0x260d18, emissiveIntensity: 0.4, flatShading: true });
  const tide = new THREE.MeshStandardMaterial({ color: 0x75efff, roughness: 0.2, emissive: 0x1b8fa3, emissiveIntensity: 0.9, transparent: true, opacity: 0.82, flatShading: true });
  const anchorGlow = new THREE.MeshStandardMaterial({ color: 0x7fe3ee, emissive: 0x2bb8c9, emissiveIntensity: 0.8, roughness: 0.3, flatShading: true });
  const cap = new THREE.MeshStandardMaterial({ color: 0x9b4656, roughness: 0.85, flatShading: true });
  const causewayStone = new THREE.MeshStandardMaterial({ color: 0x6a3440, roughness: 0.9, flatShading: true });
  const rock = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const pathMaterial = new THREE.LineBasicMaterial({ color: 0x85ffff, transparent: true, opacity: 0.92, depthWrite: false });
  const exploredMaterial = new THREE.PointsMaterial({ color: 0xffb0be, size: 0.42, transparent: true, opacity: 0.42, depthWrite: false, sizeAttenuation: true });

  // Rose soil at the rim, darkening to near-black crimson at the spike's tip.
  const BANDS = [0x8a4048, 0x74343e, 0x5e2a34, 0x4a222b, 0x381a22, 0x27121a];
  function mountain(island) {
    const group = new THREE.Group();
    group.name = `Heart island · ${island.id}`;
    root.add(group);
    const { top, depth } = island;
    const outline = island.outline.flatMap(([x, z], i) => {
      const [nx, nz] = island.outline[(i + 1) % island.outline.length];
      return [0, 1, 2].map(k => [x + (nx - x) * k / 3, z + (nz - z) * k / 3]);
    });
    // Wide shoulders under the rim, then a long narrowing spike.
    const levels = [[0.003, 1], [0.08, 1.06], [0.22, 0.86], [0.42, 0.6], [0.66, 0.34], [0.86, 0.15]];
    const rings = levels.map(([d, scale], r) => outline.map(([x, z], i) => {
      const jitter = r === 0 ? 1 : 0.8 + world.hash(i + island.z, r * 31 + island.x) * 0.4;
      const sag = r === 0 ? 0 : (world.hash(i * 7 + island.x, r + island.z) - 0.5) * depth * 0.1;
      return [island.x + x * scale * jitter, top - d * depth + sag, island.z + z * scale * jitter];
    }));
    const vertices = [], colors = [], n = outline.length;
    const push = (points, hex, shade) => {
      const color = new THREE.Color(hex).multiplyScalar(shade);
      for (const p of points) { vertices.push(...p); colors.push(color.r, color.g, color.b); }
    };
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, shade = 0.8 + world.hash(i, r + 1220 + island.z) * 0.35;
      push([rings[r][i], rings[r][j], rings[r + 1][i], rings[r][j], rings[r + 1][j], rings[r + 1][i]], BANDS[r], shade);
    }
    const last = rings[rings.length - 1];
    const tip = [island.x + (world.hash(island.x, island.z) - 0.5) * 2, top - depth, island.z + (world.hash(island.z, island.x) - 0.5) * 2];
    for (let i = 0; i < n; i++) push([last[i], last[(i + 1) % n], tip], BANDS[5], 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const cliff = new THREE.Mesh(geometry, rock);
    cliff.castShadow = cliff.receiveShadow = true;
    group.add(cliff);
    const shape = new THREE.Shape();
    island.outline.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    const capGeometry = new THREE.ShapeGeometry(shape);
    capGeometry.rotateX(-Math.PI / 2);
    const lid = new THREE.Mesh(capGeometry, cap);
    lid.position.set(island.x, top, island.z);
    lid.receiveShadow = true;
    group.add(lid);
    // Red crystals hang from the spike like roots, and a few cluster on the rim.
    const hanging = Math.round(island.radius * 0.8);
    for (let k = 0; k < hanging; k++) {
      const a = k / hanging * Math.PI * 2 + world.hash(k, island.index), r = island.radius * (0.25 + world.hash(island.index, k) * 0.35);
      const size = 0.4 + world.hash(k, 7 + island.index) * 0.6;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(size, size * 5, 5), crystal);
      shard.rotation.x = Math.PI;
      shard.position.set(island.x + Math.cos(a) * r, top - depth * (0.35 + world.hash(k, island.index + 40) * 0.3), island.z + Math.sin(a) * r);
      group.add(shard);
    }
    for (let k = 0; k < 3; k++) {
      const [x, z] = island.outline[(k * 3 + island.index) % island.outline.length];
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2 + k * 0.5, 5), crystal);
      spike.position.set(island.x + x * 0.86, top + 1, island.z + z * 0.86);
      spike.rotation.set((world.hash(k, island.index) - 0.5) * 0.5, k, (world.hash(island.index, k) - 0.5) * 0.5);
      spike.castShadow = true;
      group.add(spike);
    }
    const platform = {
      name: `heart-${island.id}`, x: island.x, z: island.z, solid: false,
      get top() { return model.islandTop(island); },
      // ponytail: collision is the rim's shoulder only; the spike below has none. Add a cone collider if players clip it.
      get bottom() { return model.islandTop(island) - depth * 0.35; },
      contains: (x, z, pad) => island.surface.contains(x, z, pad),
    };
    platforms.push(platform);
    // The spike's body: stacked height-limited colliders (layout.islandSolid's bands), so walking, falling
    // and flying all stop at the rock. Heights follow the island as it rises (update()).
    const bands = island.bands.map(b => {
      const collider = { x: island.x, z: island.z, radius: b.radius, minY: 0, maxY: 0, off: true, band: b };
      colliders.push(collider);
      return collider;
    });
    return { island, group, platform, bands };
  }
  const islands = layout.islands.map(mountain);
  const islandItem = point => islands.find(i => i.island.surface.contains(point.x, point.z, 1));
  // Place a mesh on whichever island holds the point, so it rises with it.
  function onIsland(point, mesh, lift = 0) {
    const item = islandItem(point);
    mesh.position.set(point.x, (item ? item.island.top : world.terrainHeight(point.x, point.z)) + lift, point.z);
    (item ? item.group : root).add(mesh);
    return mesh;
  }

  // Bridges: a sloped deck from rim to rim. Gated ones are tide-glass, raised by their switch.
  const bridges = layout.bridges.map(bridge => {
    const { start: s, end: e } = bridge;
    const run = Math.hypot(e.x - s.x, e.z - s.z), rise = e.top - s.top;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(bridge.width, 0.6, Math.hypot(run, rise)), bridge.gated ? tide : causewayStone);
    deck.position.set((s.x + e.x) / 2, (s.top + e.top) / 2 - 0.3, (s.z + e.z) / 2);
    deck.rotation.order = 'YXZ';
    deck.rotation.y = Math.atan2(e.x - s.x, e.z - s.z);
    deck.rotation.x = -Math.atan2(rise, run);
    deck.castShadow = deck.receiveShadow = true;
    root.add(deck);
    const platform = {
      name: `heart-${bridge.id}`, x: bridge.x, z: bridge.z, width: bridge.width, solid: false,
      top: Math.max(s.top, e.top), bottom: Math.min(s.top, e.top) - 1,
      // A lowered bridge is no floor (surfaceAt ignores solid, so the top hides it instead).
      topAt: (x, z) => platform.solid ? layout.bridgeTop(bridge, x, z) ?? -Infinity : -Infinity,
      contains: (x, z, pad = 0) => layout.bridgeTop(bridge, x, z, pad) !== null,
    };
    platforms.push(platform);
    return { bridge, deck, platform };
  });

  function marker(point, color, radius = 1.2) {
    const group = new THREE.Group();
    onIsland(point, group, 0.1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.11, 6, 24), basic(color));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    group.add(ring);
    const light = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 0.28), basic(color));
    light.position.y = 0.55;
    group.add(light);
    return { group, light, ring };
  }
  const spring = marker(layout.spring, 0x75efff, 1.6);
  const checkpoints = layout.checkpoints.map(point => marker(point, 0xffc7d0, 1.25));
  const core = marker(layout.core, 0xff4967, 2.1);

  // Each crystal bridge has a gate crystal at its middle while it is down, and a switch on an island.
  const passageMeshes = layout.passages.map(passage => {
    const bridge = layout.bridges.find(b => b.id === passage.bridge);
    const gate = new THREE.Mesh(new THREE.OctahedronGeometry(1.8), crystal);
    gate.position.set(passage.x, (bridge.start.top + bridge.end.top) / 2 + 1.2, passage.z);
    root.add(gate);
    const switchGroup = new THREE.Group();
    onIsland(passage.switch, switchGroup, 0.6);
    const switchMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05), dormant);
    switchMesh.castShadow = true;
    switchGroup.add(switchMesh);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.08, 6, 20), basic(0xff9aa9));
    halo.rotation.x = Math.PI / 2;
    switchGroup.add(halo);
    return { gate, switchGroup, switchMesh, passage, deck: bridges.find(b => b.bridge.id === passage.bridge).deck };
  });

  // Tide Hook crystals float over each gap: hold Q to hook one and swing (the movement lab's pendulum).
  // They only take a hook once the reef has settled; until then the anchor list is empty.
  const hookAnchors = [];
  // Swings stop at the islands' rock instead of passing through it.
  const grapple = createGrapple({ anchors: hookAnchors,
    solid: (x, y0, y1, z) => model.awakened && layout.islandSolid(x, y0, y1, z, model.islandTop) });
  const crystals = layout.swings.map(swing => {
    const anchor = { x: swing.x, y: swing.y, z: swing.z };
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), anchorGlow.clone());
    shard.scale.y = 1.7;
    shard.position.set(swing.x, swing.y, swing.z);
    root.add(shard);
    return { anchor, shard };
  });
  // The scripted drop home keeps a glowing pad on the Listening isle's edge.

  const spirit = createWaterSpirit();
  spirit.root.visible = false;
  scene.add(spirit.root);
  const surface = (x, z) => layout.height(x, z);

  let pathLine = null, explored = null, seenRoute = -1, time = 0, eWasDown = false, past = false;
  function replaceRoute() {
    if (pathLine) { routeRoot.remove(pathLine); pathLine.geometry.dispose(); }
    if (explored) { routeRoot.remove(explored); explored.geometry.dispose(); }
    pathLine = explored = null;
    const result = model.route;
    if (!result) return;
    const points = result.path.map(p => new THREE.Vector3(p.x, surface(p.x, p.z) + 0.55, p.z));
    if (points.length > 1) {
      pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), pathMaterial);
      routeRoot.add(pathLine);
    }
    if (result.explored.length) {
      const step = Math.max(1, Math.ceil(result.explored.length / 400)); // Current Sight shows the search, so keep more of it
      const marks = result.explored.filter((p, i) => i % step === 0 && surface(p.x, p.z) > 0)
        .map(p => new THREE.Vector3(p.x, surface(p.x, p.z) + 0.18, p.z));
      explored = new THREE.Points(new THREE.BufferGeometry().setFromPoints(marks), exploredMaterial);
      routeRoot.add(explored);
    }
  }

  const prompt = document.createElement('div');
  prompt.className = 'heart-prompt';
  prompt.setAttribute('aria-live', 'polite');
  prompt.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:5;padding:8px 14px;border:1px solid #e66c81;background:#190d12d9;color:#ffe1e7;font:11px "DM Mono",monospace;letter-spacing:.08em;text-align:center;pointer-events:none;display:none';
  document.body.appendChild(prompt);
  // --- The earthquake: ground tearing open, a dust burst over the crater, debris raining off rising spikes ---
  const dustTexture = createSoftDot();
  const quake = new THREE.Group();
  quake.name = 'Heart · earthquake';
  scene.add(quake);
  // Fissures are real ruptures, not lines: a dark gash with raised, broken lips, jagged width, sharp turns and
  // forks. Each tears open behind its moving tip (rows across: ground edge, lip, wall, wall, lip, ground edge).
  const fissureMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ROWS = [[-1.35, 0.02, 0x8a3328], [-0.85, 0.3, 0xa24a38], [-0.4, 0.05, 0x2a0d0c], [0.4, 0.05, 0x2a0d0c], [0.85, 0.3, 0xa24a38], [1.35, 0.02, 0x8a3328]];
  const DEEP = new THREE.Color(0x0b0304); // the gash's floor, between the walls
  let fissures = null; // built on the first quake frame, on the ground as it is before the crater opens
  function crackPath(x, z, angle, steps, width, k, stride) {
    const path = [];
    for (let step = 0; step <= steps; step++) {
      const taper = 1 - step / (steps + 1.5), jag = 0.6 + 0.8 * world.hash(k * 7 + step, 21);
      path.push({ x, z, nx: -Math.sin(angle), nz: Math.cos(angle), w: width * taper * jag, y: world.terrainHeight(x, z) });
      angle += (world.hash(k, step + 40) - 0.5) * 0.9; // sharp zig-zags
      x += Math.cos(angle) * stride; z += Math.sin(angle) * stride;
    }
    return path;
  }
  function crackMesh(path, delay) {
    const n = path.length, positions = new Float32Array(n * 7 * 3), colors = new Float32Array(n * 7 * 3), index = [];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      ROWS.forEach(([, , hex], r) => { c.set(hex); colors.set([c.r, c.g, c.b], (i * 7 + r) * 3); });
      colors.set([DEEP.r, DEEP.g, DEEP.b], (i * 7 + 6) * 3); // the floor's centre vertex
      if (!i) continue;
      const a = (i - 1) * 7, b = i * 7;
      for (let r = 0; r < 5; r++) {
        if (r === 2) { // the floor: two triangles each side of the dark centre
          index.push(a + 2, a + 6, b + 2, a + 6, b + 6, b + 2, a + 6, a + 3, b + 6, a + 3, b + 3, b + 6);
          continue;
        }
        index.push(a + r, a + r + 1, b + r, a + r + 1, b + r + 1, b + r);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, fissureMaterial);
    mesh.frustumCulled = false; mesh.receiveShadow = true;
    mesh.userData = { path, delay };
    quake.add(mesh);
    return mesh;
  }
  // grow 0..1: how far the tip has run (after the crack's delay). Behind the tip the gash widens over ~2 steps.
  function openCrack(mesh, grow) {
    const { path } = mesh.userData, n = path.length, front = grow * (n - 1), pos = mesh.geometry.attributes.position;
    for (let i = 0; i < n; i++) {
      const p = path[i], o = grow > 0 ? Math.max(0, Math.min(1, (front - i + 0.3) / 2.2)) : 0, w = p.w * o;
      ROWS.forEach(([across, up], r) => pos.setXYZ(i * 7 + r, p.x + p.nx * across * w, p.y + 0.04 + up * o, p.z + p.nz * across * w));
      pos.setXYZ(i * 7 + 6, p.x, p.y - 0.02 * o, p.z);
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    return front;
  }
  const tipPuffs = [];
  function buildFissures() {
    fissures = [];
    const centre = layout.reef;
    for (let k = 0; k < 14; k++) {
      const angle = k / 14 * Math.PI * 2 + world.hash(k, 3) * 0.3;
      const main = crackPath(centre.x + Math.cos(angle) * 3, centre.z + Math.sin(angle) * 3, angle, 22, 0.8 + world.hash(k, 9) * 0.4, k, 2.6);
      const crack = crackMesh(main, world.hash(k, 8) * 0.25);
      fissures.push(crack);
      // One or two forks peel off partway along, thinner, starting once the tip has passed them.
      for (let b = 0; b < 1 + (k % 2); b++) {
        const at = 5 + Math.floor(world.hash(k, 30 + b) * 10), p = main[at], side = b ? -1 : 1;
        const fork = crackPath(p.x, p.z, Math.atan2(main[at + 1].z - p.z, main[at + 1].x - p.x) + side * (0.6 + world.hash(k, b) * 0.4), 8, p.w * 0.6, k * 3 + b + 50, 1.9);
        fissures.push(crackMesh(fork, crack.userData.delay + at / 22 * 0.75));
      }
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTexture, color: 0xb98a80, transparent: true, depthWrite: false, opacity: 0 }));
      puff.userData.crack = crack;
      quake.add(puff);
      tipPuffs.push(puff);
    }
  }
  const dust = Array.from({ length: 48 }, (_, k) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTexture, color: 0xb98a80, transparent: true, depthWrite: false, opacity: 0 }));
    const a = world.hash(k, 11) * Math.PI * 2, r = Math.sqrt(world.hash(11, k)) * 50;
    sprite.userData = { x: layout.reef.x + Math.cos(a) * r, z: layout.reef.z + Math.sin(a) * r, delay: world.hash(k, 5) * 0.6, size: 10 + world.hash(5, k) * 12 };
    sprite.visible = false;
    quake.add(sprite);
    return sprite;
  });
  const rubble = new THREE.MeshStandardMaterial({ color: 0x3a1c22, roughness: 1, flatShading: true });
  const debris = islands.flatMap(({ island, group }) => Array.from({ length: 5 }, (_, k) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + world.hash(k, island.index) * 0.5), rubble);
    const a = world.hash(island.index, k) * Math.PI * 2, r = island.radius * 0.3;
    rock.userData = { island, x: island.x + Math.cos(a) * r, z: island.z + Math.sin(a) * r, phase: world.hash(k + 9, island.index) };
    rock.visible = false;
    quake.add(rock);
    return rock;
  }));
  function updateQuake(t) {
    quake.visible = t >= 0 && t < HEART_QUAKE.end;
    if (!quake.visible) return;
    // Rumble builds to the burst, then the rise keeps the ground trembling.
    const shake = t < HEART_QUAKE.burst ? 0.08 + 0.4 * (t / HEART_QUAKE.burst) : t < HEART_QUAKE.end ? 0.22 : 0;
    if (shake) addShake(shake);
    if (!fissures && t < HEART_QUAKE.burst) buildFissures();
    const grow = Math.max(0, Math.min(1, (t - HEART_QUAKE.fissures) / (HEART_QUAKE.burst - HEART_QUAKE.fissures)));
    for (const crack of fissures ?? []) {
      crack.visible = t < HEART_QUAKE.burst + 1;
      const { delay } = crack.userData;
      if (crack.visible) openCrack(crack, Math.max(0, Math.min(1, (grow - delay) / (1 - delay))));
    }
    // Dust kicks up at each main crack's running tip.
    for (const puff of tipPuffs) {
      const crack = puff.userData.crack, { path, delay } = crack.userData, g = Math.max(0, Math.min(1, (grow - delay) / (1 - delay)));
      puff.visible = g > 0 && g < 1 && t < HEART_QUAKE.burst;
      if (!puff.visible) continue;
      const p = path[Math.min(path.length - 1, Math.round(g * (path.length - 1)))];
      puff.position.set(p.x, p.y + 1.2, p.z); puff.scale.setScalar(3.5 + 2 * Math.sin(time * 9 + p.x));
      puff.material.opacity = 0.55 * Math.min(1, g * 8);
    }
    for (const sprite of dust) {
      const { x, z, delay, size } = sprite.userData, k = (t - HEART_QUAKE.burst - delay) / 4.5;
      sprite.visible = k > 0 && k < 1;
      if (!sprite.visible) continue;
      sprite.position.set(x, world.terrainHeight(x, z) + 2 + k * 12, z);
      sprite.scale.setScalar(size * (0.4 + k));
      sprite.material.opacity = Math.min(1, k * 6) * (1 - k) * 0.95;
    }
    for (const rock of debris) {
      const { island, x, z, phase } = rock.userData, lift = model.liftOf(island);
      rock.visible = lift > 0.02 && lift < 0.98;
      if (!rock.visible) continue;
      const fall = (time * 0.9 + phase) % 1;
      rock.position.set(x, model.islandTop(island) - island.depth * 0.9 - fall * fall * 14, z);
      rock.rotation.set(time * 2 + phase, time * 3, 0);
    }
  }

  // --- The current returns: each restored spring pours a waterfall off its island's outer rim into the
  // crater; releasing the siphon adds three off the spire and fills the crater into a lake. ---
  const water = new THREE.Group();
  water.name = 'Heart · waterfalls and lake';
  const waterRoot = water; // update() has its own `water` (the spirit)
  scene.add(water);
  const fallMaterial = createWaterSurface('fall'), lakeMaterial = createWaterSurface('lake');
  const mistMaterial = new THREE.SpriteMaterial({ map: dustTexture, color: 0xd8fbff, transparent: true, depthWrite: false, opacity: 0.5 });
  // Each fall pours off the rim over the lowest ground around the island (into the crater, where the lake
  // fills), never onto the dry rim. The spire, at the centre, pours three ways.
  const outward = island => {
    const dirs = Array.from({ length: 12 }, (_, k) => ({ x: Math.cos(k * Math.PI / 6), z: Math.sin(k * Math.PI / 6) }));
    const foot = dir => world.terrainHeight(island.x + dir.x * island.radius * 1.15, island.z + dir.z * island.radius * 1.15);
    const d = Math.hypot(island.x - layout.reef.x, island.z - layout.reef.z);
    return d > 1 ? [dirs.reduce((best, dir) => foot(dir) < foot(best) ? dir : best)]
      : [0, 1, 2].map(k => ({ x: Math.cos(k * 2.1 + 0.4), z: Math.sin(k * 2.1 + 0.4) }));
  };
  // One entry per source: the three springs (in quest order) then the spire, which opens with the sigil.
  const sources = [...layout.checkpoints.map(c => layout.island(c.id)), layout.island('spire')].map(island => ({ island, falls: null, started: -1 }));
  function pour(source) {
    const { island } = source;
    source.falls = outward(island).map(dir => {
      const x = island.x + dir.x * island.radius * 1.15, z = island.z + dir.z * island.radius * 1.15;
      const top = island.top - 0.2, height = Math.max(4, top - world.terrainHeight(x, z));
      const geometry = new THREE.PlaneGeometry(3.6, height, 1, 12);
      geometry.translate(0, -height / 2, 0); // hang from the top so it can grow downward
      const curtain = new THREE.Mesh(geometry, fallMaterial);
      curtain.position.set(x, top, z);
      curtain.rotation.y = Math.atan2(dir.x, dir.z);
      curtain.scale.y = 0.001;
      water.add(curtain);
      const mist = Array.from({ length: 4 }, (_, k) => {
        const sprite = new THREE.Sprite(mistMaterial);
        sprite.position.set(x + (k - 1.5) * 1.2, top - height + 1.5, z);
        sprite.visible = false;
        water.add(sprite);
        return sprite;
      });
      return { curtain, mist, height };
    });
  }
  // The lake: one open-water ellipse over the crater; the rim's ground hides its edge.
  const lakeLevel = world.terrainHeight(layout.shore.x, layout.shore.z) - 3.5;
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48), lakeMaterial);
  lake.rotation.x = -Math.PI / 2;
  const [axisX, axisZ] = [layout.at(1, 0).x - layout.at(0, 0).x, layout.at(1, 0).z - layout.at(0, 0).z];
  lake.rotation.z = Math.atan2(-axisZ, axisX); // stretch the circle along the road's axis (local y maps to world -z)
  lake.scale.set(layout.craterReach, layout.craterReach * 54 / 64, 1);
  lake.position.set(layout.reef.x, lakeLevel - 12, layout.reef.z);
  lake.visible = false;
  water.add(lake);
  let lakeStarted = -1, watered = false, lakeFull = false;
  // Once full, the lake is a floor at its surface (the game has no swimming): you walk on the water.
  // surfaceAt ignores solid, so contains() also checks that the lake is full.
  const lakeFloor = { name: 'heart-lake', x: layout.reef.x, z: layout.reef.z, top: lakeLevel, bottom: lakeLevel - 1, solid: false,
    contains: (x, z) => lakeFull && layout.craterDepth(x, z) > 0 && world.terrainHeight(x, z) < lakeLevel };
  platforms.push(lakeFloor);
  function updateWater(dt) {
    fallMaterial.uniforms.uTime.value = lakeMaterial.uniforms.uTime.value = time;
    const restored = [model.checkpoints > 0, model.checkpoints > 1, model.checkpoints > 2, model.sigil];
    // On a test start or a reload into a finished state, everything is simply already there.
    const snap = !watered;
    watered = true;
    sources.forEach((source, i) => {
      if (!restored[i] || !model.reefReady) return;
      if (!source.falls) { pour(source); source.started = snap ? -10 : time; }
      const grow = Math.min(1, (time - source.started) / 2.2);
      for (const fall of source.falls) {
        fall.curtain.scale.y = Math.max(0.001, grow * grow * (3 - 2 * grow));
        fall.mist.forEach((sprite, k) => {
          sprite.visible = grow >= 1;
          sprite.scale.setScalar(5 + Math.sin(time * 1.7 + k) * 1.2);
        });
      }
    });
    if (model.sigil && lakeStarted < 0) lakeStarted = snap ? -10 : time;
    lake.visible = lakeStarted >= 0;
    if (lake.visible) {
      const fill = Math.min(1, (time - lakeStarted) / 4);
      lake.position.y = lakeLevel - 12 * (1 - fill * fill * (3 - 2 * fill));
    }
    lakeFull = lake.visible && time - lakeStarted >= 4;
    lakeFloor.solid = lakeFull;
  }
  function drainWater() {
    for (const source of sources) {
      for (const fall of source.falls ?? []) { water.remove(fall.curtain, ...fall.mist); fall.curtain.geometry.dispose(); }
      source.falls = null; source.started = -1;
    }
    lakeStarted = -1; lake.visible = false; watered = false; lakeFull = false; lakeFloor.solid = false;
  }

  // --- "The Drained Tide": dry riverbeds run into the crater, a crimson siphon vein glowing down each one,
  // wilted lily pads on their floors. Restoring the current fills them teal and greens the lilies. ---
  const land = new THREE.Group();
  land.name = 'Heart · dry riverbeds';
  scene.add(land);
  const bedMaterial = new THREE.MeshStandardMaterial({ color: 0xa88478, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const veinMaterial = new THREE.MeshBasicMaterial({ color: 0xff3a52, toneMapped: false, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const lilyMaterial = new THREE.MeshStandardMaterial({ color: 0x7a6b3c, roughness: 0.9, flatShading: true });
  const ribbons = [], lilies = [];
  function ribbon(points, width, material, lift) {
    const positions = new Float32Array(points.length * 6), index = [];
    for (let i = 1; i < points.length; i++) { const k = i * 2; index.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    land.add(mesh);
    ribbons.push({ mesh, points, width, lift });
  }
  // Starts are (along, side) from the gate, out on Heart's plains; each bed wanders in to the crater rim.
  for (const [k, [along, side]] of [[245, -30], [235, 45], [190, -95], [182, 98], [118, -86], [118, 86]].entries()) {
    const points = [];
    let p = layout.at(along, side);
    for (let step = 0; step < 60 && layout.craterDepth(p.x, p.z) < 0.6; step++) {
      points.push(p);
      const dx = layout.reef.x - p.x, dz = layout.reef.z - p.z, d = Math.hypot(dx, dz);
      const bend = Math.sin(step * 0.45 + k * 2) * 0.6;
      p = { x: p.x + (dx / d + (-dz / d) * bend) * 3, z: p.z + (dz / d + (dx / d) * bend) * 3 };
    }
    if (points.length < 2) continue;
    ribbon(points, 3.4, bedMaterial, 0.06);
    ribbon(points, 0.35, veinMaterial, 0.1);
    for (let i = 3; i < points.length; i += 4) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.7 + world.hash(i, k) * 0.5, 0.8, 0.06, 9), lilyMaterial);
      pad.userData = { x: points[i].x + (world.hash(k, i) - 0.5) * 1.6, z: points[i].z + (world.hash(i + 3, k) - 0.5) * 1.6 };
      pad.rotation.set((world.hash(i, 2) - 0.5) * 0.3, world.hash(k, i) * 6, (world.hash(2, i) - 0.5) * 0.3);
      land.add(pad);
      lilies.push(pad);
    }
  }
  let seatedTerrain = -1;
  const groundAt = world.surfaceHeight ?? world.terrainHeight; // the ground as drawn, so beds sit on the visible mesh
  // Lay everything on the ground as it is now (chaos reshapes the hills; the crater opens in the quake).
  function seatLand() {
    for (const { mesh, points, width, lift } of ribbons) {
      const position = mesh.geometry.attributes.position;
      points.forEach((p, i) => {
        const next = points[Math.min(i + 1, points.length - 1)], prev = points[Math.max(i - 1, 0)];
        const dx = next.x - prev.x, dz = next.z - prev.z, d = Math.hypot(dx, dz) || 1;
        const nx = -dz / d * width / 2, nz = dx / d * width / 2;
        position.setXYZ(i * 2, p.x + nx, groundAt(p.x + nx, p.z + nz) + lift, p.z + nz);
        position.setXYZ(i * 2 + 1, p.x - nx, groundAt(p.x - nx, p.z - nz) + lift, p.z - nz);
      });
      position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
    for (const pad of lilies) pad.position.set(pad.userData.x, groundAt(pad.userData.x, pad.userData.z) + 0.12, pad.userData.z);
  }
  let landRestored = null;
  function updateLand(view, chaos) {
    land.visible = Math.hypot(view.x - layout.reef.x, view.z - layout.reef.z) < 420;
    if (!land.visible) return;
    const version = world.terrainVersion ?? 0;
    if (version !== seatedTerrain) { seatedTerrain = version; seatLand(); }
    const restored = model.sigil;
    if (restored !== landRestored) {
      landRestored = restored;
      bedMaterial.color.set(restored ? 0x2a8a9a : 0xa88478);
      bedMaterial.roughness = restored ? 0.25 : 1;
      lilyMaterial.color.set(restored ? 0x4f8a4a : 0x7a6b3c);
    }
    veinMaterial.visible = !restored; // the siphon is broken: its veins go dark
    veinMaterial.opacity = 0.45 + chaos * 0.5 + Math.sin(time * (2 + chaos * 6)) * 0.15; // they pulse harder in chaos
  }

  onReady?.(root);

  return {
    model, root, colliders, platforms, obstacles: root, grapple,
    setPast(on) { past = on; },
    /** One movement step of the Tide Hook. input: { hold, jump, moveX, moveZ, look }. owns: skip the controller. */
    step(dt, input, player, floorAt) {
      if (!hookAnchors.length && grapple.phase === 'idle') return { owns: false };
      return grapple.update(dt, input, player, floorAt);
    },
    // view: where terrain streams (the player, or a cutscene's destination).
    update(dt, player, state, inHeart, view = player.position) {
      time += dt;
      const frame = model.update(dt, player, state, inHeart);
      if (frame.vision) onVision?.(frame.vision);
      if (frame.message) notify(frame.message.text, frame.message.ms);
      const down = keys.has('KeyE');
      if (down && !eWasDown && state.locked && !state.cinematic) {
        const event = model.interact(player.position, state.mode, state.chaos);
        if (event) {
          notify(event.text, event.ms);
          if (event.kind === 'sigil') onSigil?.();
          if (event.kind === 'vision') onVision?.('nim');
          if (event.kind === 'meet') onMeet?.();
        }
      }
      eWasDown = down;
      const settled = model.reefReady;
      root.visible = model.awakened;
      updateQuake(model.quakeTime);
      updateLand(view, state.chaos);
      updateWater(dt);
      // Current Sight (hold B): the spirit's A* search lights up, and its route brightens. Off, the route
      // stays a faint guide line so the escort can still be followed.
      const sight = keys.has('KeyB') && state.locked && !state.cinematic;
      routeRoot.visible = model.stage === 'escort';
      if (explored) explored.visible = sight;
      pathMaterial.opacity += ((sight ? 0.95 : 0.35) - pathMaterial.opacity) * Math.min(1, dt * 8);
      for (const item of islands) {
        item.group.position.y = model.islandTop(item.island) - item.island.top;
        item.platform.solid = settled;
        const top = model.islandTop(item.island);
        for (const c of item.bands) {
          c.off = !model.awakened;
          c.maxY = top - Math.max(c.band.d0 * item.island.depth, 0.6);
          c.minY = top - c.band.d1 * item.island.depth;
        }
      }
      for (const item of bridges) {
        const up = settled && model.bridgeOpen(item.bridge.id);
        item.deck.visible = up;
        item.platform.solid = up;
      }
      const passages = model.passages;
      for (const item of passageMeshes) {
        const open = passages.find(p => p.id === item.passage.id)?.open;
        item.gate.visible = settled && !open;
        item.gate.rotation.y += dt * 0.45;
        item.switchGroup.visible = model.revealed.has(item.passage.id);
        item.switchMesh.material = open ? crystal : dormant;
      }
      const hookable = settled && model.stage !== 'meet'; // the Tide Hook works once Sera has explained it
      if (hookable && !hookAnchors.length) hookAnchors.push(...crystals.map(c => c.anchor));
      if (!hookable && hookAnchors.length) { hookAnchors.length = 0; grapple.reset(); }
      for (const { anchor, shard } of crystals) {
        const lit = anchor === grapple.target, hooked = anchor === grapple.anchor;
        shard.visible = hookable;
        shard.rotation.y += dt * (lit ? 3 : 0.8);
        shard.position.y = anchor.y + (hooked ? 0 : Math.sin(time * 1.4 + anchor.x) * 0.25);
        const glow = hooked ? 2.2 : lit ? 1.4 + 0.4 * Math.sin(time * 12) : 0.6;
        shard.material.emissiveIntensity += (glow - shard.material.emissiveIntensity) * Math.min(1, dt * 10);
      }
      checkpoints.forEach((item, index) => {
        item.group.visible = model.stage !== 'meet';
        item.light.scale.setScalar(index < model.checkpoints ? 1.5 : index === model.checkpoints ? 1.15 : 0.7);
        item.ring.material.color.set(index < model.checkpoints ? 0x79f0db : index === model.checkpoints ? 0xffc7d0 : 0x80505e);
      });
      spring.group.visible = model.stage !== 'meet';
      core.group.visible = model.stage !== 'meet';
      if (model.routeVersion !== seenRoute) { seenRoute = model.routeVersion; replaceRoute(); }
      const water = model.spirit;
      spirit.root.visible = Boolean(water && settled);
      if (water) {
        spirit.root.position.set(water.x, surface(water.x, water.z) + 0.2, water.z);
        spirit.update(dt);
      }
      const hook = grapple.phase === 'swing' ? 'LET GO OF Q TO FLY · SPACE TO LEAP HIGHER'
        : grapple.target && grapple.phase !== 'fire' ? 'HOLD Q · SWING FROM THE CRYSTAL' : null;
      const hint = (inHeart ? hook : null) ?? model.hint(player.position, state.mode) ?? talkHint(player.position); // Nim's prompt shows in Clover
      prompt.textContent = hint || '';
      prompt.style.display = hint && state.locked && !state.cinematic ? 'block' : 'none';
      // A flashback to before the quake: the risen reef, its water and the dry riverbeds step aside.
      if (past) root.visible = routeRoot.visible = quake.visible = waterRoot.visible = land.visible = spirit.root.visible = false;
      else waterRoot.visible = true;
      return frame;
    },
    reset() {
      model.reset();
      grapple.reset();
      hookAnchors.length = 0;
      quake.visible = false;
      drainWater();
      fissures?.forEach(crack => { quake.remove(crack); crack.geometry.dispose(); });
      fissures = null;
      for (const puff of tipPuffs) { quake.remove(puff); puff.material.dispose(); }
      tipPuffs.length = 0;
      eWasDown = false;
      seenRoute = -1;
      prompt.style.display = 'none';
      root.visible = false;
      for (const item of islands) item.platform.solid = false;
      for (const item of bridges) item.platform.solid = false;
      pathLine?.geometry.dispose();
      explored?.geometry.dispose();
      routeRoot.clear();
      pathLine = explored = null;
    },
  };
}
