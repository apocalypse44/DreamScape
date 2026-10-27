// "The Mark in the Flame": the Grimoire Tower shrine's memory of how the Dark Triad cursed the
// companion, replayed after the cure. On a quiet night a small dog sleeps at the foot of the tower;
// the Triad appears in the sky above it; Sile draws the shrine's warmth, Morcant opens a rift, and Veyr
// presses three interlocked spades into the sleeping pup: the three embers of the curse. The Shrine
// Keeper raises a ward too late; the curse sleeps until a restless traveller stirs the world.
// cloverScenes.js flies the camera and shows the captions; this module stages the past.
import { ramp, pulse, poseActor, createTriad, createSmoke, createBeam } from './flashback.js';
import { spadeOutline } from '../models/spade.js';
import { loadModel } from '../rendering/models.js';

export const MARK_PUP = Object.freeze({ x: 3, z: -1.5 });   // where the pup sleeps, ~10 m south of the tower
const TOWER_TOP = { x: 0, z: -11, up: 10.2 };                // the shrine's warmth leaves the tower's top
// The past as a pure function of time (s). The shot is 31.5 s; it snaps back to the present at 29.
export function markStage(t) {
  return {
    amount: ramp(t, 0, 1.2) * (1 - ramp(t, 29, 30.8)),
    shimmer: Math.max(pulse(t, .5, .6), pulse(t, 30.1, .8)),
    storm: ramp(t, 5.5, 8) * (1 - .85 * ramp(t, 21, 24)),
    veyr: t >= 5.8 && t < 22.6 ? ramp(t, 5.8, 7.2) * (1 - ramp(t, 21.4, 22.6)) : 0,
    triad: t >= 6.2 && t < 22.6 ? ramp(t, 6.2, 7.8) * (1 - ramp(t, 21.4, 22.6)) : 0,
    thread: ramp(t, 10.5, 11.3) * (1 - ramp(t, 14.5, 15.3)),
    rift: ramp(t, 11, 12.5) * (1 - ramp(t, 17, 18.5)),
    mark: t >= 12.3 && t < 16.4 ? ramp(t, 12.5, 15.5) : -1,  // -1: not shown; 0..1 descent from Veyr to the pup
    sink: ramp(t, 15.5, 16.3),                               // the mark shrinks into the pup
    embers: pulse(t, 15.9, .9),                              // the flare as it takes hold
    spark: ramp(t, 16.5, 17) * (1 - ramp(t, 28, 29)),        // the sleeping curse, a faint ember inside
    ward: ramp(t, 18.2, 19.2) * (1 - ramp(t, 23.5, 25)),
  };
}
export const MARK_KEEPER = { body: 'F', tint: 0x2f6f8f, face: MARK_PUP, keys: [
  [0, -4, .5, 'Idle_FoldArms_Loop'], [16.2, -4, .5, 'Jog_Fwd_Loop'], [18, 1.6, -.6, 'Spell_Simple_Idle_Loop'], [23.5, 1.6, -.6, 'Fixing_Kneeling']] };
// The Triad above the tower, each turned toward the sleeping pup; y is above the ground at the pup.
const facing = (x, z) => Math.atan2(MARK_PUP.x - x, MARK_PUP.z - z);
export const MARK_TRIAD = {
  veyr: { x: 0, y: 19, z: -15, yaw: facing(0, -15) },
  sile: { x: -6, y: 17, z: -13, yaw: facing(-6, -13) },
  morcant: { x: 6, y: 17, z: -13, yaw: facing(6, -13) },
};
function pupClip(t) { return t >= 15.6 && t < 16.8 ? ['Idle_HitReact1', true] : ['Idle_2_HeadLow', false]; }

