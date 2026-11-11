import { loadModel } from './models.js';
import { createTravelerMotion } from '../models/travelerMotion.js';
import { pickExpression } from '../models/faceExpression.js';
import { createTravelerFace } from './travelerFace.js';

// Sigil-blade wanderer: original outfit + CC0 rig/motions in one generated GLB.
// Combat clips are sampled at the clip time chosen by travelerCombat, so what is
// drawn matches the simulated hit frames. No reference game's assets or code are used.
const ONE_SHOTS = ['jumpStart', 'land', 'interact', 'castShoot'];
// walkSpeed: this place's normal walking speed (kingdoms 9 m/s, movement lab 4.2), to tell a sprint apart.
// terrainAt(x, z): the natural ground only (no platforms). Slides happen on natural slopes, never on stairs or ramps.
export function createTravelerCharacter({ scene, state, player, surfaceAt, terrainAt = null, status = document.querySelector('#characterStatus'), walkSpeed = 9, reactiveFace = false }) {
  const root = new THREE.Group(); root.name = 'DreamScape traveller'; scene.add(root);
  const lean = new THREE.Group(); root.add(lean);
  const motion = createTravelerMotion(), actions = new Map(), legs = [], cape = [];
  const foot = new THREE.Vector3(), goal = new THREE.Vector3(), hip = new THREE.Vector3(), knee = new THREE.Vector3();
  const direction = new THREE.Vector3(), bend = new THREE.Vector3(), projected = new THREE.Vector3(), desired = new THREE.Vector3();
  const rotation = new THREE.Quaternion(), parent = new THREE.Quaternion(), world = new THREE.Quaternion();
  const swing = new THREE.Quaternion(), euler = new THREE.Euler();
  // Swarm gestures, posed over whatever the legs are doing (E keeps the one-hand cast clip):
  // Q thrusts both palms at them in pulses, F raises both arms overhead and beckons them home.
  const arms = [], up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), aim = new THREE.Vector3(), lastCast = new THREE.Vector3();
  const shoulder = new THREE.Vector3(), elbow = new THREE.Vector3(), wrist = new THREE.Vector3(), knuckle = new THREE.Vector3(), turn = new THREE.Quaternion();
  let castWeight = 0, castTime = 0, chest = null;
  // Tide Hook rope: the left hand throws the line (the sword stays in the right), the right arm trails,
  // the body hangs along the rope, and letting go spins one somersault.
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1, 5).translate(0, .5, 0), new THREE.MeshBasicMaterial({ color: 0xc8fbff, toneMapped: false }));
  rope.visible = false; rope.frustumCulled = false; scene.add(rope);
  const ropeEnd = new THREE.Vector3(), ropeAnchor = new THREE.Vector3(), back = new THREE.Vector3(), palm = new THREE.Vector3(), knuckleDir = new THREE.Vector3(), axis = new THREE.Vector3();
  let ropeWeight = 0, shoulderRest = null; // the hook shoulder in the body's rest frame, measured at load
  const waist = new THREE.Vector3(0, 1.1, 0), hang = new THREE.Quaternion(), hangGoal = new THREE.Quaternion(), pitch = new THREE.Quaternion(), roll = new THREE.Quaternion(), from = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1); let bank = 0;
  function poseArm(arm, goal, weight) {
    arm.upper.getWorldPosition(shoulder); arm.fore.getWorldPosition(elbow); aimBone(arm.upper, shoulder, elbow, goal, weight);
    arm.fore.getWorldPosition(elbow); arm.hand.getWorldPosition(wrist); aimBone(arm.fore, elbow, wrist, goal, weight);
    arm.hand.getWorldPosition(wrist); arm.finger.getWorldPosition(knuckle); aimBone(arm.hand, wrist, knuckle, goal, weight); // straight wrist
  }
  // Palm side of the hand bone, measured on the rig: local +X on the left hand, -X on the right.
  const palmOf = arm => palm.set(arm.sign, 0, 0).applyQuaternion(arm.hand.getWorldQuaternion(world));
  // A closed fist around the line: every finger joint curls toward the palm (the thumb keeps its clip pose).
  const CURL = [1.35, 1.5, 1.1];
  function fist(arm, weight) {
    for (const [finger, bones] of Object.entries(arm.fingers)) {
      if (finger === 'thumb') continue;
      bones.forEach(({ bone, bind }, i) => {
        bone.quaternion.slerp(bind, weight); bone.updateMatrixWorld(true);
        bone.getWorldPosition(wrist); bone.children[0].getWorldPosition(knuckle);
        axis.crossVectors(knuckleDir.subVectors(knuckle, wrist).normalize(), palmOf(arm)).normalize();
        rotate(bone, turn.setFromAxisAngle(axis, CURL[i] * weight));
      });
    }
  }
  function palmPoint(arm, target) { // palm centre, a little proud of the skin
    arm.hand.getWorldPosition(target); arm.finger.getWorldPosition(knuckle);
    return target.lerp(knuckle, .55).addScaledVector(palmOf(arm), .035);
  }
  function swingArms(dt, hook) {
    ropeWeight += ((hook?.anchor ? 1 : 0) - ropeWeight) * (1 - Math.exp(-14 * dt));
    if (hook?.anchor) ropeAnchor.set(hook.anchor.x, hook.anchor.y, hook.anchor.z);
    const thrower = arms.find(a => a.sign > 0), trailer = arms.find(a => a.sign < 0);
    if (ropeWeight > .01 && thrower) {
      root.updateMatrixWorld(true); thrower.upper.getWorldPosition(shoulder);
      poseArm(thrower, aim.copy(ropeAnchor).sub(shoulder).normalize(), ropeWeight);
      fist(thrower, ropeWeight);
      if (trailer) { // the free arm trails low and behind, like a swing's counterweight
        side.set(Math.cos(heading), 0, -Math.sin(heading)); back.set(-Math.sin(heading), 0, -Math.cos(heading));
        poseArm(trailer, aim.copy(back).multiplyScalar(.7).addScaledVector(side, -.6).addScaledVector(up, -.35).normalize(), ropeWeight);
      }
    }
    rope.visible = Boolean(hook?.anchor && thrower);
    if (!rope.visible) return;
    palmPoint(thrower, wrist);
    ropeEnd.lerpVectors(wrist, ropeAnchor, hook.reach);
    aim.subVectors(ropeEnd, wrist); const length = aim.length();
    rope.position.copy(wrist); rope.scale.set(1, Math.max(.001, length), 1); rope.quaternion.setFromUnitVectors(up, aim.divideScalar(length || 1));
  }
  function aimBone(bone, from, to, goal, weight) { turn.setFromUnitVectors(to.sub(from).normalize(), goal); rotate(bone, turn.slerp(rotation.identity(), 1 - weight)); }
  function castArms(dt, castAt, gesture) {
    castTime += dt;
    if (gesture === 'attract') castAt = null; // E plays the one-hand cast clip instead
    castWeight += ((castAt && arms.length ? 1 : 0) - castWeight) * (1 - Math.exp(-8 * dt));
    if (castAt) lastCast.copy(castAt).sub(player.position); // relative, so lowering arms follow the player
    if (castWeight < .01) return;
    const pulse = gesture === 'push' ? Math.max(0, Math.sin(castTime * 9)) : 0;
    if (chest) { // the chest leans into a shove, arches back to call them home
      euler.set(gesture === 'push' ? .12 + .1 * pulse : gesture === 'recall' ? -.14 : -.05, 0, 0); swing.setFromEuler(euler);
      chest.quaternion.multiply(rotation.identity().slerp(swing, castWeight));
    }
    root.updateMatrixWorld(true);
    side.set(Math.cos(heading), 0, -Math.sin(heading)); // the traveller's left
    for (const arm of arms) {
      arm.upper.getWorldPosition(shoulder);
      aim.copy(lastCast).add(player.position).sub(shoulder);
      const off = Math.atan2(Math.sin(Math.atan2(aim.x, aim.z) - heading), Math.cos(Math.atan2(aim.x, aim.z) - heading));
      const bearing = heading + THREE.MathUtils.clamp(off, -.95, .95), flat = Math.hypot(aim.x, aim.z); // never behind the body
      aim.set(Math.sin(bearing) * flat, THREE.MathUtils.clamp(aim.y, -flat * .4, flat * .8), Math.cos(bearing) * flat).normalize();
      if (gesture === 'grab') aim.addScaledVector(side, arm.sign * .08).normalize();
      else if (gesture === 'attract') aim.addScaledVector(side, arm.sign * 1.1).addScaledVector(up, .35).normalize();
      else if (gesture === 'push') { aim.y *= .3; aim.addScaledVector(side, arm.sign * (.12 - .1 * pulse)).normalize(); }
      else if (gesture === 'recall') aim.lerp(up, .75 + .2 * Math.sin(castTime * 6 + arm.sign)).addScaledVector(side, arm.sign * .25).normalize();
      // 'grab' (a chest reveal): straight at the item, the hands a little apart
      arm.fore.getWorldPosition(elbow); aimBone(arm.upper, shoulder, elbow, aim, castWeight);
      arm.fore.getWorldPosition(elbow); arm.hand.getWorldPosition(wrist); aimBone(arm.fore, elbow, wrist, aim, castWeight);
      arm.hand.getWorldPosition(wrist); arm.finger.getWorldPosition(knuckle);
      aimBone(arm.hand, wrist, knuckle, aim.lerp(up, gesture === 'recall' ? .2 : .6).normalize(), castWeight); // palms out
    }
  }
  let mixer = null, model = null, sword = null, sockets = {}, failed = false, label = '', name = 'loading', heading = state.yaw + Math.PI, tilt = 0, ik = 0;
  let slideLean = 0, descent = 0, lastFeet = player.position.y; // the slide pose and the feet's measured descent
  let rootMotion = {}, modelScale = 1, clock = 0, drawn = false, face = null, faceOverride = null, faceOverrideTime = 0, expression = 'neutral';
  const capeState = { pitch: .1, pitchV: 0, roll: 0, rollV: 0, lastHeading: heading };
  const trail = createTrail(scene);
  const ready = loadModel('src/assets/traveler.glb', 2.05).then(asset => {
    model = asset.object; lean.add(model);
    const ramp = new THREE.DataTexture(new Uint8Array([105, 105, 105, 185, 185, 185, 255, 255, 255]), 3, 1, THREE.RGBFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
    const look = skinning => [
      new THREE.MeshToonMaterial({ vertexColors: true, skinning, gradientMap: ramp, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ vertexColors: true, skinning, toneMapped: false }),
    ];
    const skinned = look(true), rigid = look(false);
    model.traverse(o => {
      if (o.userData.rootMotion) rootMotion = o.userData.rootMotion;
      if (o.name.startsWith('socket_')) sockets[o.name] = o;
      if (o.name.startsWith('cape_')) cape.push({ bone: o, bind: o.quaternion.clone() });
      if (o.name === 'TravelerSword') sword = o; // a Group when the mesh has two materials
      if (o.name === 'TravelerFace' && o.isMesh) { face = createTravelerFace(o, ramp); return; }
      if (!o.isMesh) return;
      const set = o.isSkinnedMesh ? skinned : rigid;
      o.material = Array.isArray(o.material) ? o.material.map(m => m.name === 'TravelerGlow' ? set[1] : set[0]) : set[0];
      o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
    });
    cape.sort((a, b) => a.bone.name.localeCompare(b.bone.name));
    modelScale = model.children[0]?.scale.x || 1;
    mixer = new THREE.AnimationMixer(model);
    for (const clip of asset.animations) {
      const action = mixer.clipAction(clip);
      if (ONE_SHOTS.includes(clip.name) || clip.name in (rootMotion || {}) || ['roll', 'block', 'hit', 'death', 'knockback'].includes(clip.name)) { action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; }
      action.play().setEffectiveWeight(0); action.enabled = false; actions.set(clip.name, action);
    }
    root.updateMatrixWorld(true);
    for (const side of ['l', 'r']) {
      const thigh = model.getObjectByName(`thigh_${side}`), calf = model.getObjectByName(`calf_${side}`), ankle = model.getObjectByName(`foot_${side}`);
      if (thigh && calf && ankle) { ankle.getWorldPosition(foot); legs.push({ thigh, calf, ankle, sole: foot.y - root.position.y }); }
      const upper = model.getObjectByName(`upperarm_${side}`), fore = model.getObjectByName(`lowerarm_${side}`), hand = model.getObjectByName(`hand_${side}`), finger = model.getObjectByName(`middle_01_${side}`);
      const fingers = Object.fromEntries(['index', 'middle', 'ring', 'pinky', 'thumb'].map(f => [f, [1, 2, 3].map(j => model.getObjectByName(`${f}_0${j}_${side}`)).filter(Boolean).map(bone => ({ bone, bind: bone.quaternion.clone() }))]));
      if (upper && fore && hand && finger) arms.push({ upper, fore, hand, finger, fingers, sign: side === 'l' ? 1 : -1 });
    }
    chest = model.getObjectByName('spine_03');
    const hookArm = arms.find(a => a.sign > 0); if (hookArm) shoulderRest = root.worldToLocal(hookArm.upper.getWorldPosition(new THREE.Vector3()));
  }).catch(error => { failed = true; console.warn('Traveller could not load.', error); });
  function rotate(bone, q) {
    bone.parent.getWorldQuaternion(parent); bone.getWorldQuaternion(world).premultiply(q);
    bone.quaternion.copy(parent.invert().multiply(world)); bone.updateMatrixWorld(true);
  }
  function solve(leg) {
    leg.thigh.getWorldPosition(hip); leg.calf.getWorldPosition(knee); leg.ankle.getWorldPosition(foot);
    const a = hip.distanceTo(knee), b = knee.distanceTo(foot), c = THREE.MathUtils.clamp(hip.distanceTo(goal), .01, a + b - .001);
    direction.subVectors(goal, hip).normalize(); bend.subVectors(knee, hip); bend.sub(projected.copy(direction).multiplyScalar(bend.dot(direction)));
    if (bend.lengthSq() < 1e-8) return;
    bend.normalize(); const cosine = THREE.MathUtils.clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1);
    desired.copy(hip).addScaledVector(direction, a * cosine).addScaledVector(bend, a * Math.sqrt(1 - cosine * cosine));
    rotate(leg.thigh, rotation.setFromUnitVectors(knee.sub(hip).normalize(), desired.sub(hip).normalize()));
    leg.calf.getWorldPosition(knee); leg.ankle.getWorldPosition(foot);
    rotate(leg.calf, rotation.setFromUnitVectors(foot.sub(knee).normalize(), direction.subVectors(goal, knee).normalize()));
  }
  function placeFeet(dt, allowed) {
    ik += ((allowed && player.grounded && !state.crouching ? 1 : 0) - ik) * (1 - Math.exp(-12 * dt));
    if (ik < .01 || !surfaceAt) return;
    root.updateMatrixWorld(true);
    for (const leg of legs) {
      leg.ankle.getWorldPosition(foot);
      const ground = surfaceAt(foot.x, foot.z, root.position.y + .65);
      const change = ground + leg.sole - foot.y;
      if (change < -.16 || Math.abs(change) < .004) continue; // leave the swing foot free
      goal.copy(foot); goal.y += THREE.MathUtils.clamp(change, -.18, .32) * ik; solve(leg);
    }
  }
  // Cheap secondary motion: one damped spring per axis, spread down three bones.
  function swingCape(dt, forwardSpeed, lateralSpeed, turnRate) {
    if (!cape.length || dt <= 0) return;
    clock += dt;
    const fall = player.grounded ? 0 : THREE.MathUtils.clamp(-player.velocity.y * .045, -.15, .6);
    const targetPitch = .08 + THREE.MathUtils.clamp(forwardSpeed * .075, -.05, .8) + fall + Math.sin(clock * 9.5) * .018 * Math.min(1, Math.abs(forwardSpeed) / 4);
    const targetRoll = THREE.MathUtils.clamp(-turnRate * .08 - lateralSpeed * .05, -.5, .5);
    const s = capeState, k = 70, c = 10;
    s.pitchV += ((targetPitch - s.pitch) * k - s.pitchV * c) * dt; s.pitch = Math.max(.02, s.pitch + s.pitchV * dt);
    s.rollV += ((targetRoll - s.roll) * k - s.rollV * c) * dt; s.roll += s.rollV * dt;
    const share = [.5, .3, .2];
    cape.forEach(({ bone, bind }, i) => {
      euler.set(s.pitch * share[i] + (i ? s.pitchV * .006 * i : 0), 0, s.roll * share[i]);
      bone.quaternion.copy(bind).multiply(swing.setFromEuler(euler));
    });
  }
  function holdSword(inHand) {
    if (!sword || drawn === inHand) return;
    const target = sockets[inHand ? 'socket_hand_r' : 'socket_back'];
    if (target) { target.add(sword); drawn = inHand; }
  }
  return {
    root, ready,
    get pose() { return name; }, get loaded() { return Boolean(mixer); },
    get rootMotion() { return rootMotion; }, get modelScale() { return modelScale; },
    get heading() { return heading; },
    get expression() { return expression; },
    /** Show an expression for a while (cutscenes, dialogue): 'joy', 'sad', 'surprised', ... */
    setExpression(name, seconds = 2) { faceOverride = name; faceOverrideTime = seconds; },
    swordTip(target, offset = .86) { if (!sword) return null; return sword.localToWorld(target.set(0, offset, 0)); },
    reset() { motion.reset(); heading = state.yaw + Math.PI; tilt = ik = bank = slideLean = descent = 0; lastFeet = player.position.y; hang.identity(); capeState.pitch = .1; capeState.pitchV = capeState.roll = capeState.rollV = 0; holdSword(false); trail.clear(); },
    /** hook: { anchor:{x,y,z}|null, reach 0..1, phase, flip 0..1 } from models/grapple.js. */
    update(dt, cameraDistance = 3.8, castAt = null, combat = null, hook = null) {
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      // How fast the feet are going down (ground snapping moves y directly, so velocity.y misses it): slopes, stairs.
      if (dt > 0) { const drop = Math.max(0, (lastFeet - player.position.y) / dt); descent += (Math.min(drop, 30) - descent) * (1 - Math.exp(-12 * dt)); }
      lastFeet = player.position.y;
      const onTerrain = !terrainAt || Math.abs(player.position.y - 2.05 - terrainAt(player.position.x, player.position.z)) < 0.5;
      const pose = motion.update(dt, { speed, grounded: player.grounded, verticalSpeed: player.velocity.y, crouching: state.crouching, casting: castAt ? state.swarmGesture || 'attract' : false, inFlight: player.inFlight, armed: Boolean(combat?.drawn), descent: onTerrain ? descent : 0 });
      const acting = Boolean(combat?.clip && actions.has(combat.clip));
      const swinging = hook?.phase === 'swing', flipping = hook?.phase === 'fly' && hook.flip < 1;
      name = acting ? combat.clip : swinging ? 'swinging' : flipping ? 'flipping' : pose.name;
      const nextLabel = failed ? 'Traveller unavailable' : `TPP · Traveller · ${name}`;
      if (status && nextLabel !== label) { status.textContent = nextLabel; label = nextLabel; }
      root.visible = Boolean(mixer) && !state.memory && cameraDistance > .65;
      root.position.copy(player.position); root.position.y -= 2.05;
      const target = state.cinematic ? state.cinematicYaw ?? heading : acting ? combat.facing : speed > .15 ? Math.atan2(player.velocity.x, player.velocity.z)
        : castAt && state.swarmGesture === 'grab' ? Math.atan2(castAt.x - player.position.x, castAt.z - player.position.z) : heading; // turn to the chest
      const difference = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
      heading += difference * (1 - Math.exp(-(acting ? 26 : 12) * dt)); root.rotation.y = heading;
      const turnRate = dt > 0 ? Math.atan2(Math.sin(heading - capeState.lastHeading), Math.cos(heading - capeState.lastHeading)) / dt : 0; capeState.lastHeading = heading;
      const targetTilt = player.grounded && !acting ? THREE.MathUtils.clamp(pose.acceleration * .005, -.06, .10) : 0;
      tilt += (targetTilt - tilt) * (1 - Math.exp(-8 * dt));
      slideLean += ((pose.sliding && !acting ? -.34 : 0) - slideLean) * (1 - Math.exp(-7 * dt)); // sliding: lean back, weight on the heels
      // Hang from the fist: turn the whole body about the waist so waist, hook shoulder and anchor line up,
      // so the body follows the hand through the arc instead of the arm reaching behind the head.
      hangGoal.identity();
      if (swinging && shoulderRest) {
        root.updateMatrixWorld(true); from.set(hook.anchor.x, hook.anchor.y, hook.anchor.z); root.worldToLocal(from).sub(waist).normalize();
        hangGoal.setFromUnitVectors(direction.copy(shoulderRest).sub(waist).normalize(), from);
      }
      hang.slerp(hangGoal, 1 - Math.exp(-10 * dt));
      const spin = flipping ? Math.PI * 2 * (1 - (1 - hook.flip) ** 3) : 0; // one forward somersault, eased out
      bank += ((acting ? 0 : THREE.MathUtils.clamp(-difference * .09, -.12, .12)) - bank) * (1 - Math.exp(-10 * dt)); // lean into turns
      lean.quaternion.copy(hang).multiply(roll.setFromAxisAngle(Z, bank)).multiply(pitch.setFromAxisAngle(X, tilt + spin + slideLean));
      lean.position.copy(waist).sub(direction.copy(waist).applyQuaternion(lean.quaternion)); // pivot at the waist, not the feet
      holdSword(Boolean(combat?.drawn));
      if (!mixer || !root.visible) { trail.clear(); rope.visible = false; return; }
      if ((faceOverrideTime -= dt) <= 0) faceOverride = null;
      const speaking = Boolean(state.cinematic && /^(YOU|TRAVELL?ER)$/i.test(state.cinematicSpeaker || ''));
      expression = pickExpression({ reactive: reactiveFace, override: faceOverride || (speaking ? state.cinematicFace : null), combat: combat?.clip, casting: Boolean(castAt), grounded: player.grounded,
        verticalSpeed: player.velocity.y, speed, sprinting: speed > walkSpeed * 1.25, chaos: state.chaos, petting: (state.interactionLock || 0) > 0 });
      face?.update(dt, expression, speaking);
      if (pose.takeoff) actions.get('jumpStart')?.reset().play();
      if (pose.landed && !acting) actions.get('land')?.reset().play();
      for (const [clip, action] of actions) {
        const targetWeight = acting ? (clip === combat.clip ? 1 : 0) : pose.weights[clip] || 0;
        const rate = acting && clip === combat.clip ? 30 : 16;
        const weight = action.getEffectiveWeight() + (targetWeight - action.getEffectiveWeight()) * (1 - Math.exp(-rate * dt));
        action.enabled = targetWeight > 0 || weight > .0001; action.setEffectiveWeight(action.enabled ? weight : 0);
        if (acting && clip === combat.clip) { action.paused = false; action.time = combat.time; action.setEffectiveTimeScale(0); continue; }
        if (clip === 'walk') action.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 1.5, .45, 1.6));
        else if (clip === 'jog') action.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 3.2, .65, 1.6));
        else if (clip === 'run') action.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 5.5, .65, 1.6)); // kingdoms sprint at 18 m/s
        else if (clip === 'crouchWalk') action.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 1.7, .6, 2.5));
        else if (action.getEffectiveTimeScale() === 0) action.setEffectiveTimeScale(1);
      }
      mixer.update(dt);
      const forward = player.velocity.x * Math.sin(heading) + player.velocity.z * Math.cos(heading);
      const lateral = player.velocity.x * Math.cos(heading) - player.velocity.z * Math.sin(heading);
      swingCape(dt, forward, lateral, turnRate);
      placeFeet(dt, !acting || combat.clip === 'block' || combat.clip === 'combatIdle');
      castArms(dt, acting ? null : castAt, state.swarmGesture || 'attract');
      swingArms(dt, hook);
      if (combat?.trail && sword) { root.updateMatrixWorld(true); trail.push(sword); } else trail.fade(dt);
    },
  };
}

