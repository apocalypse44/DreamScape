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

export function createProps({ scene, world, blockers, onReady }) {
  const { hash, noise, heightAt, biomeAt, terrainHeight, chunks } = world;
  const smooth = THREE.MathUtils.smoothstep;
  const parts = {}; // model name -> [{ mesh, capacity }]
  const root = new THREE.Group();
  scene.add(root);
  let ready = false;
  let builtKey = '';
  let builtAt = 0;

  // --- Landscape fields (all 0..1) -------------------------------------------------
  const forest = (x, z) => smooth(noise(x * 0.011 + 13, z * 0.011 - 7), 0.5, 0.66);
  const pines = (x, z) => noise(x * 0.02 + 90, z * 0.02) > 0.55;
  const outcrop = (x, z) => smooth(noise(x * 0.03 + 50, z * 0.03 + 50), 0.6, 0.75);
  const meadow = (x, z) => (1 - forest(x, z)) * smooth(noise(x * 0.05 + 200, z * 0.05), 0.6, 0.72);
  const slope = (x, z) => {
    const y = heightAt(x, z, CALM); // calm shape, so placement never depends on the current score
    return Math.hypot(heightAt(x + 1, z, CALM) - y, heightAt(x, z + 1, CALM) - y);
  };

  // Four trails leave the plaza toward N, E, S, W and meander more the further they go.
  const ROADS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const roadOffset = (along, i) => (noise(along * 0.008 + i * 37, i * 11) - 0.5) * 30 * smooth(along, 20, 80);
  function roadDistance(x, z) {
    let best = Infinity;
    ROADS.forEach(([dx, dz], i) => {
      const along = x * dx + z * dz;
      if (along < 14) return;
      best = Math.min(best, Math.abs(x * -dz + z * dx - roadOffset(along, i)));
    });
    return Math.min(best, Math.abs(Math.hypot(x, z) - 16)); // plaza ring
  }

  // --- Placement layers ---------------------------------------------------------------
  // chance(x, z) is the probability that a jittered grid cell gets a prop.
  const pick = (list, x, z) => list[Math.floor(hash(x * 3.1, z * 1.7) * list.length)];
  const LAYERS = [
    { cell: 9, far: true, clear: 5, collide: 0.35, scale: [1.1, 1.7], sink: 0.15,
      chance: (x, z) => slope(x, z) > 0.6 ? 0 : 0.03 + 0.72 * forest(x, z),
      model: (x, z) => pick(range(pines(x, z) ? 'Pine' : 'CommonTree', 5), x, z) },
    { cell: 60, far: true, clear: 10, collide: 0.9, scale: [0.9, 1.2], sink: 0.2, // rare landmark trees
      chance: (x, z) => forest(x, z) < 0.2 ? 0.25 : 0,
      model: (x, z) => pick(range('TwistedTree', 5), x, z) },
    { cell: 12, far: true, clear: 4, collide: 1.1, scale: [0.5, 1.6], sink: 0.45,
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
    if (Math.hypot(x, z) < 22 || biomeAt(x, z).kind !== 'hub') return true;
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
          list.push({ model: layer.model(x, z), x, z, scale, sink: layer.sink * scale,
            rot: hash(x * 0.7, z * 0.3) * Math.PI * 2, far: Boolean(layer.far) });
          if (layer.collide) chunk.userData.colliders.push({ x, z, radius: layer.collide * scale });
        }
      }
    });
    // Trail stones: small flat stones every ~1.7 m along each road and the plaza ring.
    const stone = (x, z) => {
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
    for (let a = 0; a < Math.PI * 2; a += 1.7 / 16) stone(Math.cos(a) * 16, Math.sin(a) * 16);
    chunk.userData.props = list;
  }

  // --- Shared instanced meshes, rebuilt when the player moves or the terrain reshapes ---
  const dummy = new THREE.Object3D();
  function ensure(part, count) {
    if (count <= part.capacity) return;
    part.capacity = Math.max(count, part.capacity * 2);
    const old = part.mesh;
    part.mesh = new THREE.InstancedMesh(old.geometry, old.material, part.capacity);
    part.mesh.castShadow = old.castShadow;
    part.mesh.receiveShadow = true;
    part.mesh.frustumCulled = false; // instances span the whole view
    root.remove(old);
    old.dispose?.();
    root.add(part.mesh);
  }

  function rebuild(position) {
    const buckets = {};
    for (const chunk of chunks.values()) {
      for (const p of chunk.userData.props || []) {
        if (Math.hypot(p.x - position.x, p.z - position.z) > (p.far ? FAR : NEAR)) continue;
        (buckets[p.model] ||= []).push(p);
      }
    }
    for (const [name, modelParts] of Object.entries(parts)) {
      const list = buckets[name] || [];
      for (const part of modelParts) {
        ensure(part, list.length);
        list.forEach((p, k) => {
          dummy.position.set(p.x, terrainHeight(p.x, p.z) - p.sink, p.z);
          dummy.rotation.set(0, p.rot, 0);
          dummy.scale.setScalar(p.scale);
          dummy.updateMatrix();
          part.mesh.setMatrixAt(k, dummy.matrix);
        });
        part.mesh.count = list.length;
        part.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // Load every model once; each mesh inside it becomes one instanced part.
  const loader = new THREE.GLTFLoader();
  Promise.all(MODELS.map(name => new Promise(resolve => loader.load(`${DIR}${name}.gltf`, gltf => {
    gltf.scene.updateMatrixWorld(true);
    parts[name] = [];
    gltf.scene.traverse(object => {
      if (!object.isMesh) return;
      const mesh = new THREE.InstancedMesh(object.geometry.clone().applyMatrix4(object.matrixWorld), object.material, 16);
      mesh.count = 0;
      mesh.castShadow = SHADOW.test(name);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      root.add(mesh);
      parts[name].push({ mesh, capacity: 16 });
    });
    resolve();
  }, undefined, error => { console.warn(`Prop ${name} could not load.`, error); resolve(); }))))
    .then(() => { ready = true; builtKey = ''; onReady?.(root); });

  return {
    decorate,
    update(position, terrainVersion) {
      if (!ready) return;
      // ponytail: props lag terrain reshapes by up to 0.2 s; reseat per frame if it shows during chaos.
      const key = `${Math.round(position.x / 8)},${Math.round(position.z / 8)},${terrainVersion},${world.formed},${chunks.size}`;
      const now = performance.now();
      if (key === builtKey || now - builtAt < 200) return;
      builtKey = key;
      builtAt = now;
      rebuild(position);
    }
  };
}
