import { createDogBody, playDog } from './dogCharacter.js';
import { findPath } from '../models/pathfinding.js';
import { companionScenePosition } from '../models/companionSpacing.js';
import { createHoundFire } from './houndFire.js';
import { SHRINE } from '../models/quest.js';

// [right, behind] offsets in metres, tried in order: beside, tighter beside, other side, behind.
const SLOTS = [[1.5, 0], [1.1, 0.3], [-1.5, 0], [-1.1, 0.3], [0, 1.3]];

// Dog and Ember Hound share one rig family (Quaternius, CC0), rebuilt by tools/dogBuilder.js into
// src/assets/dog.glb and hound.glb; swapping models is a visibility toggle.
function createBody(scene, kind, height, glow) {
  return createDogBody({ scene, kind, height, fallback: () => makeFallbackAnimal(height, glow) });
}

function play(body, name) { playDog(body, name); }

function makeFallbackAnimal(height, glow) {
  const model = new THREE.Group();
  const scale = height / 0.9;
  const fur = new THREE.MeshStandardMaterial({
    color: glow ? 0x762818 : 0xb77b4f,
    emissive: glow ? 0x681800 : 0x000000,
    emissiveIntensity: glow ? 0.65 : 0,
    roughness: 0.85,
  });
  const dark = new THREE.MeshStandardMaterial({ color: glow ? 0x35120f : 0x493225, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), fur);
  torso.scale.set(0.35, 0.28, 0.52);
  torso.position.y = 0.42;
  model.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), fur);
  head.position.set(0, 0.68, 0.38);
  model.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), dark);
  muzzle.scale.set(1, 0.7, 1.2);
  muzzle.position.set(0, 0.62, 0.56);
  model.add(muzzle);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 6), dark);
    ear.position.set(side * 0.14, 0.89, 0.33);
    model.add(ear);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    for (const front of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.3, 7), fur);
      leg.position.set(side * 0.22, 0.16, front * 0.32);
      model.add(leg);
      legs.push(leg);
    }
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 7), fur);
  tail.position.set(0, 0.53, -0.54);
  tail.rotation.x = -Math.PI / 2.3;
  model.add(tail);
  model.scale.setScalar(scale);
  return { model, torso, legs, tail, time: 0 };
}

function animateFallback(body, dt) {
  if (!body.fallback) return;
  const fallback = body.fallback;
  fallback.time += dt;
  const stride = body.current === 'Gallop' ? 0.7 : body.current === 'Walk' ? 0.35 : 0;
  fallback.legs.forEach((leg, index) => {
    leg.rotation.x = stride * Math.sin(fallback.time * 10 + (index % 2) * Math.PI);
  });
  fallback.torso.position.y = 0.42 + (stride ? Math.abs(Math.sin(fallback.time * 10)) * 0.04 : Math.sin(fallback.time * 2) * 0.015);
  fallback.tail.rotation.z = Math.sin(fallback.time * 7) * 0.25;
}

// navigation (optional): { height(x, z), obstacles(): [{x, z, radius}], version() } for A* leading.
// Once the hound is cured the pup stays with the Shrine Keeper at the Grimoire Tower (HOME), by the tower's east side.
const HOME = { x: SHRINE.x + 5, z: SHRINE.z + 2.2 };

