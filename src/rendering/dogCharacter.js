import { loadModel } from './models.js';
import { dogMood } from '../models/dogMood.js';

// The companion (Shiba) and the Ember Hound (Wolf): CC0 Quaternius rigs rebuilt by
// tools/dogBuilder.js into src/assets with original details and authored clips.
// After the mixer runs, cheap procedural layers make it feel alive: a mood-driven tail
// wag and carriage, ears that perk or flatten on springs, and a head that looks at things.
export const DOG_ASSETS = { dog: 'src/assets/dog.glb', hound: 'src/assets/hound.glb' };
const ONE_SHOTS = new Set(['playBow', 'shake', 'Idle_HitReact1', 'Idle_HitReact2', 'Jump_ToIdle', 'Gallop_Jump', 'Death']);

// body = { root, mixer, actions, current, fallback } (the shape companion.js already uses) + animate().
export function createDogBody({ scene, kind = 'dog', height, accessories = true, fallback = null }) {
  const body = { root: new THREE.Group(), mixer: null, actions: {}, current: null, fallback: null, ready: null, kind };
  body.root.visible = false; scene?.add(body.root);
  const tail = [], ears = [], neck = [];
  let model = null, glowMaterial = null, tagMaterial = null;
  const look = { yaw: 0, pitch: 0, weight: 0 }, carriage = { raise: 0, wag: 0, phase: 0 };
  const earSpring = { value: 0, velocity: 0 };
  const inverse = new THREE.Quaternion(), worldQ = new THREE.Quaternion(), offset = new THREE.Quaternion();
  const rest = new Map(), axis = new THREE.Vector3(), target = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

  body.ready = loadModel(DOG_ASSETS[kind], height).then(({ object, animations }) => {
    model = object; body.root.add(object);
    const ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 195, 195, 195, 255, 255, 255]), 3, 1, THREE.RGBFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
    const toon = new THREE.MeshToonMaterial({ vertexColors: true, skinning: true, gradientMap: ramp });
    glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, skinning: true, toneMapped: false });
    const rigidToon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
    tagMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    object.traverse(o => {
      if (o.name === 'DogAccessories') o.visible = accessories;
      if (/^Tail\d$/.test(o.name)) tail.push(o);
      if (/^Ear1[LR]$/.test(o.name)) ears.push(o);
      if (o.name === 'Neck3' || o.name === 'Head') neck.push(o);
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      // The loader splits each material group into its own mesh, so each gets one material.
      const glowing = o.material.name === 'DogGlow';
      o.material = o.isSkinnedMesh ? (glowing ? glowMaterial : toon) : (glowing ? tagMaterial : rigidToon);
    });
    tail.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    neck.sort((a, b) => (a.name === 'Head') - (b.name === 'Head'));
    for (const bone of [...tail, ...ears, ...neck]) rest.set(bone, bone.quaternion.clone());
    body.mixer = new THREE.AnimationMixer(object);
    for (const clip of animations) {
      const action = body.mixer.clipAction(clip);
      if (ONE_SHOTS.has(clip.name)) { action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; }
      body.actions[clip.name] = action;
    }
    // A finished one-shot hands back to the clip that was playing before it.
    body.mixer.addEventListener('finished', event => {
      const name = event.action.getClip().name;
      if (body.current === name && body.resume) { const next = body.resume; body.resume = null; playDog(body, next); }
    });
    if (body.pending) { const name = body.pending; body.pending = null; playDog(body, name, 0); }
  }).catch(error => {
    console.warn(`Companion model could not load: ${DOG_ASSETS[kind]}; using a procedural fallback.`, error);
    if (fallback) { body.fallback = fallback(); body.root.add(body.fallback.model); }
  });

  // Rotate a bone about a direction given in the dog's model space, after the mixer pose.
  function turn(bone, modelAxis, angle) {
    if (!angle) return;
    model.getWorldQuaternion(worldQ); axis.copy(modelAxis).applyQuaternion(worldQ);
    bone.getWorldQuaternion(inverse).invert(); axis.applyQuaternion(inverse).normalize();
    bone.quaternion.multiply(offset.setFromAxisAngle(axis, angle)); bone.updateMatrixWorld(true);
  }

  /**
   * Replaces mixer.update: rest the procedural bones (clips may not key them, so offsets
   * must not accumulate), run the mixer, then layer mood on top.
   * mood = { speed, happy (0-1), chaos (0-1), alert (0-1), look: Vector3|null, scar (0-1) }
   */
  body.tick = (dt, mood = {}) => {
    if (!model || !body.mixer) return;
    for (const [bone, q] of rest) bone.quaternion.copy(q);
    body.mixer.update(dt);
    if (!body.root.visible || dt <= 0) return;
    const m = dogMood(mood, body.current);
    // Gait follows speed, but capped: the companion keeps up with an 18 m/s sprint by covering
    // more ground per stride, not by blurring its legs.
    const speed = mood.speed || 0;
    body.actions.Walk?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 2.2, .6, 1.4));
    body.actions.Gallop?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 12, .75, 1.15));
    model.updateMatrixWorld(true);
    // Tail: carriage (raised happy, tucked scared) plus a wag whose speed and width follow mood.
    const k = 1 - Math.exp(-6 * dt);
    carriage.raise += (m.tailRaise - carriage.raise) * k; carriage.wag += (m.wagAmplitude - carriage.wag) * k;
    carriage.phase += dt * m.wagFrequency * Math.PI * 2;
    tail.forEach((bone, i) => {
      const share = 1 / tail.length;
      turn(bone, X, carriage.raise * share * 1.6);
      turn(bone, Y, Math.sin(carriage.phase - i * .45) * carriage.wag * share * 1.2);
    });
    // Ears ride a spring toward perked (+) or flattened (-), so they bounce when the mood flips.
    earSpring.velocity += ((m.ears - earSpring.value) * 90 - earSpring.velocity * 11) * dt;
    earSpring.value += earSpring.velocity * dt;
    for (const ear of ears) turn(ear, X, earSpring.value);
    // Head look-at, clamped and eased; off while the clip owns the head (howl, gallop).
    let yaw = 0, pitch = 0;
    if (mood.look && m.lookWeight > 0) {
      target.copy(mood.look); body.root.worldToLocal(target);
      const head = neck[neck.length - 1]; const at = head.getWorldPosition(axis); body.root.worldToLocal(at);
      target.sub(at); yaw = THREE.MathUtils.clamp(Math.atan2(target.x, target.z), -1.05, 1.05);
      pitch = THREE.MathUtils.clamp(-Math.atan2(target.y, Math.hypot(target.x, target.z)), -.5, .45);
      if (Math.abs(Math.atan2(target.x, target.z)) > 2.2) yaw = 0; // behind: do not wrench the neck
    }
    const lk = 1 - Math.exp(-5 * dt);
    look.weight += (m.lookWeight - look.weight) * lk; look.yaw += (yaw - look.yaw) * lk; look.pitch += (pitch - look.pitch) * lk;
    neck.forEach((bone, i) => { const share = i ? .6 : .4; turn(bone, Y, look.yaw * look.weight * share); turn(bone, X, look.pitch * look.weight * share); });
    // The hound's fissures and eyes breathe slowly, like cooling lava; the dog has no body glow.
    if (glowMaterial) glowMaterial.color.setScalar(m.scarGlow * (kind === 'hound' ? .78 + .22 * Math.sin(carriage.phase * .35) : 1));
    if (tagMaterial) tagMaterial.color.setScalar(.75 + .25 * Math.sin(carriage.phase * .15));
  };
  return body;
}

export function playDog(body, name, fade = .25) {
  if (body.current === name) return;
  const action = body.actions[name];
  if (!action) {
    if (body.fallback) body.current = name;
    else if (!body.mixer) body.pending = name; // still loading: play it once the clips exist
    return;
  }
  if (ONE_SHOTS.has(name) && body.current && !ONE_SHOTS.has(body.current)) body.resume = body.current;
  action.reset().fadeIn(fade).play();
  body.actions[body.current]?.fadeOut(fade);
  body.current = name;
}
