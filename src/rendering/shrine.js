import { SHRINE } from '../models/quest.js';
import { loadModel, makeGlow } from './models.js';

const CALM_COLOR = new THREE.Color(0x7fe8ff);
const CHAOS_COLOR = new THREE.Color(0xff5a2a);
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
  root.position.set(SHRINE.x, terrainHeight(SHRINE.x, SHRINE.z) - 0.2, SHRINE.z);
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

  // Ember parkour: basalt shards the curse tore up, chaos-only. Each cap is extruded from the same outline that
  // drives its collision (models/quest.js); molten veins run to its corners and an ember rune marks the landing.
  const basalt = new THREE.MeshStandardMaterial({ color: 0x2b201e, roughness: .92, metalness: .05, emissive: 0x3a0c04, emissiveIntensity: .35, flatShading: true });
  const scorched = new THREE.MeshStandardMaterial({ color: 0x1a1312, roughness: .96, flatShading: true });
  const molten = new THREE.MeshBasicMaterial({ color: 0xff6a1f, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  const veinMat = new THREE.LineBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: .85 });
  const rimMat = new THREE.LineBasicMaterial({ color: 0xc8461a, transparent: true, opacity: .5 });
  const course = new THREE.Group();
  course.name = 'Ember parkour · cursed basalt shards';
  course.visible = false;
  scene.add(course);
  const runeGeo = new THREE.TorusGeometry(.5, .04, 4, 24), dripGeo = new THREE.IcosahedronGeometry(.13, 0);
  const shards = quest.platforms.map((p, i) => {
    const shard = new THREE.Group();
    shard.position.set(p.x, p.top, p.z);
    const shape = new THREE.Shape();
    p.outline.forEach(([x, z], k) => k ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    const cap = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .5, bevelEnabled: false }).rotateX(-Math.PI / 2), basalt);
    cap.position.y = -.5;                           // top face exactly at the walkable height
    cap.castShadow = cap.receiveShadow = true;
    const radius = p.outline.reduce((sum, [x, z]) => sum + Math.hypot(x, z), 0) / p.outline.length;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(radius * .85, 2.2 + (i % 3) * .5, 7), scorched);
    spike.rotation.set(Math.PI, i * .9, 0);          // point down, each turned differently
    spike.position.y = -.5 - spike.geometry.parameters.height / 2;
    const drip = new THREE.Mesh(dripGeo, molten);
    drip.position.y = -.5 - spike.geometry.parameters.height - .1;
    const veins = [], rim = [];
    p.outline.forEach(([x, z], k) => {
      const [nx, nz] = p.outline[(k + 1) % p.outline.length];
      rim.push(new THREE.Vector3(x, .012, z), new THREE.Vector3(nx, .012, nz));
      if (k % 2 === 0) veins.push(new THREE.Vector3(x * .22, .015, z * .22), new THREE.Vector3(x * .92, .015, z * .92));
    });
    const rune = new THREE.Mesh(runeGeo, molten);
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = .02;
    shard.add(cap, spike, drip, rune,
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(veins), veinMat),
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rim), rimMat));
    course.add(shard);
    return { shard, top: p.top };
  });
  let reveal = 0;

  return {
    root,
    colliders,
    get crystalWorldPosition() {
      root.updateMatrixWorld(true);
      return crystal.getWorldPosition(new THREE.Vector3());
    },
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

      // Chaos raises the shards one after another up the spiral; calm lets them sink away. Collision follows
      // quest.courseActive at once, so a shard is solid from the first frame it starts to rise.
      reveal = THREE.MathUtils.clamp(reveal + (quest.courseActive ? dt : -dt) * 1.6, 0, 1 + shards.length * .08);
      course.visible = reveal > 0;
      if (!course.visible) return;
      shards.forEach(({ shard, top }, i) => {
        const t = THREE.MathUtils.smootherstep(reveal - i * .08, 0, 1);
        shard.position.y = top - (1 - t) * 4 + Math.sin(elapsed * .8 + i) * .04 * t;   // a faint hover once risen
        shard.scale.setScalar(.35 + .65 * t);
        shard.visible = t > .01;
      });
      const pulse = .75 + Math.sin(elapsed * 2.4) * .15;
      molten.opacity = .9 * pulse;
      veinMat.opacity = .85 * pulse;
      basalt.emissiveIntensity = .3 + .15 * pulse;
    }
  };
}