export function createCompanion({ scene, camera, renderer, state, player, quest, surfaceAt, navigation = null }) {
  // The surface at the player's level (the ember slab climb), not the ground under it.
  const groundAt = (x, z) => surfaceAt(x, z, player.position.y - 2.05 + 1);
  const dog = createBody(scene, 'dog', 0.9, false);
  const hound = createBody(scene, 'hound', 1.5, true);
  let activeBody = dog;
  let houndGuarding = false;
  const position = new THREE.Vector3();
  const goal = new THREE.Vector3();

  // Leading uses an A* route (models/pathfinding.js) around obstacles and cliffs. It is replanned when
  // the target ember changes, when chaos has reshaped the terrain (at most every 4 s), or when the hound
  // has strayed from it; between plans the hound walks waypoint to waypoint.
  const route = { result: null, target: null, version: -1, age: 0, next: 1, plans: 0 };
  function planRoute(ember) {
    const started = performance.now();
    route.result = navigation ? findPath(position, ember, {
      height: navigation.height, obstacles: navigation.obstacles(), maxGrade: 1.6,
    }) : null;
    route.target = ember;
    route.version = navigation?.version() ?? 0;
    route.age = 0;
    route.next = 1;
    route.plans++;
    route.ms = performance.now() - started;
  }
  function routeGoal(ember, dt) {
    route.age += dt;
    const stale = route.version !== (navigation?.version() ?? 0) && route.age > 4;
    const path = route.result?.path;
    const lost = path && Math.hypot(path[route.next - 1].x - position.x, path[route.next - 1].z - position.z) > 12 &&
      Math.hypot(path[route.next].x - position.x, path[route.next].z - position.z) > 12;
    if (route.target !== ember || stale || lost || (!route.result && route.age > 2)) planRoute(ember);
    if (!route.result) return null; // no route: fall back to heading straight for the ember
    const points = route.result.path;
    while (route.next < points.length - 1 &&
      Math.hypot(points[route.next].x - position.x, points[route.next].z - position.z) < 2.5) route.next++;
    return points[route.next];
  }
  let moodControl = false; // the mood brain (dog.js) owned the dog last frame, so it owns the clip
  let yaw = 0, still = 0, idleClip = 'Idle', idleTimer = 6;
  const look = new THREE.Vector3();
  // Body language for this frame: calm makes a happy, wagging dog; chaos tucks the tail and flattens the ears.
  function mood(body, speed, cursed) {
    look.copy(player.position); look.y -= .35; // the player's face (player.position is eye height)
    if (body === hound) return { speed, happy: .05, chaos: houndGuarding ? .55 : .35, alert: 1, scar: 1, look };
    const petting = body.current === 'pet';
    return { speed, happy: petting ? 1 : THREE.MathUtils.clamp(1.1 - state.chaos * 1.2, 0, 1), chaos: petting ? 0 : state.chaos,
      alert: body.current === 'bark' ? 1 : 0, scar: cursed ? 1 : 0, look };
  }
  let slot = SLOTS[0]; // kept while the player is airborne, so jumps don't reshuffle it

  const fire = createHoundFire({ scene, camera, renderer });

  // What the dog's mood brain (rendering/dog.js) drives: the active body and its clips per mood.
  const dogHandle = {
    get object() { return activeBody.root; },
    play(name) {
      const clips = {
        sit: 'sit',
        bark: 'bark',
        wait: 'sit',
        pet: 'pet',
        howl: 'howl',
      };
      play(activeBody, clips[name] || 'Idle');
      moodControl = true; // may come from a key handler between frames: keep the clip from being overwritten
    },
    onRelease() { play(activeBody, 'Idle'); moodControl = false; },
  };

  const companion = {
    dogHandle,
    get bodies() { return [dog, hound]; }, // debugging: dreamscape.companion.bodies[0].current
    get position() { return position; },
    route,
    prepareScene() {
      const colliders = navigation?.obstacles() ?? [];
      const at = companionScenePosition(position, player.position, groundAt,
        (x, z) => colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.radius + .7));
      if (!at) return false;
      position.set(at.x, at.y, at.z);
      fire.reset();
      return true;
    },
    update(dt, updateMoods, cinematic = null) {
      const cursed = quest.stage === 'cursed' || quest.stage === 'return';
      const wolf = cinematic?.wolf ?? (cursed ? 1 : 0);
      const flame = cinematic?.fire ?? (cursed ? 1 : 0);
      const body = wolf >= .5 ? hound : dog;
      activeBody = body;
      dog.root.visible = wolf < .5 && !state.memory; // hidden while a flashback replays the past
      hound.root.visible = wolf >= .5 && !state.memory;
      dog.root.scale.setScalar(1 + Math.min(wolf, .5) * .35);
      hound.root.scale.setScalar(.65 + .35 * wolf);
      if (cinematic?.hold) {
        yaw = Math.atan2(player.position.x - position.x, player.position.z - position.z);
        body.root.position.copy(position);
        body.root.rotation.y = yaw;
        play(body, 'Idle');
        body.tick(dt, mood(body, 0, cursed));
        animateFallback(body, dt);
        fire.update(dt, { position, yaw, intensity: flame, wolf });
        return;
      }

      // Cursed: lead the player to the next ember. Cured: stay home with the Keeper. Otherwise: walk at the player's right side.
      const ember = quest.stage === 'cursed' ? quest.nextEmber() : null;
      const home = quest.stage === 'cured';
      // Carrying its ember, the hound keeps away from a nearby player (flees in chaos, waits when
      // calm so it can be approached); farther away it leads as usual. 12/18 m hysteresis avoids jitter.
      const playerDistance = Math.hypot(position.x - player.position.x, position.z - player.position.z);
      houndGuarding = quest.stage === 'cursed' && quest.houndCarrying && playerDistance < (houndGuarding ? 18 : 12);
      if (houndGuarding) {
        if (state.chaos >= 0.4) {
          let dx = position.x - player.position.x;
          let dz = position.z - player.position.z;
          const distance = Math.hypot(dx, dz) || 1;
          dx /= distance;
          dz /= distance;
          goal.set(position.x + dx * 12, 0, position.z + dz * 12);
        } else {
          goal.set(position.x, 0, position.z);
        }
      } else if (ember) {
        const waypoint = Math.hypot(ember.x - position.x, ember.z - position.z) > 6 ? routeGoal(ember, dt) : null;
        if (waypoint) goal.set(waypoint.x, 0, waypoint.z);
        else { // last few metres: stand just short of the ember, on the player's side
          const away = Math.atan2(player.position.x - ember.x, player.position.z - ember.z);
          goal.set(ember.x + Math.sin(away) * 3, 0, ember.z + Math.cos(away) * 3);
        }
      } else if (home) {
        goal.set(HOME.x, 0, HOME.z);
      } else {
        // Player right = (cos yaw, -sin yaw); see player.js movement basis. On narrow bridges
        // and ledges the side slot can hang over a drop, so pull it in or swap sides until the
        // ground there is at the player's level; fall back to just behind.
        const feet = player.position.y - 2.05, c = Math.cos(state.yaw), sn = Math.sin(state.yaw);
        // In chaos the dog keeps close behind the player instead of out at the side.
        const order = state.chaos >= .65 ? [SLOTS[SLOTS.length - 1], ...SLOTS.slice(0, -1)] : SLOTS;
        if (player.grounded) slot = order.find(([r, b]) => {
          const x = player.position.x + c * r + sn * b, z = player.position.z - sn * r + c * b;
          return Math.abs(groundAt(x, z) - feet) < 1.2;
        }) || SLOTS[SLOTS.length - 1];
        const spacing = cursed ? 2.6 : 1;
        goal.set(player.position.x + (c * slot[0] + sn * slot[1]) * spacing, 0,
          player.position.z + (-sn * slot[0] + c * slot[1]) * spacing);
      }
      const dx = goal.x - position.x;
      const dz = goal.z - position.z;
      const distance = Math.hypot(dx, dz);
      // ponytail: no collision with trees or ruins; add the player's collider check if it clips badly.
      if (!ember && distance > 70) position.set(goal.x, 0, goal.z); // never lose the companion (or, cured, it is simply home)
      // Following: match the player's velocity plus a spring toward the side slot, so it
      // keeps pace instead of chasing a moving point. Leading, guarding and going home: plain seek to the goal
      // (guarding must not inherit the player's velocity, or a calm approach pushes the hound away).
      let vx, vz;
      if (ember || houndGuarding || home) {
        const seek = distance > 1 ? Math.min(home ? 4 : 22, distance * 2.5 + 1) / distance : 0; // home: an easy trot
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

      // Resting beside a still player: look around, sniff, then lie down after a while.
      const playerStill = Math.hypot(player.velocity.x, player.velocity.z) < .3;
      still = speed <= .5 && (playerStill || home) && !cursed && state.chaos < .65 ? still + dt : 0; // at home it settles down whatever you do
      if ((idleTimer -= dt) <= 0) { idleTimer = 5 + Math.random() * 4; idleClip = ['Idle', 'Idle_2', 'Idle_2_HeadLow'][Math.floor(Math.random() * 3)]; }
      if (moodControl) { /* sit, bark, pet, howl: the brain chose the clip */ }
      else if (speed > 8) play(body, 'Gallop');
      else if (speed > 0.5) play(body, 'Walk');
      else if (quest.restless) play(body, 'Idle_HitReact1');
      else if (ember && !quest.houndCarrying) play(body, 'Attack');
      else if (still > 9) play(body, 'lie');
      else play(body, cursed || state.chaos >= .65 ? 'Idle' : idleClip);
      body.tick(dt, mood(body, speed, cursed));
      animateFallback(body, dt);

      moodControl = updateMoods(dt);
      if (moodControl) {
        position.copy(body.root.position);
        yaw = body.root.rotation.y;
      }
      fire.update(dt, { position, yaw, intensity: flame, wolf });
    },

    reset() {
      if (quest.stage === 'cured') position.set(HOME.x, 0, HOME.z);
      else position.set(player.position.x + 1.5, 0, player.position.z + 2.5);
      fire.reset();
    }
  };
  return companion;
}