// groundAt(x, z): terrain height, so the hub's ground and the actors agree.
export function createEmberFlashback({ scene, npcs, look, state, groundAt = () => 0 }) {
  const group = new THREE.Group(); group.name = 'Flashback · The Mark in the Flame'; scene.add(group);
  const smoke = createSmoke(group, 0x8c5cff), thread = createBeam(group, 0xff3a4f, .07);
  // The pup: the companion's own Shiba model, smaller, with its clips.
  let pup = null;
  loadModel('assets/animals/ShibaInu.gltf', .55).then(({ object, animations }) => {
    const mixer = new THREE.AnimationMixer(object), actions = {};
    for (const clip of animations) actions[clip.name] = mixer.clipAction(clip);
    let current = null;
    pup = { object, mixer, play(name, once) {
      if (current === name || !actions[name]) return;
      actions[name].reset(); actions[name].setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); actions[name].clampWhenFinished = once;
      actions[name].fadeIn(.25).play(); actions[current]?.fadeOut(.25); current = name;
    } };
    object.visible = false; group.add(object);
  }).catch(error => console.warn('Flashback pup unavailable.', error));
  // Three interlocked spades: the Triad's sign, pressed into the flame.
  const mark = new THREE.Group(), markMaterial = new THREE.MeshBasicMaterial({ color: 0xa47cff, side: THREE.DoubleSide, toneMapped: false });
  const spade = new THREE.ShapeGeometry(spadeOutline()); spade.scale(.09, .09, .09);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(spade, markMaterial), a = i * Math.PI * 2 / 3;
    m.position.set(Math.sin(a) * .28, Math.cos(a) * .28, 0); m.rotation.z = -a; mark.add(m);
  }
  mark.visible = false; group.add(mark);
  const rift = new THREE.Group();
  rift.add(new THREE.Mesh(new THREE.TorusGeometry(2.2, .12, 8, 40), new THREE.MeshBasicMaterial({ color: 0x9b6bff, toneMapped: false })),
    new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({ color: 0x0c0418, transparent: true, opacity: .85, side: THREE.DoubleSide })));
  rift.visible = false; group.add(rift);
  const emberData = new Float32Array(40 * 3), emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberData, 3));
  const embers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({ color: 0xff8a2a, size: .22, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false; group.add(embers);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const ward = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6fe8d8,
    transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(spark, ward);
  const from = new THREE.Vector3(), to = new THREE.Vector3(), top = new THREE.Vector3();
  let keeper = null, triad = null, playing = false, place = MARK_TRIAD, ground = 0;

  function begin() {
    playing = true; state.memory = true; npcs?.setHidden?.('*', true);
    ground = groundAt(MARK_PUP.x, MARK_PUP.z);
    place = Object.fromEntries(Object.entries(MARK_TRIAD).map(([k, p]) => [k, { ...p, y: ground + p.y }]));
    keeper = npcs?.actor?.(MARK_KEEPER) ?? null; if (keeper) group.add(keeper.group);
    triad = createTriad({ npcs, group });
    if (pup) { pup.object.visible = true; pup.object.position.set(MARK_PUP.x, ground, MARK_PUP.z); pup.object.rotation.y = 2.4; }
    ward.position.set(MARK_PUP.x, ground, MARK_PUP.z); spark.position.set(MARK_PUP.x, ground + .35, MARK_PUP.z);
  }
  function update(t, dt) {
    if (!playing) return;
    const stage = markStage(t);
    look.amount = stage.amount; look.shimmer = stage.shimmer; look.storm = stage.storm;
    if (keeper) poseActor(keeper, MARK_KEEPER.keys, MARK_KEEPER.face, t, dt, groundAt(castX(t), castZ(t)));
    if (pup) { const [clip, once] = pupClip(t); pup.play(clip, once); pup.mixer.update(dt); }
    triad?.update(t, dt, place, { veyr: stage.veyr, sile: stage.triad, morcant: stage.triad }, {
      veyr: t >= 12.3 && t < 13.6 ? ['Spell_Simple_Shoot', true] : [t < 12.3 ? 'Idle_FoldArms_Loop' : 'Spell_Simple_Idle_Loop', false],
      sile: [t >= 10.4 ? 'Spell_Simple_Idle_Loop' : 'Idle_FoldArms_Loop', false],
      morcant: [t >= 11 ? 'Spell_Simple_Idle_Loop' : 'Idle_FoldArms_Loop', false] });
    // Sile drinks the shrine's warmth from the tower's top.
    thread.set(top.set(TOWER_TOP.x, ground + TOWER_TOP.up, TOWER_TOP.z), triad?.hand('sile', to), stage.thread * stage.triad);
    // Morcant's rift opens above him.
    const m = place.morcant;
    rift.visible = stage.rift > 0; rift.position.set(m.x, m.y + 3, m.z); rift.rotation.set(Math.PI / 2.4, t * .4, 0); rift.scale.setScalar(Math.max(.001, stage.rift));
    // Veyr's mark descends from his hand into the pup, spinning, then sinks inside.
    mark.visible = stage.mark >= 0 && stage.sink < 1;
    if (mark.visible && triad?.hand('veyr', from)) {
      to.set(MARK_PUP.x, ground + .5, MARK_PUP.z); mark.position.lerpVectors(from, to, stage.mark * stage.mark * (3 - 2 * stage.mark));
      mark.rotation.set(0, t * 3, 0); mark.scale.setScalar((1 + .6 * Math.sin(t * 9) * .1) * (1 - stage.sink));
    }
    embers.material.opacity = stage.embers;
    for (let i = 0; i < 40; i++) {
      const a = i * 2.399, r = .3 + stage.embers * (.6 + (i % 5) * .25), lift = (i % 7) * .12 * stage.embers;
      emberData.set([MARK_PUP.x + Math.cos(a + t) * r, ground + .4 + lift, MARK_PUP.z + Math.sin(a + t) * r], i * 3);
    }
    emberGeometry.attributes.position.needsUpdate = true;
    spark.material.opacity = stage.spark * (.55 + .35 * Math.sin(t * 4));
    ward.material.opacity = stage.ward * .3;
    const v = place.veyr;
    smoke.set(from.set(v.x, v.y, v.z), Math.max(ramp(t, 5.6, 6.6) * (1 - ramp(t, 8, 9.5)), ramp(t, 21.2, 21.8) * (1 - ramp(t, 22.6, 24))), t);
  }
  // The keeper's ground follows her path (the hub is gently uneven).
  const castX = t => keeper?.group.position.x ?? MARK_KEEPER.keys[0][1], castZ = t => keeper?.group.position.z ?? MARK_KEEPER.keys[0][2];
  function end() {
    if (!playing) return;
    playing = false; state.memory = false; look.amount = look.shimmer = look.storm = 0;
    keeper?.dispose(); triad?.dispose(); keeper = triad = null;
    if (pup) pup.object.visible = false;
    mark.visible = rift.visible = false; embers.material.opacity = spark.material.opacity = ward.material.opacity = 0;
    thread.set(null, null, 0); smoke.set(from, 0, 0);
    npcs?.setHidden?.('*', false);
  }
  // actors: who is on stage (for debugging, e.g. dreamscape.mark.actors), heads: Triad members wearing head pieces.
  return { begin, update, end, get playing() { return playing; },
    get actors() { return [...(keeper ? ['keeper'] : []), ...(pup ? ['pup'] : []), ...Object.keys(triad?.members ?? {})]; },
    get heads() { return Object.values(triad?.members ?? {}).filter(m => m.bone).length; } };
}
