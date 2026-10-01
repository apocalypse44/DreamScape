import { SHRINE, SLAB_SIZE } from '../models/quest.js';
import { loadModel, makeGlow } from './models.js';

const CALM_COLOR = new THREE.Color(0x7fe8ff);
const CHAOS_COLOR = new THREE.Color(0xff5a2a);
const EMBER_COLOR = 0xff6a1f;
const TOWER_HEIGHT = 10;

function createBeam(height, radius, color, opacity) {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false // stays visible through fog from any biome
    })
  );
  beam.position.y = height / 2;
  return beam;
}

// The shrine tower, its floating crystal and beam, and the ember pickups it asks for.
export function createShrine({ scene, terrainHeight, quest }) {
  const root = new THREE.Group();
  const crystal = new THREE.Group();
  const light = new THREE.PointLight(CALM_COLOR, 2, 35);
  const beam = createBeam(160, 0.35, CALM_COLOR, 0.22);
  const color = CALM_COLOR.clone();
  const colliders = [];
  let crystalMaterials = [];
  crystal.add(light, beam);
  root.add(crystal);
  scene.add(root);

  loadModel('assets/shrine/WatchTower.glb', TOWER_HEIGHT).then(({ object, size }) => {
    root.add(object);
    colliders.push({ x: SHRINE.x, z: SHRINE.z, radius: Math.max(size.x, size.z) * 0.45 });
  }).catch(error => console.warn('Shrine model could not load.', error));

  loadModel('assets/crystals/BigCrystal.glb', 1.8).then(({ object }) => {
    crystalMaterials = makeGlow(object, CALM_COLOR, 0.8);
    crystal.add(object);
  }).catch(error => console.warn('Shrine crystal could not load.', error));

  // Each ember gets a gem and a short beam so it can be spotted from a distance.
  const embers = quest.embers.map(() => {
    const group = new THREE.Group();
    group.add(createBeam(30, 0.12, EMBER_COLOR, 0.35));
    group.visible = false;
    scene.add(group);
    return group;
  });
  loadModel('assets/crystals/GemPink.glb', 0.9).then(({ object }) => {
    makeGlow(object, EMBER_COLOR, 1.4);
    embers.forEach(group => group.add(object.clone()));
  }).catch(error => {
    console.warn('Ember gem could not load; using plain shapes.', error);
    const fallback = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: EMBER_COLOR }));
    embers.forEach(group => group.add(fallback.clone()));
  });

  // Floating parkour slabs leading up to the raised ember.
  const slabGeo = new THREE.BoxGeometry(SLAB_SIZE, 0.6, SLAB_SIZE);
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x3a2622, emissive: 0x5d1a08, roughness: 0.8 });
  for (const { x, z, top } of quest.platforms) {
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(x, top - 0.3, z);
    slab.castShadow = slab.receiveShadow = true;
    scene.add(slab);
  }

  return {
    colliders,
    update(dt, elapsed) {
      root.position.set(SHRINE.x, terrainHeight(SHRINE.x, SHRINE.z) - 0.2, SHRINE.z);
      color.lerp(quest.wantsChaos() ? CHAOS_COLOR : CALM_COLOR, 1 - Math.exp(-3 * dt));
      // The crystal pulses while the shrine is speaking, and dims when it is drowned out.
      const glow = !quest.nearShrine ? 0.8 : quest.drowned ? 0.3 : 1.4 + Math.sin(elapsed * 5) * 0.5;
      crystal.position.y = TOWER_HEIGHT + 1.6 + Math.sin(elapsed * 1.2) * 0.3;
      crystal.rotation.y = elapsed * 0.5;
      light.color.copy(color);
      light.intensity = glow * 2;
      beam.material.color.copy(color);
      for (const material of crystalMaterials) {
        material.emissive.copy(color);
        material.emissiveIntensity = glow;
      }

      const showEmbers = quest.stage === 'cursed';
      quest.embers.forEach((ember, i) => {
        const group = embers[i];
        group.visible = showEmbers && !ember.taken;
        group.position.set(ember.x, ember.y + Math.sin(elapsed * 2 + i) * 0.15, ember.z);
        group.rotation.y = elapsed * 1.5 + i;
      });
    }
  };
}
