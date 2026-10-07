import { loadModel, makeGlow } from './models.js';

const FIRE_COUNT = 90;
// [right, behind] offsets in metres, tried in order: beside, tighter beside, other side, behind.
const SLOTS = [[1.5, 0], [1.1, 0.3], [-1.5, 0], [-1.1, 0.3], [0, 1.3]];

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

export function createCompanion({ scene, state, player, quest, surfaceAt }) {
  // Climbs onto Clover terraces / Sky Garden instead of staying in the ravine below.
  const groundAt = (x, z) => surfaceAt(x, z, player.position.y - 2.05 + 1);
  const dog = createBody(scene, 'assets/animals/ShibaInu.gltf', 0.9, false);
  const hound = createBody(scene, 'assets/animals/Wolf.gltf', 1.5, true);
  const position = new THREE.Vector3();
  const goal = new THREE.Vector3();
  let yaw = 0;
  let slot = SLOTS[0]; // kept while the player is airborne, so jumps don't reshuffle it

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

      // Cursed: lead the player to the next ember. Otherwise: walk at the player's right side.
      const ember = quest.stage === 'cursed' ? quest.nextEmber() : null;
      if (ember) {
        const away = Math.atan2(player.position.x - ember.x, player.position.z - ember.z);
        goal.set(ember.x + Math.sin(away) * 3, 0, ember.z + Math.cos(away) * 3);
      } else {
        // Player right = (cos yaw, -sin yaw); see player.js movement basis. On narrow bridges
        // and ledges the side slot can hang over a drop, so pull it in or swap sides until the
        // ground there is at the player's level; fall back to just behind.
        const feet = player.position.y - 2.05, c = Math.cos(state.yaw), sn = Math.sin(state.yaw);
        if (player.grounded) slot = SLOTS.find(([r, b]) => {
          const x = player.position.x + c * r + sn * b, z = player.position.z - sn * r + c * b;
          return Math.abs(groundAt(x, z) - feet) < 1.2;
        }) || SLOTS[SLOTS.length - 1];
        goal.set(player.position.x + c * slot[0] + sn * slot[1], 0, player.position.z - sn * slot[0] + c * slot[1]);
      }
      const dx = goal.x - position.x;
      const dz = goal.z - position.z;
      const distance = Math.hypot(dx, dz);
      // ponytail: no collision with trees or ruins; add the player's collider check if it clips badly.
      if (!ember && distance > 70) position.set(goal.x, 0, goal.z); // never lose the companion
      // Following: match the player's velocity plus a spring toward the side slot, so it
      // keeps pace instead of chasing a moving point. Leading: plain seek to the ember.
      let vx, vz;
      if (ember) {
        const seek = distance > 1 ? Math.min(22, distance * 2.5 + 1) / distance : 0;
        vx = dx * seek; vz = dz * seek;
      } else {
        vx = player.velocity.x + dx * 4; vz = player.velocity.z + dz * 4;
        if (Math.hypot(dx, dz) < 0.3 && Math.hypot(player.velocity.x, player.velocity.z) < 0.5) vx = vz = 0;
      }
      let speed = Math.hypot(vx, vz);
      if (speed > 30) { vx *= 30 / speed; vz *= 30 / speed; speed = 30; }
      position.x += vx * dt;
      position.z += vz * dt;
      position.y = groundAt(position.x, position.z);

      const facing = speed > 0.5 ? Math.atan2(vx, vz) : Math.atan2(player.position.x - position.x, player.position.z - position.z);
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
