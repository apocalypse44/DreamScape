// Mixamo character + clips (FBX). Clips share the mixamorig skeleton, so any clip plays on the model.
const DIR = 'assets/character/';
const CLIPS = {
  idle: 'Breathing Idle.fbx', walk: 'Walking.fbx', run: 'Running.fbx', jump: 'Jump.fbx',
  crouchIdle: 'Crouching Idle.fbx', crouchWalk: 'Crouch Walk.fbx'
};
// Playback rates at the player's walk (9 m/s), sprint (18 m/s) and crouch (4.5 m/s); tune until the feet stop sliding.
const WALK_RATE = 1.6;
const RUN_RATE = 1.3;
const CROUCH_RATE = 1.4;
// Mixamo jumps start with a crouch; skip it (seconds) since our jump leaves the ground instantly.
const JUMP_SKIP = 0.3;

// Strip forward drift from the hips in case a clip was downloaded without "In Place".
function inPlace(clip) {
  for (const track of clip.tracks) {
    if (!/Hips\.position$/.test(track.name)) continue;
    const v = track.values;
    for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
  }
  return clip;
}

// Foot IK: clips assume flat ground, so on slopes each foot is moved onto the terrain under it.
const MAX_STEP = 0.6; // largest height difference a foot may adjust by (m)
const v = () => new THREE.Vector3();
const [hip, knee, foot, target, dir, bend] = [v(), v(), v(), v(), v(), v()];
const turn = new THREE.Quaternion(), parentQ = new THREE.Quaternion(), worldQ = new THREE.Quaternion();

// Rotate a bone in world space by q, keeping its parent untouched.
function rotateWorld(bone, q) {
  bone.parent.getWorldQuaternion(parentQ);
  bone.getWorldQuaternion(worldQ).premultiply(q);
  bone.quaternion.copy(parentQ.invert().multiply(worldQ));
  bone.updateMatrixWorld(true);
}

// Analytic two-bone IK: bend thigh + calf so the foot reaches `goal`, knee keeps pointing the same way.
function solveLeg({ thigh, calf, ankle }, goal) {
  thigh.getWorldPosition(hip);
  calf.getWorldPosition(knee);
  ankle.getWorldPosition(foot);
  const a = hip.distanceTo(knee), b = knee.distanceTo(foot);
  const c = THREE.MathUtils.clamp(hip.distanceTo(goal), 0.01, a + b - 0.001);
  dir.subVectors(goal, hip).normalize();
  bend.subVectors(knee, hip);
  bend.sub(dir.clone().multiplyScalar(bend.dot(dir))); // knee direction, perpendicular to hip→goal
  if (bend.lengthSq() < 1e-8) return; // leg perfectly straight: no bend plane, skip this frame
  bend.normalize();
  const cosA = THREE.MathUtils.clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1);
  target.copy(hip).addScaledVector(dir, a * cosA).addScaledVector(bend, a * Math.sqrt(1 - cosA * cosA));
  rotateWorld(thigh, turn.setFromUnitVectors(knee.sub(hip).normalize(), target.sub(hip).normalize()));
  calf.getWorldPosition(knee);
  ankle.getWorldPosition(foot);
  rotateWorld(calf, turn.setFromUnitVectors(foot.sub(knee).normalize(), dir.subVectors(goal, knee).normalize()));
}

