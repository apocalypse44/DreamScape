import { SPADE_HOUSES, SPADE_WALLS, SPADE_TOWERS, SPADE_WINGS, SPADE_FIXTURES, SPADE_MOUNTAINS, SPADE_CURTAIN_MODULES, SPADE_RETAINING, spadePosition, spadeHeight, spadeVolumes, spadeColliders } from '../models/spade.js';
import { spadeClimateAt } from '../models/climate.js';
import { buildCastleInterior } from './spadeCastle.js';
import { isInsideSpadeCastle } from '../models/spadeCastle.js';
import { createFrameQueue } from '../models/streaming.js';
import { buildSpadeStory } from './spadeStory.js';
import { buildCastleEcho } from './castleEcho.js';

// Large forms are procedural and available immediately. Ten curated modules stream
// on approach, then render in batches (one draw per source mesh, not per building).
export function createSpade({ scene, world, onReady, notify }) {
  const root = new THREE.Group(); root.name = 'Spade · The Swarm Remembers'; scene.add(root);
  const details = new THREE.Group(); root.add(details);
  const obstacles = new THREE.Group(); root.add(obstacles);
  const platforms = spadeVolumes();
  const colliders = spadeColliders(platforms);
  const batches = new Map(), modules = new Map();
  const box = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(1, 1, 5);
  const gableShape = new THREE.Shape(); gableShape.moveTo(-0.5, -0.5); gableShape.lineTo(0, 0.5); gableShape.lineTo(0.5, -0.5); gableShape.closePath();
  const gable = new THREE.ExtrudeGeometry(gableShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  const geometries = { box, cone, gable, orb:new THREE.IcosahedronGeometry(1,1),disc:new THREE.CylinderGeometry(1,1,1,20), mountain: new THREE.CylinderGeometry(0.48, 1, 1, 7), snowcap: new THREE.ConeGeometry(1, 1, 7) };
  const materials = Object.fromEntries(Object.entries({ stone: 0x44475d, roof: 0x202942, snow: 0xc4d1e2,
    trim: 0x747b9b, house: 0x717687, road: 0x58647e, mountain: 0x343b58,wood:0x685346,cloth:0x846958 }).map(([key, color]) =>
    [key, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })]));
  materials.light = new THREE.MeshBasicMaterial({ color: 0xffd39a });
  materials.wisp = new THREE.MeshBasicMaterial({ color: 0xc4acff });
  for(const [key,color]of Object.entries({root:0x72a87f,tide:0x59a9c3,prism:0xcea361}))materials[key]=new THREE.MeshBasicMaterial({color});
  const matrix = new THREE.Matrix4(), dummy = new THREE.Object3D();
  function add(kind, u, y, v, w, h, d, material = 'stone', rotation = 0) {
    const key = `${kind}:${material}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push({ u, y, v, w, h, d, rotation });
  }
  function module(name, u, y, v, w, h, d, rotation = 0) {
    if (!modules.has(name)) modules.set(name, []);
    modules.get(name).push({ u, y, v, w, h, d, rotation });
  }
  function transform(p) {
    const at = spadePosition(p.u, p.v);
    dummy.position.set(at.x, p.y, at.z); dummy.rotation.set(0, p.rotation, 0);
    dummy.scale.set(p.w, p.h, p.d); dummy.updateMatrix(); return dummy.matrix;
  }
  function block(u, v, w, d, height, y = spadeHeight(-344 - u), material = 'stone', solid = false) {
    add('box', u, y + height / 2, v, w, height, d, material);
    if (solid) {
      const at = spadePosition(u, v);
      const mesh = new THREE.Mesh(box, materials[material]);
      mesh.position.set(at.x, y + height / 2, at.z); mesh.scale.set(w, height, d);
      // A separate low-poly camera obstacle avoids raycasting every decoration.
      mesh.visible = false; obstacles.add(mesh);
    }
  }
  function tower(u, v, width, height) {
    const y = spadeHeight(-344 - u);
    block(u, v, width, width, height, y, 'stone', true);
    module('tower', u, y, v, width + 0.15, height, width + 0.15);
    module('crown', u, y + height, v, width + 1, 2.5, width + 1);
    module('spire', u, y + height + 2, v, width + 2, 11, width + 2);
    add('cone', u, y + height + 7, v, width * 0.78, 13, width * 0.78, 'roof', Math.PI / 4);
    add('cone', u, y + height + 8.2, v, width * 0.7, 11, width * 0.7, 'snow', Math.PI / 4);
  }
  // Thirty houses, six shared building forms, a clear 30m-wide avenue for wisps.
  for (const h of SPADE_HOUSES) {
    const y = spadeHeight(-344 - h.u);
    // The stone plinth reaches below the levelled pad, hiding coarse terrain edges.
    block(h.u, h.v, h.depth + 0.5, h.width + 0.5, 3.15, y - 3, 'stone');
    if(!h.refuge)block(h.u, h.v, h.depth, h.width, h.height, y, 'house', true);
    module('roof', h.u, y + h.height, h.v, h.depth + 2, 4, h.width + 2);
    add('gable', h.u, y + h.height + 1.8, h.v, h.depth, 3.6, h.width, 'house');
    add('gable', h.u, y + h.height + 2.35, h.v, h.depth + 2.1, 4, h.width + 2.1, 'snow');
    module('chimney', h.u + 2, y + h.height + 1.5, h.v + 2, 1.1, 3.5, 1.1);
    const face = h.v > 0 ? -1 : 1;
    if(!h.refuge){
      module('window', h.u, y + 0.4, h.v + face * (h.width / 2 + 0.04), h.depth, h.height - 0.5, 0.35, face > 0 ? 0 : Math.PI);
      for (const offset of [-2.4, 2.4]) block(h.u + offset, h.v + face * (h.width / 2 + 0.08), 1.2, 0.08, 1.7, y + 2, 'light');
    }
  }
  // One connected ribbon follows the grade, rather than floating horizontal
  // paving bars above the slope. The final section meets the castle foundation.
  const roadPositions = [], roadIndices = [];
  for (let i = 0; i <= 62; i++) {
    const u = i * 2, at = spadePosition(u), y = Math.max(spadeHeight(at.x), u >= 110 ? 16.12 : -Infinity) + 0.025;
    roadPositions.push(at.x, y, -7, at.x, y, 7);
    if (i < 62) { const n = i * 2; roadIndices.push(n, n+2, n+1, n+1, n+2, n+3); }
  }
  const roadGeometry = new THREE.BufferGeometry(); roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeometry.setIndex(roadIndices); roadGeometry.computeVertexNormals(); root.add(new THREE.Mesh(roadGeometry, materials.road));
  for (let u = 10; u <= 114; u += 20) for (const side of [-1, 1]) {
    const y = spadeHeight(-344 - u), v = side * 10;
    block(u, v, 0.4, 0.4, 3.8, y);
    block(u, v, 0.9, 0.9, 0.65, y + 3.7, 'light');
  }
  // Border gate: open arch, twin snowy bastions, static ornate suit insignia.
  for (const t of SPADE_TOWERS) tower(t.u, t.v, t.width, t.height);
  block(0, 0, 3, 19, 3, 14, 'stone');
  // Retaining walls leave the main ramp clear; they frame the elevated castle.
  for(const p of SPADE_RETAINING)block(p.u,p.v,p.width,p.depth,p.height,p.bottom,'stone');
  for(const p of SPADE_CURTAIN_MODULES)
    module('wall',p.u,p.bottom,p.v,p.depth,p.height,p.width,Math.PI/2);
  // Wings overlap the hall walls and tower bases. Continuous slabs close the
  // old open strips between the centre hall and the side buildings.
  for (const wing of SPADE_WINGS) {
    block(wing.u, wing.v, wing.width, wing.depth, wing.height, wing.bottom, 'stone', true);
    block(wing.u, wing.v, wing.width + 0.4, wing.depth + 0.4, 0.5, wing.bottom + wing.height, 'snow');
  }
  block(149, 0, 78, 102, 1.62, 14.5, 'stone');
  // A real hollow hall. No collision volume spans the doorway or room interior.
  for (const w of SPADE_WALLS) block(w.u, w.v, w.width, w.depth, w.height, 16, 'stone', true);
  block(123, 0, 2, 12, 9, 27, 'stone', true); // doorway lintel
  block(150, 0, 56, 35, 0.5, 36, 'snow', true);
  // Raised central crown sits over the back of the hall, leaving its interior open.
  block(165, 0, 19, 20, 14, 36.5);
  module('tower', 165, 36.5, 0, 19.2, 14, 20.2);
  module('crown', 165, 50, 0, 21, 3, 22);
  module('spire', 165, 53, 0, 24, 22, 24);
  add('cone', 165, 64, 0, 17, 25, 17, 'roof', Math.PI / 4);
  add('cone', 165, 66, 0, 15, 22, 15, 'snow', Math.PI / 4);
  // Small interior gallery; columns keep a wide central lane for the companion.
  for (let u = 132; u < 172; u += 12) for (const v of [-11, 11]) {
    module('torch', u, 19.5, Math.sign(v) * 14.65, 0.7, 2, 0.7);
    block(u, Math.sign(v) * 14.65, 0.3, 0.3, 0.65, 21, 'light');
  }
  for (let u = 128; u < 174; u += 6) block(u, 0, 5.5, 5, 0.06, 16, 'roof');
  for (const fixture of SPADE_FIXTURES) {
    const y = fixture.bottom ?? spadeHeight(-344 - fixture.u);
    if (fixture.name === 'lantern') continue; // already rendered beside the avenue
    if (fixture.name === 'pedestal') {
      block(fixture.u, fixture.v, fixture.width, fixture.depth, fixture.height, y, 'stone', true);
      add('cone', fixture.u, 20.1, fixture.v, 0.8, 2, 0.8, 'wisp');
    } else module(fixture.name, fixture.u, y, fixture.v, fixture.width, fixture.height, fixture.depth);
  }
  // Separate lower rock and upper snow sections meet at one seam instead of
  // overlapping almost-coplanar pyramids. Both share the collision polygon.
  for (const m of SPADE_MOUNTAINS) {
    add('mountain', m.u, m.bottom + m.height * 0.26, m.v, m.radiusX, m.height * 0.52, m.radiusZ, 'mountain', m.rotation);
    add('snowcap', m.u, m.bottom + m.height * 0.76, m.v, m.radiusX * 0.48, m.height * 0.48, m.radiusZ * 0.48, 'snow', m.rotation);
    const proxy = new THREE.Mesh(geometries.snowcap, materials.mountain), at = spadePosition(m.u, m.v);
    proxy.position.set(at.x, m.bottom + m.height / 2, at.z); proxy.scale.set(m.radiusX, m.height, m.radiusZ);
    proxy.rotation.y = m.rotation; proxy.visible = false; obstacles.add(proxy);
  }
  // Ground obstacles for terrain A*: doorway and avenue remain clear.
  for (const p of platforms) {
    // Camera and movement see the same rigid fixtures even before assets load.
    if (!p.topAt) {
      const proxy = new THREE.Mesh(box, materials.stone);
      proxy.position.set(p.x, (p.bottom + p.top) / 2, p.z); proxy.scale.set(p.width, p.top - p.bottom, p.depth);
      proxy.visible = false; obstacles.add(proxy);
    }
  }
  function label(text, u, y, v, width, rotation = Math.PI / 2) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#11192b'; ctx.fillRect(0, 0, 768, 128);
    ctx.strokeStyle = '#aebbd4'; ctx.strokeRect(8, 8, 752, 112);
    ctx.font = '28px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#e1e6f3'; ctx.fillText(text, 384, 76, 724);
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 6), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    const at = spadePosition(u, v); sign.position.set(at.x, y, at.z); sign.rotation.y = rotation; root.add(sign);
  }
  label('SPADE KINGDOM · THE SWARM REMEMBERS', -1.6, 13.9, 0, 16);
  label('LANTERN REFUGE', 22,5.9,-17.75,8,0);
  label('LANTERN ATRIUM · ARCHIVE ABOVE', 121.9, 25, 0, 10);
  const echo = buildCastleEcho({root,obstacles,notify});
  platforms.push(...echo.model.platforms);
  const castle = buildCastleInterior({root,add,block,module,label,notify,echo:echo.model});
  const story=buildSpadeStory({root,add,block,label,height:spadeHeight});
  // Flush after interior construction so its repeated steps, shelves and rails
  // join the same batches instead of adding a draw call for every object.
  for (const [key, placements] of batches) {
    const [kind, material] = key.split(':');
    const mesh = new THREE.InstancedMesh(geometries[kind], materials[material], placements.length);
    placements.forEach((p, i) => mesh.setMatrixAt(i, transform(p)));
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false;
    mesh.receiveShadow = true; root.add(mesh);
  }
  const emblem = createSpadeEmblem(); emblem.position.set(-342.2, 21, 0); emblem.rotation.y = Math.PI / 2; root.add(emblem);
  // One local fill light, no extra shadow map; enough to read the hall at night.
  const hallLight = new THREE.PointLight(0x9dafff, 1.6, 60, 1.5);
  hallLight.position.set(-494, 25, 0); root.add(hallLight);
  // Local snowfall is one draw, bounded to the player's surroundings.
  const snowCount = 560;
  const snowGeo = new THREE.BufferGeometry(), snowData = new Float32Array(snowCount * 3);
  for (let i = 0; i < snowCount; i++) { snowData[i * 3] = world.hash(i, 91) * 100 - 50; snowData[i * 3 + 1] = world.hash(i, 92) * 38; snowData[i * 3 + 2] = world.hash(i, 93) * 100 - 50; }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowData, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xe1e9ff, size: 0.13, transparent: true, opacity: 0.7, depthWrite: false }));
  snow.frustumCulled = false; scene.add(snow);
  onReady?.(root);
  let loading = false, status = 'waiting';
  const preparation=createFrameQueue();
  const errors = [], memories = new Set();
  async function loadDetails() {
    loading = true; status = 'loading';
    // One download at a time; each mesh is installed on a separate game frame.
    const entries = [...modules.entries()];
    async function worker() {
      while (entries.length) {
        const [name, placements] = entries.shift();
        try {
          const gltf = await new Promise((resolve, reject) => new THREE.GLTFLoader().load(`assets/spade/${name}.glb`, resolve, undefined, reject));
          const source = gltf.scene; source.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(source), size = bounds.getSize(new THREE.Vector3());
          const normal = new THREE.Matrix4().makeScale(1 / Math.max(size.x, 0.001), 1 / Math.max(size.y, 0.001), 1 / Math.max(size.z, 0.001));
          normal.multiply(new THREE.Matrix4().makeTranslation(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2));
          const pieces=[];source.traverse(child=>{if(child.isMesh)pieces.push(child);});
          for(const child of pieces)await new Promise((resolve,reject)=>preparation.push(()=>{
            try{
              const mesh = new THREE.InstancedMesh(child.geometry, child.material, placements.length);
              const local = new THREE.Matrix4().multiplyMatrices(normal, child.matrixWorld);
              placements.forEach((p, i) => mesh.setMatrixAt(i, matrix.multiplyMatrices(transform(p), local)));
              mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.receiveShadow = true;
              onReady?.(mesh);details.add(mesh);resolve();
            }catch(error){reject(error);}
          }));
        } catch (error) { errors.push(name); console.warn(`Spade detail ${name} unavailable`, error); }
      }
    }
    await worker(); status = errors.length ? 'partial' : 'ready';
  }
  return {
    root, obstacles, platforms, colliders, castle, story, echo:echo.model,
    get streaming(){return {pending:preparation.pending,prepared:preparation.completed};},
    isInsideCastle: isInsideSpadeCastle,
    get status() { return status; }, get errors() { return [...errors]; },
    update(dt, player, state) {
      const distance = Math.hypot(player.position.x + 460, player.position.z);
      root.visible = distance < 520; details.visible = root.visible;
      if(!loading&&distance<380){
        loading=true;status='queued';
        if(globalThis.requestIdleCallback)requestIdleCallback(()=>loadDetails(),{timeout:1200});
        else setTimeout(()=>loadDetails(),0);
      }
      preparation.run();
      const climate = spadeClimateAt(player.position.x, player.position.z);
      const inHall = player.position.x < -467 && player.position.x > -521 && Math.abs(player.position.z) < 15;
      echo.update(dt,player,state);
      castle.update(dt,player,state,inHall);
      story.update(dt,player,state,notify);
      // Keep the light count constant. Toggling visibility changes shader
      // variants for every lit material as the player approaches the castle.
      hallLight.intensity = distance < 90 ? 1.6 : 0;
      snow.visible = climate > 0.01 && !inHall&&!story.insideRefuge(player.position);
      snow.material.opacity = 0.7 * climate;
      if (snow.visible) {
        snow.position.copy(player.position); snow.position.y -= 8;
        for (let i = 0; i < snowCount; i++) {
          snowData[i * 3] = ((snowData[i * 3] + dt * (1.2 + state.chaos * 4) + 50) % 100) - 50;
          snowData[i * 3 + 1] = (snowData[i * 3 + 1] - dt * (2 + state.chaos * 5) + 38) % 38;
        }
        snowGeo.attributes.position.needsUpdate = true;
      }
      if (!state.locked || state.chaos > 0.4) return;
      const visit = (key, condition, text) => { if (condition && !memories.has(key)) { memories.add(key); notify?.(text, 6500); } };
      visit('hall', inHall && player.position.x > -490,
        'MEMORY HALL · Clover reveals the true binding. Heart restores the stolen current. Diamond turns the chains.');
    },
    reset() { memories.clear(); castle.reset(); echo.reset(); story.reset(); },
  };
}

// Vector geometry inspired by the supplied spade crest: pale scrolls, layered
// pointed outline, three inner lobes, and engraved rays. No image download.
function createSpadeEmblem() {
  const group = new THREE.Group();
  const outline = new THREE.Shape(); outline.moveTo(0, 3.8);
  outline.bezierCurveTo(-1, 2, -4, 0.5, -3.6, -1.6); outline.bezierCurveTo(-3.2, -3.1, -1, -2.9, -0.35, -1.7);
  outline.lineTo(-1.1, -3.7); outline.lineTo(1.1, -3.7); outline.lineTo(0.35, -1.7);
  outline.bezierCurveTo(1, -2.9, 3.2, -3.1, 3.6, -1.6); outline.bezierCurveTo(4, 0.5, 1, 2, 0, 3.8);
  const ink = new THREE.MeshBasicMaterial({ color: 0x10172b }), blue = new THREE.MeshBasicMaterial({ color: 0x52688b }), pale = new THREE.MeshBasicMaterial({ color: 0xcbd6e5 });
  const geometry = new THREE.ShapeGeometry(outline, 24);
  for (const [s, z, material] of [[1.12, 0, pale], [1.03, 0.025, ink], [0.93, 0.05, blue], [0.79, 0.075, ink]]) {
    const mesh = new THREE.Mesh(geometry, material); mesh.scale.setScalar(s); mesh.position.z = z; group.add(mesh);
  }
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(side * 2.8, -2.3 + row * 1.6, 0),
      new THREE.Vector3(side * 6, -1.8 + row * 1.6, 0), new THREE.Vector3(side * 3.8, row * 1.6 + 1, 0), new THREE.Vector3(side * 3.5, row * 1.6 - 0.1, 0));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.11, 4, false), pale));
  }
  for (let i = 0; i < 3; i++) {
    const lobe = new THREE.Mesh(new THREE.CircleGeometry(0.65, 24), blue);
    lobe.position.set(i === 0 ? 0 : i === 1 ? -0.85 : 0.85, i === 0 ? 0.65 : -0.35, 0.1); group.add(lobe);
    const centre = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), ink); centre.position.copy(lobe.position); centre.position.z += 0.02; group.add(centre);
  }
  const rayPositions = [];
  for (let i = 0; i < 13; i++) { const a = 0.2 + i * (Math.PI - 0.4) / 12;
    rayPositions.push(Math.cos(a), Math.sin(a), 0.13, Math.cos(a) * 2.55, Math.sin(a) * 2.55, 0.13); }
  const rays = new THREE.BufferGeometry(); rays.setAttribute('position', new THREE.Float32BufferAttribute(rayPositions, 3));
  group.add(new THREE.LineSegments(rays, new THREE.LineBasicMaterial({ color: 0x8396b6 })));
  return group;
}
