// Heart's air: rose petals drifting and tumbling around the player (the Nature kit's Petal model, instanced),
// thicker the deeper you are in Heart; chaos blows them sideways and faster. Once the current is restored,
// soft teal fireflies glow low over the ground at dusk as well. Both follow the player in a wrapping box,
// so a few hundred are enough to fill the view.
import { loadModelAsset } from './models.js';
import { createSoftDot } from './waterfall.js';
import { heartClimateAt } from '../models/climate.js';

const PETAL = encodeURI('assets/Stylized Nature MegaKit[Standard]/glTF/Petal_2.gltf');
const COUNT = 420, BOX = 46, LOW = -3, HIGH = 20; // petals: box width (m) and height span around the player
const FIREFLIES = 110, FLY_BOX = 30;

export function createHeartPetals({ scene }) {
  const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const petals = Array.from({ length: COUNT }, () => ({
    x: (rand() - 0.5) * BOX, y: LOW + rand() * (HIGH - LOW), z: (rand() - 0.5) * BOX,
    fall: 0.5 + rand() * 0.7, sway: 0.3 + rand() * 0.6, phase: rand() * 6.28,
    spin: 0.6 + rand() * 1.8, size: 0.7 + rand() * 0.6,
  }));
  let mesh = null;
  loadModelAsset(PETAL).then(gltf => {
    let source = null;
    gltf.scene.traverse(o => { if (o.isMesh && !source) source = o; });
    if (!source) return;
    const geometry = source.geometry.clone();
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    geometry.scale(...[0.16 / Math.max(size.x, size.z), 0.16 / Math.max(size.x, size.z), 0.16 / Math.max(size.x, size.z)]);
    const material = source.material.clone();
    material.side = THREE.DoubleSide;
    material.color.set(0xffc2d2); // rose, whatever colour the atlas gives this petal
    mesh = new THREE.InstancedMesh(geometry, material, COUNT);
    mesh.name = 'Heart · petals';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; // instances wrap around the player; the base bounds mean nothing
    mesh.count = 0;
    scene.add(mesh);
  }).catch(error => console.warn('Heart petals unavailable', error));

  // Fireflies: round, glowing, additive; only once Heart is restored.
  const flyPositions = new Float32Array(FIREFLIES * 3), flySeeds = Array.from({ length: FIREFLIES }, () => ({
    x: (rand() - 0.5) * FLY_BOX, y: 0.4 + rand() * 3.5, z: (rand() - 0.5) * FLY_BOX, phase: rand() * 6.28, speed: 0.4 + rand() * 0.8 }));
  const flyGeometry = new THREE.BufferGeometry();
  flyGeometry.setAttribute('position', new THREE.BufferAttribute(flyPositions, 3));
  const flyMaterial = new THREE.PointsMaterial({ color: 0x7af5ff, map: createSoftDot(), size: 0.45, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const fireflies = new THREE.Points(flyGeometry, flyMaterial);
  fireflies.name = 'Heart · fireflies';
  fireflies.frustumCulled = false;
  fireflies.visible = false;
  scene.add(fireflies);

  const dummy = new THREE.Object3D();
  const wrap = (v, span) => ((v % span) + span * 1.5) % span - span / 2;
  let time = 0;
  return {
    // centre: the player's position; chaos 0..1; restored: Heart's current is back.
    update(dt, centre, { chaos = 0, restored = false } = {}) {
      time += dt;
      const lush = heartClimateAt(centre.x, centre.z);
      if (mesh) {
        const shown = Math.round(COUNT * lush);
        mesh.count = shown;
        const wind = chaos * 5, fallBoost = 1 + chaos * 1.6;
        for (let i = 0; i < shown; i++) {
          const p = petals[i];
          p.y -= p.fall * fallBoost * dt;
          p.x += (Math.sin(time * p.sway + p.phase) * 0.5 + wind) * dt;
          p.z += Math.cos(time * p.sway * 0.8 + p.phase) * 0.4 * dt;
          if (p.y < LOW) p.y += HIGH - LOW; // fallen out of the box: drift in again from above
          dummy.position.set(centre.x + wrap(p.x - centre.x, BOX), centre.y + p.y, centre.z + wrap(p.z - centre.z, BOX));
          dummy.rotation.set(time * p.spin + p.phase, time * p.spin * 0.7, p.phase + Math.sin(time * p.spin) * 0.6);
          dummy.scale.setScalar(p.size);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.visible = shown > 0;
      }
      const glow = restored ? lush * (1 - chaos * 0.8) : 0;
      fireflies.visible = glow > 0.02;
      if (fireflies.visible) {
        flyMaterial.opacity = glow * (0.65 + 0.35 * Math.sin(time * 2.3));
        flySeeds.forEach((f, i) => {
          const t = time * f.speed + f.phase;
          flyPositions[i * 3] = centre.x + wrap(f.x + Math.sin(t) * 1.5 - centre.x, FLY_BOX);
          flyPositions[i * 3 + 1] = centre.y - 2.05 + f.y + Math.sin(t * 1.7) * 0.4;
          flyPositions[i * 3 + 2] = centre.z + wrap(f.z + Math.cos(t * 0.8) * 1.5 - centre.z, FLY_BOX);
        });
        flyGeometry.attributes.position.needsUpdate = true;
      }
    },
  };
}