export function createCharacter({ scene, state, player, surfaceAt }) {
  const root = new THREE.Group();
  scene.add(root);
  const status = document.querySelector('#characterStatus');
  const loader = new THREE.FBXLoader();
  const actions = {};
  let mixer = null;
  const legs = [];
  let hipDrop = 0;
  let ikWeight = 0;
  let wasGrounded = true;
  let failed = false;
  let lastStatus = '';

  loader.load(DIR + 'Erika Archer.fbx', model => {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const scale = 2.05 / Math.max(box.max.y - box.min.y, 0.001);
    model.scale.multiplyScalar(scale);
    model.position.x -= (box.min.x + box.max.x) * 0.5 * scale;
    model.position.y -= box.min.y * scale;
    model.position.z -= (box.min.z + box.max.z) * 0.5 * scale;
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false; // skinned bounds use the bind pose
    });
    root.add(model);
    for (const side of ['Left', 'Right']) {
      const bone = part => model.getObjectByName(`mixamorig${side}${part}`);
      if (bone('UpLeg') && bone('Leg') && bone('Foot')) legs.push({ thigh: bone('UpLeg'), calf: bone('Leg'), ankle: bone('Foot') });
    }
    mixer = new THREE.AnimationMixer(model);
    for (const [name, file] of Object.entries(CLIPS)) {
      loader.load(DIR + file, clipFile => {
        const action = mixer.clipAction(inPlace(clipFile.animations[0]));
        if (name === 'jump') {
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true; // hold the last airborne pose until landing
        }
        action.setEffectiveWeight(0).play();
        actions[name] = action;
      }, undefined, error => console.warn(`Clip ${file} could not load.`, error));
    }
  }, undefined, error => {
    failed = true;
    console.warn('Character FBX could not load.', error);
  });

  // Lower the hips so the lowest foot can reach its ground, then IK each leg onto the terrain.
  function placeFeet(dt) {
    const base = root.position.y; // ground under the player's centre
    // Feet land on whatever surface is under them (terrain, slab, fountain rim), never below it.
    const ground = (x, z) => surfaceAt(x, z, base + 0.15);
    const onTerrain = player.grounded && Math.abs(ground(player.position.x, player.position.z) - base) < 0.1;
    ikWeight += ((onTerrain && legs.length === 2 ? 1 : 0) - ikWeight) * (1 - Math.exp(-10 * dt));
    if (ikWeight < 0.01) { hipDrop = 0; return; }
    root.updateMatrixWorld(true);
    const deltas = legs.map(({ ankle }) => {
      ankle.getWorldPosition(foot);
      return THREE.MathUtils.clamp(ground(foot.x, foot.z) - base, -MAX_STEP, MAX_STEP);
    });
    hipDrop += (Math.min(0, ...deltas) - hipDrop) * (1 - Math.exp(-12 * dt)); // smoothed so steps don't jitter
    root.position.y = base + hipDrop * ikWeight;
    root.updateMatrixWorld(true);
    legs.forEach((leg, i) => {
      const raise = (deltas[i] - hipDrop) * ikWeight;
      if (raise < 0.005) return;
      leg.ankle.getWorldPosition(foot);
      solveLeg(leg, foot.clone().setY(foot.y + raise));
    });
  }

  return {
    update(dt, cameraDistance) {
      const mode = state.perspective === 'third' ? 'TPP' : 'FPP';
      const label = `${mode} · V to switch · ${failed ? 'Character unavailable' : mixer ? 'Character: Erika' : 'Loading character...'}`;
      if (label !== lastStatus) { status.textContent = label; lastStatus = label; }
      root.visible = Boolean(mixer) && (state.perspective === 'third' || player.inFlight) && cameraDistance > 0.8;
      root.position.copy(player.position);
      root.position.y -= 2.05;
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      const targetYaw = speed > 0.2 ? Math.atan2(player.velocity.x, player.velocity.z) : state.yaw + Math.PI;
      const delta = Math.atan2(Math.sin(targetYaw - root.rotation.y), Math.cos(targetYaw - root.rotation.y));
      root.rotation.y += delta * (1 - Math.exp(-12 * dt));
      if (!mixer) return;

      if (actions.jump && wasGrounded && !player.grounded && player.velocity.y > 0) {
        actions.jump.reset().play();
        actions.jump.time = JUMP_SKIP;
      }
      wasGrounded = player.grounded;

      // Pick target weights, then ease every clip toward its target so changes cross-fade.
      // ponytail: falls reuse the held jump pose; add 'Falling Idle.fbx' as a fall clip if drops look off.
      const moving = speed > 0.5;
      const run = THREE.MathUtils.smoothstep(speed, 10, 17); // walk at 9 m/s blends into run at 18 m/s
      const target = { idle: 0, walk: 0, run: 0, jump: 0, crouchIdle: 0, crouchWalk: 0 };
      if (player.inFlight) target.idle = 1;
      else if (!player.grounded) target.jump = 1;
      else if (state.crouching) target[moving ? 'crouchWalk' : 'crouchIdle'] = 1;
      else if (!moving) target.idle = 1;
      else { target.walk = 1 - run; target.run = run; }
      const ease = 1 - Math.exp(-12 * dt);
      for (const [name, action] of Object.entries(actions)) {
        action.setEffectiveWeight(action.getEffectiveWeight() + (target[name] - action.getEffectiveWeight()) * ease);
      }
      actions.walk?.setEffectiveTimeScale(WALK_RATE * Math.min(speed / 9, 1));
      actions.run?.setEffectiveTimeScale(RUN_RATE * Math.min(speed / 9, 1));
      actions.crouchWalk?.setEffectiveTimeScale(CROUCH_RATE * Math.min(speed / 4.5, 1));
      mixer.update(dt);
      placeFeet(dt);
    }
  };
}
