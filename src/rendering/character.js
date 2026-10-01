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

export function createCharacter({ scene, state, player }) {
  const root = new THREE.Group();
  scene.add(root);
  const status = document.querySelector('#characterStatus');
  const loader = new THREE.FBXLoader();
  const actions = {};
  let mixer = null;
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

  return {
    update(dt, cameraDistance) {
      const mode = state.perspective === 'third' ? 'TPP' : 'FPP';
      const label = `${mode} · V to switch · ${failed ? 'Character unavailable' : mixer ? 'Character: Erika' : 'Loading character...'}`;
      if (label !== lastStatus) { status.textContent = label; lastStatus = label; }
      root.visible = Boolean(mixer) && state.perspective === 'third' && cameraDistance > 0.8;
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
      if (!player.grounded) target.jump = 1;
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
    }
  };
}
