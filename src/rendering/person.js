import { loadModel, loadModelAsset } from './models.js';
import { cloneSkinned } from './anim.js';
import { createTravelerFace } from './travelerFace.js';

// People kit runtime: a character GLB from tools/peopleBuilder.js (body, face shell, props; no
// clips) driven by the one shared clip pack. Clips keep their Universal Animation Library names
// ('Idle_Loop', 'Walk_Loop', ...). Adds the anime face and an eased head look-at.
export const PEOPLE_CLIPS_URL = 'src/assets/people/people-clips.glb';
let clipPack = null, clipMap = null;
export function loadPeopleClips() {
  clipPack ||= loadModelAsset(PEOPLE_CLIPS_URL).then(asset => (clipMap = new Map(asset.animations.map(clip => [clip.name, clip]))));
  return clipPack;
}
// Loaded characters, kept pristine so later instances clone synchronously (story actors need that).
// ponytail: keyed by name only; every person is the default 1.75 m tall.
const templates = new Map(), loading = new Map();
const fetchPerson = name => {
  if (!loading.has(name)) loading.set(name, Promise.all([loadModel(`src/assets/people/${name}.glb`, 1.75), loadPeopleClips()])
    .then(([asset]) => { templates.set(name, asset.object); }));
  return loading.get(name);
};
export const preloadPerson = name => fetchPerson(name).then(() => {});
export const personReady = name => templates.has(name) && Boolean(clipMap);
const ONCE = new Set(['Interact', 'PickUp_Table', 'Spell_Simple_Shoot', 'Hit_Chest', 'Yes', 'Consume', 'Chest_Open', 'Death01']);