// A short ribbon between the sword's guard and tip over the last few frames.
function createTrail(scene, length = 14) {
  const positions = new Float32Array(length * 2 * 3), alphas = new Float32Array(length * 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  const index = []; for (let i = 0; i < length - 1; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(0xa47dff) } },
    vertexShader: 'attribute float alpha; varying float vAlpha; void main(){ vAlpha = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; varying float vAlpha; void main(){ gl_FragColor = vec4(mix(vec3(1.0), color, 0.35 + 0.65 * (1.0 - vAlpha)), vAlpha * 0.6); }',
  });
  const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 5; scene.add(mesh);
  const base = new THREE.Vector3(), tip = new THREE.Vector3(); let count = 0, strength = 0;
  function refresh() {
    for (let i = 0; i < length; i++) { const a = i < count ? (1 - i / length) * .8 * strength : 0; alphas[i * 2] = a * .15; alphas[i * 2 + 1] = a; }
    geometry.attributes.alpha.needsUpdate = true; mesh.visible = count > 1 && strength > .02;
  }
  return {
    push(sword) {
      positions.copyWithin(6, 0, (length - 1) * 6);
      sword.localToWorld(base.set(0, .12, 0)); sword.localToWorld(tip.set(0, .9, 0));
      positions.set([base.x, base.y, base.z, tip.x, tip.y, tip.z], 0);
      if (count === 0) for (let i = 1; i < length; i++) positions.copyWithin(i * 6, 0, 6);
      count = Math.min(length, count + 1); strength = 1; geometry.attributes.position.needsUpdate = true; refresh();
    },
    fade(dt) { if (!count) return; strength *= Math.exp(-14 * dt); if (strength < .02) count = 0; refresh(); },
    clear() { count = 0; strength = 0; refresh(); },
  };
}
