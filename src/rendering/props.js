import { createFrameQueue } from '../models/streaming.js';
import { loadModelAsset } from './models.js';

// Stylized Nature MegaKit (Quaternius, CC0) dressing for the Grimoire Tower lands.
// Layout follows real landscapes: groves instead of even scatter, bushes on forest edges,
// flowers in open meadows, rock outcrops on slopes, and stone trails toward the four kingdoms.
// Procedural method: seeded noise density fields (forest, meadow, outcrop, slope) feed stratified
// jittered-grid sampling per layer, so props keep natural spacing without a Poisson pass.
// Every placement comes from world position + seed, so chunk edges match and reset is identical.
const DIR = encodeURI('assets/Stylized Nature MegaKit[Standard]/glTF/');
const FAR = 170;  // trees and rocks are drawn this far from the player
const NEAR = 75;  // small props only this far
const CALM = 0.06;

const range = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}_${i + 1}`);
const MODELS = [
  ...range('CommonTree', 5), ...range('Pine', 5), ...range('TwistedTree', 5),
  'Bush_Common', 'Bush_Common_Flowers', ...range('Rock_Medium', 3),
  'Flower_3_Group', 'Flower_4_Group', 'Flower_3_Single', 'Flower_4_Single',
  'Plant_1', 'Clover_1', 'Clover_2', 'Mushroom_Common',
  ...range('Pebble_Round', 5), ...range('Pebble_Square', 6),
  ...range('RockPath_Round_Small', 3), ...range('RockPath_Square_Small', 3)
];
const SHADOW = /Tree|Pine|Rock_Medium/;
// The sun's shadow map only covers ±90 m around the player, yet trees are drawn to FAR (170 m). Only the
// nearest instances cast: a shadow-only twin (same geometry, material and instance buffer, nearest-first
// order) is drawn on a layer only the shadow camera sees, with count = instances within SHADOW_NEAR.
const SHADOW_NEAR = 75;
const SHADOW_LAYER = 1;
const CELL = 128; // metres per tree/rock square (2×2 terrain chunks)
const ALIGNED = /Rock|Pebble/; // stones lie flush on the surface normal; plants grow straight up
const DRESSED = new Set(['hub', 'trees']); // Grimoire Tower + Clover Kingdom

// Four trails leave the plaza toward N, E, S, W and meander more the further they go. Shared with the
// kingdom gates, which stand where each trail crosses into its kingdom.
export const ROADS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function trailOffset(noise, along, i) {
  const t = Math.max(0, Math.min(1, (along - 20) / 60)); // smoothstep(along, 20, 80); no THREE so world.js can use it headless
  return (noise(along * 0.008 + i * 37, i * 11) - 0.5) * 30 * t * t * (3 - 2 * t);
}
// World position of trail i at `along` metres from the centre.
export function trailPoint(noise, i, along) {
  const [dx, dz] = ROADS[i], side = trailOffset(noise, along, i);
  return { x: dx * along - dz * side, z: dz * along + dx * side };
}

// Chaos response: heightfield analysis
// Central differences give the gradient (slope) and the 5-point Laplacian (curvature) of the
// terrain under a prop. "Strain" measures how far chaos has deformed the ground there compared
// with the calm shape: change in gradient (the ground tilted) plus loss of curvature (it folded
// into a ridge or peak tip). Thresholds come from sampling the warped terrain offline: at full
// chaos the median hill prop sees strain ~1.0, the top quarter above 1.6.
const PROBE = 1.5;
const STRAIN_START = 1.0, STRAIN_GONE = 1.8;
function analyse(height, x, z) {
  const h = height(x, z);
  const east = height(x + PROBE, z), west = height(x - PROBE, z);
  const south = height(x, z + PROBE), north = height(x, z - PROBE);
  return { h, gx: (east - west) / (2 * PROBE), gz: (south - north) / (2 * PROBE),
    laplacian: (east + west + south + north - 4 * h) / (PROBE * PROBE) };
}

// Chaos response: GPU dissolve
// Each instance carries a dissolve amount (0 = whole, 1 = gone). The vertex shader sinks the prop
// into the ground; the fragment shader discards pixels where 3D value noise falls below the amount
// and paints a glowing ember rim just above it. Patched into the stock material with onBeforeCompile.
const DISSOLVE_ATTRIBUTE = 'instanceDissolve';
const SINK_DEPTH = 1.2; // model units at full dissolve
function addDissolve(material) {
  if (material.userData.dissolve) return;
  material.userData.dissolve = true;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float ${DISSOLVE_ATTRIBUTE};
varying float vDissolve;
varying vec3 vDissolvePos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vDissolve = ${DISSOLVE_ATTRIBUTE};
vDissolvePos = position;
transformed.y -= ${SINK_DEPTH.toFixed(2)} * ${DISSOLVE_ATTRIBUTE} * ${DISSOLVE_ATTRIBUTE};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vDissolve;
varying vec3 vDissolvePos;
float dissolveHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dissolveNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dissolveHash(i), dissolveHash(i + vec3(1, 0, 0)), f.x),
                 mix(dissolveHash(i + vec3(0, 1, 0)), dissolveHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(dissolveHash(i + vec3(0, 0, 1)), dissolveHash(i + vec3(1, 0, 1)), f.x),
                 mix(dissolveHash(i + vec3(0, 1, 1)), dissolveHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (vDissolve > 0.001) {
  float n = 0.65 * dissolveNoise(vDissolvePos * 3.0) + 0.35 * dissolveNoise(vDissolvePos * 7.0);
  if (n < vDissolve) discard;
  totalEmissiveRadiance += vec3(1.0, 0.35, 0.08) * 2.5 * (1.0 - smoothstep(0.0, 0.07, n - vDissolve));
}`);
  };
  material.needsUpdate = true;
}