// colors: { paletteName: hex } recolours this instance (e.g. { tunic: 0x7a2f2f }), so one GLB
// serves many villagers. Names come from the recipe palette stored in the GLB.
export function createPerson({ name, height = 1.75, colors = null }) {
  const root = new THREE.Group(); root.name = `Person ${name}`;
  const person = { root, model: null, mixer: null, actions: {}, current: null, loaded: false, expression: 'neutral' };
  const neck = [], rest = new Map(), look = { yaw: 0, pitch: 0, weight: 0 };
  const worldQ = new THREE.Quaternion(), inverse = new THREE.Quaternion(), offset = new THREE.Quaternion();
  const axis = new THREE.Vector3(), target = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  let clips = new Map(), face = null, override = null, overrideTime = 0, pending = null, mood = null;

  function setup(object, pack) {
    clips = pack; person.model = object; root.add(object); object.scale.multiplyScalar(height / 1.75);
    const ramp = new THREE.DataTexture(new Uint8Array([110, 110, 110, 190, 190, 190, 255, 255, 255]), 3, 1, THREE.RGBFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
    const looks = {}, material = (skinning, glowing) => looks[`${skinning}${glowing}`] ||= glowing
      ? new THREE.MeshBasicMaterial({ vertexColors: true, skinning, toneMapped: false })
      : new THREE.MeshToonMaterial({ vertexColors: true, skinning, gradientMap: ramp, side: THREE.DoubleSide });
    let style = null, palette = null;
    object.traverse(o => { if (o.userData?.face) style = o.userData.face; if (o.userData?.palette) palette = o.userData.palette; });
    object.traverse(o => {
      if (o.name === 'neck_01' || o.name === 'Head') { neck.push(o); rest.set(o, o.quaternion.clone()); }
      if (!o.isMesh) return;
      if (o.name === 'PersonFace') { face = createTravelerFace(o, ramp, style || undefined); return; }
      if (colors && palette && o.isSkinnedMesh) recolor(o, palette, colors);
      o.material = material(Boolean(o.isSkinnedMesh), o.material.name === 'PersonGlow');
      o.castShadow = true; o.frustumCulled = false;
    });
    mood = style?.mood ?? null; // a character's resting expression (e.g. the Triad's glare)
    neck.sort((a, b) => (a.name === 'Head') - (b.name === 'Head'));
    person.mixer = new THREE.AnimationMixer(object); person.loaded = true;
    if (pending) { const [clip, fade, once] = pending; pending = null; person.play(clip, fade, once); }
  }
  if (personReady(name)) { setup(cloneSkinned(templates.get(name)), clipMap); person.ready = Promise.resolve(); }
  else person.ready = fetchPerson(name).then(() => setup(cloneSkinned(templates.get(name)), clipMap)) // each instance its own clone
    .catch(error => console.warn(`Person ${name} could not load.`, error));

  // Swap palette colours in this instance's own copy of the vertex colours.
  function recolor(mesh, palette, swaps) {
    const pairs = Object.entries(swaps).filter(([k]) => palette[k] != null)
      .map(([k, hex]) => [new THREE.Color(palette[k]).convertSRGBToLinear(), new THREE.Color(hex).convertSRGBToLinear()]);
    mesh.geometry = mesh.geometry.clone();
    const c = mesh.geometry.attributes.color;
    for (let i = 0; i < c.count; i++) for (const [from, to] of pairs) {
      if (Math.abs(c.getX(i) - from.r) + Math.abs(c.getY(i) - from.g) + Math.abs(c.getZ(i) - from.b) < 2e-3) { c.setXYZ(i, to.r, to.g, to.b); break; }
    }
  }
  function turn(bone, modelAxis, angle) {
    if (!angle) return;
    person.model.getWorldQuaternion(worldQ); axis.copy(modelAxis).applyQuaternion(worldQ);
    bone.getWorldQuaternion(inverse).invert(); axis.applyQuaternion(inverse).normalize();
    bone.quaternion.multiply(offset.setFromAxisAngle(axis, angle)); bone.updateMatrixWorld(true);
  }

  /** Play a clip by its UAL name (or an AnimationClip). Unknown names are ignored. */
  person.play = (clip, fade = .3, once = ONCE.has(clip?.name ?? clip)) => {
    const name = clip?.name ?? clip;
    if (!name || person.current === name) return;
    if (!person.mixer) { pending = [name, fade, once]; return; }
    // Callers may name a library clip this pack does not carry (people.js resolves 'talk' by pattern).
    const source = clips.get(name) ?? clips.get(/talk/i.test(name) ? 'Idle_Talking_Loop' : /walk/i.test(name) ? 'Walk_Loop' : /sprint|jog|run/i.test(name) ? 'Jog_Fwd_Loop' : /idle/i.test(name) ? 'Idle_Loop' : ''); if (!source) return;
    const action = person.actions[name] ||= person.mixer.clipAction(source);
    action.reset(); action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); action.clampWhenFinished = once;
    action.fadeIn(fade).play(); person.actions[person.current]?.fadeOut(fade); person.current = name;
  };
  /** Hold an expression for a while (dialogue, cutscenes). */
  person.setExpression = (expression, seconds = 2) => { override = expression; overrideTime = seconds; };

  /** ctx = { look: Vector3|null (world point to face), expression, talking } */
  person.update = (dt, ctx = {}) => {
    if (!person.mixer) return;
    for (const [bone, q] of rest) bone.quaternion.copy(q);
    person.mixer.update(dt);
    if ((overrideTime -= dt) <= 0) override = null;
    person.expression = override || ctx.expression || mood || 'neutral';
    face?.update(dt, person.expression, Boolean(ctx.talking));
    // Eased, clamped head turn toward the look target; nothing behind the shoulders.
    let yaw = 0, pitch = 0;
    if (ctx.look && neck.length) {
      person.model.updateMatrixWorld(true);
      target.copy(ctx.look); root.worldToLocal(target);
      const headAt = neck[neck.length - 1].getWorldPosition(axis); root.worldToLocal(headAt); target.sub(headAt);
      const a = Math.atan2(target.x, target.z);
      if (Math.abs(a) < 1.9) { yaw = THREE.MathUtils.clamp(a, -1, 1); pitch = THREE.MathUtils.clamp(-Math.atan2(target.y, Math.hypot(target.x, target.z)), -.4, .35); }
    }
    const k = 1 - Math.exp(-4 * dt), want = ctx.look ? 1 : 0;
    look.weight += (want - look.weight) * k; look.yaw += (yaw - look.yaw) * k; look.pitch += (pitch - look.pitch) * k;
    if (look.weight > .01) neck.forEach((bone, i) => { const share = i ? .6 : .4; turn(bone, Y, look.yaw * look.weight * share); turn(bone, X, look.pitch * look.weight * share); });
  };
  person.dispose = () => { person.mixer?.stopAllAction(); face?.dispose(); root.parent?.remove(root); };
  return person;
}

// A story actor (the shape flashbacks use: group, play(clip), update(dt), dispose()) on a person.
export function personActor(name, expression = 'neutral') {
  const person = createPerson({ name });
  return {
    group: person.root, get model() { return person.model; },
    play: (clip, fade = .3, once) => person.play(clip, fade, once),
    update: dt => person.update(dt, { expression }),
    dispose: () => person.dispose(),
  };
}

// A villager's colours: their role tint on the tunic (softened), varied hair and skin per person.
const HAIR = [0x4a3428, 0x2b2436, 0x8a5a32, 0xc9a46a, 0x6b6b72, 0x3a2a20, 0x7a3b2e];
const SKIN = [0xe6b48f, 0xd9a07a, 0xf0c8a8, 0xb98563, 0x9a6a4a];
export function villagerColors(tint, n) {
  const tunic = new THREE.Color(tint).lerp(new THREE.Color(0x7a7a72), .25).getHex();
  return { tunic, hair: HAIR[n % HAIR.length], skin: SKIN[(n * 3 + 1) % SKIN.length] };
}
