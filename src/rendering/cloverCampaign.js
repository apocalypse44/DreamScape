import { createCloverCampaign, CLOVER_STORY, ROOT_APPROACH } from '../models/cloverCampaign.js';
import { CLOVER_PLATEAUS } from '../models/cloverTerrain.js';
import { ROOT_START, ROOT_LANDINGS, ROOT_OBSTACLES, ROOT_HEADINGS, ROOT_LIMITS, growRoots, rootConnects } from '../models/cloverGrowth.js';
import { fitText } from './canvasText.js';
import { cloverGroundTexture } from './cloverDressing.js';
import { guideYaw, visibleRoadSegments } from './cloverRoadLayout.js';

export function buildCloverCampaign({ scene, world, keys, ready, notify, onSigil, onHook, onReady }) {
  const model = createCloverCampaign({ seed: world.seed, ready });
  const root = new THREE.Group(); root.name = 'Clover · The Living Road'; scene.add(root);
  const obstacles = new THREE.Group(); root.add(obstacles);
  const colliders = [];
  // Flat, readable story surfaces: environment captures must not wash out guide
  // colors. Distance fog still connects the chapter to the surrounding climate.
  const mat = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const stone = mat(0x545c43), bark = mat(0x51351e), gold = mat(0xe1cb6b);
  const moss = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: cloverGroundTexture(world) });
  const ink = new THREE.MeshBasicMaterial({ color: 0x48d7ed, toneMapped: false });
  const dark = mat(0x263e2f), paper = mat(0xc6c492), rootMaterial = mat(0x72502d, { emissive: 0x244319, emissiveIntensity: .25 });
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
  function sign(title, subtitle, x, y, z, width, yaw = 0) {
    // Both readable faces sit in front of a slim backing, with posts behind the
    // lettering. All boards are beside the road and above the player's head.
    const nx = Math.sin(yaw), nz = Math.cos(yaw), halfHeight = width / 8;
    const backing = box(x, y, z, width + .12, width / 4 + .12, .12, bark);
    backing.rotation.y = yaw;
    for (const side of [-1, 1]) {
      const px = x + Math.cos(yaw) * side * width * .38;
      const pz = z - Math.sin(yaw) * side * width * .38;
      const height = y + halfHeight - ROOT_START.top;
      box(px, ROOT_START.top + height / 2, pz, .12, height, .12, bark, true);
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
  for (const p of model.platforms.filter(p => p.name !== 'living-road')) {
    if (p === ROOT_APPROACH) continue;
    const body = p.name === 'root-landing';
    const bottom = body ? -7 : p.top - 1.2, bodyTop = p.top - .12;
    box(p.x, (bodyTop + bottom) / 2, p.z, p.width, bodyTop - bottom, p.depth, stone);
    box(p.x, p.top - .08, p.z, p.width, .16, p.depth, moss);
    if (body) for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), stone);
      rib.scale.set(2, 6, 3); rib.position.set(p.x + side * (p.width / 2 - 1), 5, p.z); root.add(rib);
    }
  }
  // Open-sided archive: clear east entrance, tall root columns, shelves and a reading niche.
  for (const x of [-42, -26]) for (const z of [-410, -431]) {
    box(x, 15, z, .7, 6, .7, bark, true); box(x, 18, z, 1.2, .3, 1.2, gold);
  }
  box(-34, 18.2, -410, 17, .6, 1.2, bark);
  box(-42, 18.2, -420.5, 1, .5, 22, bark); box(-26, 18.2, -420.5, 1, .5, 22, bark);
  box(-39.5, 13.1, -410.2, 4, 2.2, .6, bark, true);
  const bookGeometry = new THREE.BoxGeometry(.18, .65, .4);
  const books = new THREE.InstancedMesh(bookGeometry, paper, 32), dummy = new THREE.Object3D();
  for (let i = 0; i < 32; i++) {
    dummy.position.set(-41 + (i % 16) * .2, 12.7 + Math.floor(i / 16), -410.2);
    dummy.rotation.set(0, 0, Math.sin(i * 5) * .06); dummy.scale.set(1, .7 + world.hash(i, 730) * .5, 1);
    dummy.updateMatrix(); books.setMatrixAt(i, dummy.matrix);
  }
  books.instanceMatrix.needsUpdate = true; root.add(books);
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
  for (const p of ROOT_OBSTACLES) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(p.radius, 0), stone);
    rock.scale.y = .8; rock.position.set(p.x, ROOT_START.top + 1, p.z); obstacles.add(rock);
    colliders.push({ x: p.x, z: p.z, radius: p.radius, minY: ROOT_START.top, maxY: ROOT_START.top + 3.5 });
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
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.65, .85, .55, 10), dark);
    pedestal.position.set(p.x, p.top + .275, p.z); obstacles.add(pedestal);
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
  for (let i = 0; i < 5; i++) box(scar.x + (i - 2) * 1.6, 12.05, scar.z - 2 + Math.abs(i - 2), .25, .12, 4, gold);
  const sigil = new THREE.Mesh(new THREE.OctahedronGeometry(.8), mat(0xb5e7a4, { emissive: 0x467b32, emissiveIntensity: .8 }));
  sigil.position.set(scar.x, 14, scar.z); root.add(sigil);
  sign('STORMLEAF SCAR', 'The original pattern survives · Read in calm', scar.x, 14.8, scar.z - 7, 4.5);
  // The tool is earned here, not in Spade. Only its lid animates; no new light is added.
  const chestAt = CLOVER_STORY.chest;
  box(chestAt.x, 12.5, chestAt.z, 1.6, 1, 1, bark, true);
  // The player approaches from the north. Hinge on the south/rear edge so
  // the lid rises away from the player and settles just past vertical.
  const lid = new THREE.Group(); lid.position.set(chestAt.x, 13, chestAt.z + .5); root.add(lid);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.65, .25, 1.05), gold); lidMesh.position.z = -.5; lid.add(lidMesh);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.25, .055, 6, 16, Math.PI * 1.6), ink);
  hook.position.set(chestAt.x, 13.6, chestAt.z); root.add(hook);
  sign('ARCHIVE CHEST', 'Read the Scar to break the seal', chestAt.x, 14.6, chestAt.z + 1.4, 2.4);

  const roots = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rootMaterial, ROOT_LIMITS.segments);
  const preview = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), previewMaterial, ROOT_LIMITS.segments);
  roots.count = preview.count = 0; roots.frustumCulled = preview.frustumCulled = false;
  roots.castShadow = roots.receiveShadow = true; root.add(roots, preview);
  // Braided edges and transverse roots make the generated F runs read as living
  // wood while the broad top still exactly matches their simple collision slab.
  const strands = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), mat(0x3f2d19), ROOT_LIMITS.segments);
  strands.count = 0; strands.frustumCulled = false; strands.castShadow = true; root.add(strands);
  const strandUp = new THREE.Vector3(0, 1, 0);
  function drawStrands(roads) {
    let count = 0;
    const put = (a, b, radius) => {
      if (count >= ROOT_LIMITS.segments - roots.count - preview.count) return;
      along.set(b.x - a.x, b.y - a.y, b.z - a.z); const length = along.length();
      if (length < .01) return;
      dummy.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      dummy.quaternion.setFromUnitVectors(strandUp, along.normalize()); dummy.scale.set(radius, length, radius);
      dummy.updateMatrix(); strands.setMatrixAt(count++, dummy.matrix);
    };
    for (const road of roads.flatMap(s => visibleRoadSegments(s))) {
      const dx = road.to.x - road.from.x, dz = road.to.z - road.from.z, length = Math.hypot(dx, dz) || 1;
      const point = (t, side) => ({ x: road.from.x + dx * t - dz / length * side,
        y: road.from.y + .28, z: road.from.z + dz * t + dx / length * side });
      for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
        put(point(i / 8, side * (1.48 + Math.sin(i * 1.7) * .12)), point((i + 1) / 8, side * (1.48 + Math.sin((i + 1) * 1.7) * .12)), .2);
      }
      for (let i = 0; i < 8; i++) put(point((i + .5) / 8, -1.5), point((i + .5) / 8, 1.5), .16);
    }
    strands.count = count; strands.instanceMatrix.needsUpdate = true;
  }
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
      dummy.scale.set(s.road ? 3.8 : .2, s.road ? .5 : .2, Math.max(.001, length * p)); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  const prompt = document.createElement('aside'); prompt.className = 'clover-action'; prompt.hidden = true; prompt.setAttribute('role', 'status'); document.body.append(prompt);
  const dialogue = document.createElement('aside'); dialogue.className = 'clover-dialogue'; dialogue.hidden = true;
  dialogue.innerHTML = '<strong></strong><p aria-live="polite"></p>'; document.body.append(dialogue);
  const debug = document.createElement('aside'); debug.className = 'clover-growth-study'; debug.hidden = true; document.body.append(debug);
  let debugOn = new URLSearchParams(location.search).get('growth') === '1';
  let pressed = false, studyPressed = false, seen = -1, time = 0, open = 0, dialogueTime = 0, inspecting = false;
  function event(result) {
    if (!result) return;
    dialogue.querySelector('strong').textContent = ['meet', 'iven', 'locked'].includes(result.kind) ? 'IVEN · ROOTKEEPER ARCHIVE' : 'THE LIVING ROAD';
    dialogue.querySelector('p').textContent = result.text;
    dialogueTime = result.ms / 1000;
    if (result.kind === 'sigil') onSigil?.();
    if (result.kind === 'hook') onHook?.();
  }
  const signature = s => `${s.from.x},${s.from.y},${s.from.z}:${s.to.x},${s.to.y},${s.to.z}`;
  function refresh(player, state) {
    const committed = model.growth;
    drawSegments(roots, committed.segments);
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
    drawStrands(visibleRoads);
    dials.forEach((dial, i) => { dial.rotation.y = guideYaw(model.guides[i]); dial.visible = i >= model.generation; });
    if (debugOn) debug.textContent = `GROWTH STUDY · L-SYSTEM\nSeed ${world.seed} · Round ${model.generation}/3\nTurtle segments ${committed.segments.length} · Rendered root parts ${roots.count + preview.count + strands.count}/128\nX → F[+B][-B]X\nB → d[+B][-B]\nF = walkable road; d = decorative branch\n[ ] save/restore turtle; + / − turn\n${(snapshot || committed).word}\nL · hide study · Completed road symbols never move.`;
    seen = model.version;
  }
  onReady?.(root);
  return {
    model, root, obstacles, colliders, platforms: model.platforms,
    atInteraction: position => Boolean(model.interaction(position)),
    update(dt, player, state, active = true) {
      time += dt;
      dialogueTime = Math.max(0, dialogueTime - dt);
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
      dialogue.hidden = dialogueTime <= 0 || !active || !state.locked || state.mapOpen || state.cinematic;
      if (hint && prompt.textContent !== hint) prompt.textContent = hint;
      debug.hidden = !debugOn || !close || !state.locked || state.cinematic || state.mapOpen;
      // Only the currently growing roots animate their matrices. Otherwise update on
      // state changes or while inspecting a guide; no allocations on distant frames.
      const atGuide = model.interaction(player.position)?.kind === 'guide';
      if (close && (seen !== model.version || model.pending || atGuide || inspecting !== atGuide || debugOn)) refresh(player, state);
      inspecting = atGuide;
      open += ((model.hook ? 1 : 0) - open) * (1 - Math.exp(-5 * dt)); lid.rotation.x = open * 1.9;
      hook.visible = model.sigil && !model.hook; hook.rotation.y += dt;
      sigil.rotation.y += dt * .4; sigil.visible = !model.sigil;
    },
    recovery: player => model.recovery(player),
    reset() { model.reset(); pressed = studyPressed = inspecting = false; seen = -1; open = dialogueTime = 0; prompt.hidden = debug.hidden = dialogue.hidden = true; roots.count = preview.count = strands.count = 0; },
  };
}
