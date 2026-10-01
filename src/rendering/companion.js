import { loadModel, makeGlow } from './models.js';

const FIRE_COUNT = 90;

// Dog and Ember Hound share one rig and clip set (Quaternius), so swapping models is a visibility toggle.
function createBody(scene, url, height, glow) {
  const body = { root: new THREE.Group(), mixer: null, actions: {}, current: null };
  body.root.visible = false;
  scene.add(body.root);
  loadModel(url, height).then(({ object, animations }) => {
    if (glow) makeGlow(object, 0xff3a12, 0.7);
    body.root.add(object);
    body.mixer = new THREE.AnimationMixer(object);
    for (const clip of animations) body.actions[clip.name] = body.mixer.clipAction(clip);
  }).catch(error => console.warn(`Companion model could not load: ${url}`, error));
  return body;
}

function play(body, name) {
  if (body.current === name || !body.actions[name]) return;
  body.actions[name].reset().fadeIn(0.25).play();
  body.actions[body.current]?.fadeOut(0.25);
  body.current = name;
}

export function createCompanion({ scene, state, player, terrainHeight, quest }) {
  const dog = createBody(scene, 'assets/animals/ShibaInu.gltf', 0.9, false);
  const hound = createBody(scene, 'assets/animals/Wolf.gltf', 1.5, true);
  const position = new THREE.Vector3();
  const goal = new THREE.Vector3();
  let yaw = 0;

  // Rising embers around the cursed hound; same Points technique as the world motes.
  const firePositions = new Float32Array(FIRE_COUNT * 3);
  const fireLife = new Float32Array(FIRE_COUNT);
  const fireGeometry = new THREE.BufferGeometry();
  fireGeometry.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
  const fire = new THREE.Points(fireGeometry, new THREE.PointsMaterial({
    color: 0xff7a2a, size: 0.32, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  fire.frustumCulled = false;
  scene.add(fire);

  function updateFire(dt) {
    for (let i = 0; i < FIRE_COUNT; i++) {
      fireLife[i] -= dt;
      if (fireLife[i] <= 0) {
        fireLife[i] = 0.4 + Math.random() * 0.7;
        firePositions[i * 3] = position.x + (Math.random() - 0.5) * 1.1;
        firePositions[i * 3 + 1] = position.y + 0.3 + Math.random() * 0.9;
        firePositions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 1.1;
      } else {
        firePositions[i * 3 + 1] += (1.6 + (i % 5) * 0.4) * dt;
      }
    }
    fireGeometry.attributes.position.needsUpdate = true;
  }

  const companion = {
    update(dt) {
      const cursed = quest.stage === 'cursed' || quest.stage === 'return';
      const body = cursed ? hound : dog;
      dog.root.visible = !cursed;
      hound.root.visible = cursed;
      fire.visible = cursed;

      // Cursed: lead the player to the next ember. Otherwise: trot just behind the player.
      const ember = quest.stage === 'cursed' ? quest.nextEmber() : null;
      if (ember) {
        const away = Math.atan2(player.position.x - ember.x, player.position.z - ember.z);
        goal.set(ember.x + Math.sin(away) * 3, 0, ember.z + Math.cos(away) * 3);
      } else {
        // Beside and slightly behind, out of the third-person camera's line of sight.
        goal.set(player.position.x + Math.sin(state.yaw + 1.3) * 2.6, 0, player.position.z + Math.cos(state.yaw + 1.3) * 2.6);
      }
      const dx = goal.x - position.x;
      const dz = goal.z - position.z;
      const distance = Math.hypot(dx, dz);
      // ponytail: no collision with trees or ruins; add the player's collider check if it clips badly.
      if (!ember && distance > 70) position.set(goal.x, 0, goal.z); // never lose the companion
      const speed = distance > 1 ? Math.min(cursed ? 16 : 19, distance * 1.6 + 1) : 0;
      if (speed) {
        position.x += dx / distance * speed * dt;
        position.z += dz / distance * speed * dt;
      }
      position.y = terrainHeight(position.x, position.z);

      const facing = speed ? Math.atan2(dx, dz) : Math.atan2(player.position.x - position.x, player.position.z - position.z);
      yaw += Math.atan2(Math.sin(facing - yaw), Math.cos(facing - yaw)) * (1 - Math.exp(-10 * dt));
      body.root.position.copy(position);
      body.root.rotation.y = yaw;

      if (speed > 8) play(body, 'Gallop');
      else if (speed > 0.5) play(body, 'Walk');
      else if (quest.restless) play(body, 'Idle_HitReact1');
      else if (ember) play(body, 'Attack');
      else play(body, 'Idle');
      body.mixer?.update(dt);
      if (cursed) updateFire(dt);
    },

    reset() {
      position.set(player.position.x + 1.5, 0, player.position.z + 2.5);
      fireLife.fill(0);
    }
  };
  return companion;
}