export function createProps({ scene, world, blockers, onReady }) {
  const { hash, noise, heightAt, biomeAt, terrainHeight, chunks } = world;
  const smooth = THREE.MathUtils.smoothstep;
  // Trees and rocks are split into one instanced mesh per CELL-sized square, so whole squares behind the
  // camera (or outside the sun's shadow box) are frustum-culled. Small props stay one mesh per model.
  const templates = {}; // model name -> [{ geometry, material, shadow, reach }] from the glTF
  const groups = new Map(); // group key -> { name, parts: [{ mesh, shadow, capacity }] }
  const idle = {}; // model name -> groups no longer in range, reused before making new ones
  const heights = {}; // model name -> top of the model above its origin, at scale 1
  const root = new THREE.Group();
  scene.add(root);
  let ready = false;
  let builtKey = '';
  let builtAt = 0;
  let rebuilding = null;
  let rebuildingName = null, wantedKey = '';
  const preparation = createFrameQueue();

  // Landscape fields (all 0..1)
  const forest = (x, z) => smooth(noise(x * 0.011 + 13, z * 0.011 - 7), 0.5, 0.66);
  const pines = (x, z) => noise(x * 0.02 + 90, z * 0.02) > 0.55;
  const outcrop = (x, z) => smooth(noise(x * 0.03 + 50, z * 0.03 + 50), 0.6, 0.75);
  const meadow = (x, z) => (1 - forest(x, z)) * smooth(noise(x * 0.05 + 200, z * 0.05), 0.6, 0.72);
  const slope = (x, z) => {
    const y = heightAt(x, z, CALM); // calm shape, so placement never depends on the current score
    return Math.hypot(heightAt(x + 1, z, CALM) - y, heightAt(x, z + 1, CALM) - y);
  };

  const roadOffset = (along, i) => trailOffset(noise, along, i);
  function roadDistance(x, z) {
    let best = Infinity;
    ROADS.forEach(([dx, dz], i) => {
      const along = x * dx + z * dz;
      if (along < 14) return;
      best = Math.min(best, Math.abs(x * -dz + z * dx - roadOffset(along, i)));
    });
    return Math.min(best, Math.abs(Math.hypot(x, z) - 16)); // plaza ring
  }

  // Placement layers
  // chance(x, z) is the probability that a jittered grid cell gets a prop.
  const pick = (list, x, z) => list[Math.floor(hash(x * 3.1, z * 1.7) * list.length)];
  const LAYERS = [
    { cell: 9, far: true, clear: 5, collide: 0.35, scale: [1.1, 1.7], sink: 0.15,
      chance: (x, z) => slope(x, z) > 0.6 ? 0 : 0.03 + 0.72 * forest(x, z),
      model: (x, z) => pick(range(pines(x, z) ? 'Pine' : 'CommonTree', 5), x, z) },
    { cell: 60, far: true, clear: 10, collide: 0.9, scale: [0.9, 1.2], sink: 0.2, // rare landmark trees
      chance: (x, z) => forest(x, z) < 0.2 ? 0.25 : 0,
      model: (x, z) => pick(range('TwistedTree', 5), x, z) },
    { cell: 12, far: true, clear: 4, collide: 1.1, jumpable: true, scale: [0.5, 1.6], sink: 0.45,
      chance: (x, z) => 0.02 + 0.45 * outcrop(x, z) + Math.min(0.2, slope(x, z) * 0.4),
      model: (x, z) => pick(range('Rock_Medium', 3), x, z) },
    { cell: 6, clear: 3, scale: [0.8, 1.3], sink: 0.1,
      chance: (x, z) => { const f = forest(x, z); return 0.03 + 2 * f * (1 - f); }, // forest edges
      model: (x, z) => pick(['Bush_Common', 'Bush_Common', 'Bush_Common_Flowers'], x, z) },
    { cell: 3, clear: 2, scale: [0.3, 0.45], sink: 0.05,
      chance: (x, z) => 0.4 * meadow(x, z),
      model: (x, z) => pick(['Flower_3_Group', 'Flower_4_Group', 'Flower_3_Single', 'Flower_4_Single'], x, z) },
    { cell: 4, clear: 2, scale: [0.5, 0.9], sink: 0.05,
      chance: (x, z) => forest(x, z) > 0.5 ? 0.18 : 0,
      model: (x, z) => pick(['Plant_1', 'Plant_1', 'Clover_1', 'Clover_2', 'Mushroom_Common'], x, z) },
    { cell: 7, clear: 0, scale: [0.8, 1.6], sink: 0.03,
      chance: (x, z) => roadDistance(x, z) < 3.5 ? 0.35 : 0.05,
      model: (x, z) => pick([...range('Pebble_Round', 5), ...range('Pebble_Square', 6)], x, z) }
  ];

  function blocked(x, z, clear) {
    if (world.isPathArea?.(x, z)) return true;
    if (world.isLandmarkArea?.(x, z)) return true;
    if (Math.hypot(x, z) < 22 || !DRESSED.has(biomeAt(x, z).kind)) return true;
    if (clear && roadDistance(x, z) < clear) return true;
    return blockers().some(b => Math.hypot(b.x - x, b.z - z) < 8);
  }

  // Called for every new chunk: works out its props and colliders (models may still be loading).
  function decorate(chunk) {
    const size = 64;
    const minX = chunk.position.x - size / 2, minZ = chunk.position.z - size / 2;
    const list = [];
    LAYERS.forEach((layer, li) => {
      const { cell } = layer;
      for (let i = Math.floor(minX / cell); i <= Math.floor((minX + size) / cell); i++) {
        for (let j = Math.floor(minZ / cell); j <= Math.floor((minZ + size) / cell); j++) {
          const x = (i + hash(i * 1.3 + li, j)) * cell;
          const z = (j + hash(i, j * 1.7 + li)) * cell;
          // Each jittered point belongs to exactly one chunk, so neighbours never double up.
          if (x < minX || x >= minX + size || z < minZ || z >= minZ + size) continue;
          if (hash(x + li * 17, z) > layer.chance(x, z) || blocked(x, z, layer.clear)) continue;
          const scale = THREE.MathUtils.lerp(layer.scale[0], layer.scale[1], hash(z, x));
          const prop = { model: layer.model(x, z), x, z, scale, sink: layer.sink * scale,
            rot: hash(x * 0.7, z * 0.3) * Math.PI * 2, far: Boolean(layer.far) };
          list.push(prop);
          if (layer.collide) {
            const { model, sink } = prop;
            // Rocks report their height once the model loads, so a high enough jump clears them.
            // The prop keeps a reference so a dissolved prop stops blocking (collider.off).
            prop.collider = { x, z, radius: layer.collide * scale,
              height: layer.jumpable ? () => heights[model] === undefined ? undefined : heights[model] * scale - sink : undefined };
            chunk.userData.colliders.push(prop.collider);
          }
        }
      }
    });
    // Legacy kingdom roads start outside the new plaza approaches. The plaza
    // owns nearby paths, so its route must not acquire parallel stone trails.
    const stone = (x, z) => {
      if (Math.hypot(x, z) < 30 || world.isPathArea?.(x, z)) return;
      if (world.isLandmarkArea?.(x, z)) return;
      if (x < minX || x >= minX + size || z < minZ || z >= minZ + size || biomeAt(x, z).kind !== 'hub') return;
      list.push({ model: pick([...range('RockPath_Round_Small', 3), ...range('RockPath_Square_Small', 3)], x, z),
        x, z, scale: 0.9 + hash(x, z) * 0.3, sink: 0.04, rot: hash(z, x) * Math.PI * 2, far: false });
    };
    ROADS.forEach(([dx, dz], i) => {
      for (let along = 18; along < 400; along += 1.7) {
        const side = roadOffset(along, i) + (hash(along, i) - 0.5) * 1.2;
        stone(dx * along - dz * side, dz * along + dx * side);
      }
    });
    chunk.userData.props = list;
  }

  // Shared instanced meshes, rebuilt when the player moves or the terrain reshapes
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0), normal = new THREE.Vector3();
  const tiltQuat = new THREE.Quaternion(), yawQuat = new THREE.Quaternion();
  const calmHeight = (x, z) => heightAt(x, z, CALM);
  function setDissolveCapacity(part) {
    part.mesh.geometry.setAttribute(DISSOLVE_ATTRIBUTE, new THREE.InstancedBufferAttribute(new Float32Array(part.capacity), 1));
  }
  // A geometry that shares the template's GPU buffers but has its own dissolve attribute and bounds.
  function view(source) {
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(source.index);
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    for (const group of source.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    return geometry;
  }
  function instanced(geometry, material, capacity, culled) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.castShadow = false; // shadows come from the near-only twin
    mesh.receiveShadow = true;
    mesh.frustumCulled = culled; // per-square bounds; global small-prop meshes span the whole view
    return mesh;
  }
  function acquire(name, culled) {
    const reused = idle[name]?.pop();
    if (reused) return reused;
    return { name, parts: templates[name].map(t => {
      const part = { mesh: instanced(view(t.geometry), t.material, 16, culled), capacity: 16 };
      setDissolveCapacity(part);
      root.add(part.mesh);
      onReady?.(part.mesh); // atmosphere.prepare: swap in the environment-lit material, as for the rest of root
      if (t.shadow) part.shadow = shadowTwin(part.mesh);
      return part;
    }) };
  }
  function ensure(part, count) {
    if (count <= part.capacity) return;
    part.capacity = Math.max(count, part.capacity * 2);
    const old = part.mesh;
    part.mesh = instanced(old.geometry, old.material, part.capacity, old.frustumCulled);
    setDissolveCapacity(part);
    root.remove(old);
    old.dispose?.();
    root.add(part.mesh);
    if (part.shadow) { root.remove(part.shadow); part.shadow = shadowTwin(part.mesh); }
  }
  function shadowTwin(mesh) {
    const twin = new THREE.InstancedMesh(mesh.geometry, mesh.material, 1);
    twin.instanceMatrix = mesh.instanceMatrix; // shared: dissolve and rebuild writes reach both
    twin.count = 0;
    twin.castShadow = true;
    twin.frustumCulled = mesh.frustumCulled; // same bounds, tested against the shadow camera
    twin.layers.set(SHADOW_LAYER);
    root.add(twin);
    return twin;
  }
  const groupKey = p => p.far ? `${p.model}|${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}` : p.model;
  const box = new THREE.Box3();

  // Strain-driven target per prop: 0 on calm ground, 1 where chaos folded the ground under it.
  // Re-measured only when the terrain has reshaped since this prop was last analysed.
  function chaosResponse(p) {
    if (p.version === world.terrainVersion) return p.ground;
    p.version = world.terrainVersion;
    p.calm ||= analyse(calmHeight, p.x, p.z); // calm shape never changes, so measure it once
    const now = p.ground = analyse(terrainHeight, p.x, p.z);
    const tilt = Math.hypot(now.gx - p.calm.gx, now.gz - p.calm.gz);
    const fold = Math.max(0, p.calm.laplacian - now.laplacian);
    p.target = THREE.MathUtils.smoothstep(tilt + 0.5 * fold, STRAIN_START, STRAIN_GONE);
    p.dissolve ??= p.target; // first sight: no fade-in from zero
    if (p.collider) p.collider.off = p.target > 0.5;
    return now;
  }

  let shown = {}; // group key -> props currently drawn, in instance order
  function* rebuild(position) {
    const buckets = new Map();
    for (const chunk of chunks.values()) {
      for (const p of chunk.userData.props || []) {
        if (!templates[p.model] || Math.hypot(p.x - position.x, p.z - position.z) > (p.far ? FAR : NEAR)) continue;
        const key = groupKey(p);
        (buckets.get(key) || buckets.set(key, []).get(key)).push(p);
      }
      yield;
    }
    for (const [key, list] of buckets) {
      rebuildingName = key;
      const name = list[0].model;
      if (!groups.has(key)) groups.set(key, acquire(name, list[0].far));
      const group = groups.get(key);
      const away = q => Math.hypot(q.x - position.x, q.z - position.z);
      list.sort((a, b) => away(a) - away(b)); // nearest first, so the shadow twin draws a prefix
      let near = 0;
      while (near < list.length && away(list[near]) <= SHADOW_NEAR) near++;
      const aligned = ALIGNED.test(name);
      box.makeEmpty();
      let maxScale = 0;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const ground = chaosResponse(p);
        // Stones: rotate +Y onto the surface normal (-gx, 1, -gz), then spin about it.
        yawQuat.setFromAxisAngle(up, p.rot);
        if (aligned) dummy.quaternion.copy(tiltQuat.setFromUnitVectors(up, normal.set(-ground.gx, 1, -ground.gz).normalize())).multiply(yawQuat);
        else dummy.quaternion.copy(yawQuat);
        dummy.position.set(p.x, ground.h - p.sink, p.z);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        p.matrix = (p.matrix || new THREE.Matrix4()).copy(dummy.matrix);
        box.expandByPoint(dummy.position);
        maxScale = Math.max(maxScale, p.scale);
        if (i % 16 === 15) yield;
      }
      group.parts.forEach((part, t) => {
        ensure(part, list.length);
        for (let k = 0; k < list.length; k++) part.mesh.setMatrixAt(k, list[k].matrix);
        part.mesh.count = list.length;
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.shadow) part.shadow.count = near;
        // Bounds of the whole square: instance positions plus the model's own reach at the largest scale.
        box.getBoundingSphere(part.mesh.geometry.boundingSphere).radius += templates[name][t].reach * maxScale;
      });
      shown[key] = list;
      for (const p of list) p.hidden = false;
      writeDissolve(0, [[key, list]]);
      rebuildingName = null;
      yield;
    }
    // Squares out of range go back to the pool (only now, so nothing blinks out mid-rebuild).
    for (const [key, group] of groups) {
      if (buckets.has(key)) continue;
      for (const part of group.parts) { part.mesh.count = 0; if (part.shadow) part.shadow.count = 0; }
      groups.delete(key);
      delete shown[key];
      (idle[group.name] ||= []).push(group);
    }
  }

  // Ease each prop toward its target every frame (rebuilds are throttled) and upload to the GPU.
  // The shadow pass does not run the dissolve shader, so a fully dissolved prop is also scaled to
  // zero; otherwise its shadow would stay behind.
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  function writeDissolve(ease, entries = Object.entries(shown)) {
    for (const [name, list] of entries) {
      if (ease > 0 && name === rebuildingName) continue;
      const group = groups.get(name); // name is a group key here
      if (!group) continue;
      // Settled models need no upload (ease 0 means a rebuild just reordered instances).
      if (ease > 0 && list.every(p => Math.abs(p.target - p.dissolve) < 1e-4)) continue;
      for (const p of list) p.dissolve += (p.target - p.dissolve) * ease;
      for (const part of group.parts) {
        const attribute = part.mesh.geometry.getAttribute(DISSOLVE_ATTRIBUTE);
        let matricesChanged = false;
        list.forEach((p, k) => {
          attribute.array[k] = p.dissolve;
          const hide = p.dissolve > 0.98;
          if (hide === Boolean(p.hidden)) return;
          part.mesh.setMatrixAt(k, hide ? hiddenMatrix : p.matrix);
          matricesChanged = true;
        });
        attribute.needsUpdate = true;
        if (matricesChanged) part.mesh.instanceMatrix.needsUpdate = true;
      }
      for (const p of list) p.hidden = p.dissolve > 0.98;
    }
  }

  // Limit concurrent parses and install one mesh per frame. Cached downloads
  // must not turn into dozens of installation callbacks in the same frame.
  const remaining = [...MODELS];
  async function loadNext() {
    while (remaining.length) {
      const name = remaining.shift();
      try {
        const gltf = await loadModelAsset(`${DIR}${name}.gltf`);
        gltf.scene.updateMatrixWorld(true);
        heights[name] = new THREE.Box3().setFromObject(gltf.scene).max.y;
        const meshes = [];
        gltf.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
        const list = [];
        for (const object of meshes) await new Promise((resolve, reject) => preparation.push(() => {
          try {
            const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
            geometry.computeBoundingSphere();
            (Array.isArray(object.material) ? object.material : [object.material]).forEach(addDissolve);
            list.push({ geometry, material: object.material, shadow: SHADOW.test(name),
              reach: geometry.boundingSphere.center.length() + geometry.boundingSphere.radius });
            resolve();
          } catch (error) { reject(error); }
        }));
        templates[name] = list;
      } catch (error) { console.warn(`Prop ${name} could not load.`, error); }
    }
  }
  Promise.all(Array.from({ length: 3 }, loadNext))
    .then(() => {
      scene.traverse(light => { if (light.isLight && light.castShadow) light.shadow.camera.layers.enable(SHADOW_LAYER); });
      ready = true; builtKey = ''; onReady?.(root);
    });

  let lastFrame = performance.now();
  return {
    decorate,
    get prepared() { return ready && !rebuilding && builtKey !== '' && builtKey === wantedKey; },
    update(position, terrainVersion) {
      preparation.run();
      if (!ready) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      // ponytail: props lag terrain reshapes by up to 0.2 s; reseat per frame if it shows during chaos.
      const key = `${Math.round(position.x / 8)},${Math.round(position.z / 8)},${terrainVersion},${world.formed},${chunks.size}`;
      wantedKey = key;
      if (!rebuilding && key !== builtKey && now - builtAt >= 200) {
        builtKey = key;
        builtAt = now;
        rebuilding = rebuild({ x: position.x, z: position.z });
      }
      const deadline = performance.now() + 3;
      while (rebuilding) {
        if (rebuilding.next().done) { rebuilding = null; break; }
        if (performance.now() >= deadline) break;
      }
      writeDissolve(1 - Math.exp(-2.5 * dt)); // ~1 s to dissolve or regrow
    }
  };
}
