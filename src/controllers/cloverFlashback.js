// "The Severing": the Stormleaf Scar's memory of how the Dark Triad broke the Living Road, replayed
// when the player reads the Scar (before the Root Sigil route shot). cloverScenes.js flies the camera
// and shows the captions; this module stages the past on the real location: the memory look, the
// restored road, the Triad in the storm above the Scar, Veyr's chains, the crossings snapping, his
// decoy marks, young Iven's seal, and the actors (young Iven, two villagers) on the villagers' mannequins.
import { ramp, pulse, castPose, poseActor, createTriad, createSmoke, createBeam } from './flashback.js';
export { castPose };

// The past as a pure function of time (s). The shot is 40.6 s; it snaps back to the present at 38.
export const SEVERING_BREAKS = [18.6, 20.6, 22.6]; // crossing 3, then 2, then 1 (from the Scar back)
export function severingStage(t) {
  return {
    amount: ramp(t, 0, 1.2) * (1 - ramp(t, 38, 39.8)),
    shimmer: Math.max(pulse(t, .5, .6), pulse(t, 39.1, .8)),
    storm: ramp(t, 7, 9.5) * (1 - .8 * ramp(t, 34.5, 36.5)),
    chains: ramp(t, 12, 17) * (1 - ramp(t, 34.2, 35.4)),
    blacken: ramp(t, 13, 18),
    broken: SEVERING_BREAKS.filter(b => t >= b).length,
    decoys: ramp(t, 26, 28),
    beam: ramp(t, 31, 33) * (1 - ramp(t, 35, 36)),
    seal: ramp(t, 31.5, 34.5),
    veyr: t >= 7.5 && t < 35.6 ? ramp(t, 7.5, 9) * (1 - ramp(t, 34.6, 35.6)) : 0,
    // Sile and Morcant step out of the storm just after Veyr and leave as his seal strikes.
    triad: t >= 8 && t < 35.4 ? ramp(t, 8, 9.6) * (1 - ramp(t, 34.4, 35.4)) : 0,
    // Veyr's binding beam into the Scar: steady while the chains crawl, flaring at each break and the decoys.
    binding: Math.max(ramp(t, 11.6, 12.2) * (1 - ramp(t, 17, 17.6)), ...SEVERING_BREAKS.map(b => pulse(t, b, .6)), ramp(t, 25.6, 26) * (1 - ramp(t, 27.2, 27.6))),
  };
}

// Blocking: [time, x, z, clip from this time on]. Every crossing is cleared just before it snaps.
const SCAR = { x: -104, z: -455 };
export const SEVERING_CAST = {
  iven: { body: 'M', tint: 0x293c37, robe: 0xd9d4c4, face: SCAR, keys: [
    [0, -66.5, -421.6, 'Fixing_Kneeling'], [9, -66.5, -421.6, 'Idle_Loop'], [17.2, -66.5, -421.6, 'Sprint_Loop'],
    [18.4, -62.5, -420.4, 'Sprint_Loop'], [22.2, -39, -420.4, 'Idle_Loop'], [31, -39, -420.4, 'Spell_Simple_Idle_Loop'],
    [35.5, -39, -420.4, 'Idle_Loop']] },
  walker: { body: 'F', tint: 0x7a6a2f, face: SCAR, keys: [ // crossing 1 toward the Archive, then flees home
    [0, -62, -420.6, 'Walk_Loop'], [9, -50.3, -420.6, 'Idle_Loop'], [17.2, -50.3, -420.6, 'Jog_Fwd_Loop'], [21, -41.5, -420.6, 'Idle_Loop']] },
  stranded: { body: 'M', tint: 0x4f6a3a, face: SCAR, keys: [ // on crossing 2; reaches the junction, cut off
    [0, -67.5, -427, 'Walk_Loop'], [6, -67.5, -434.8, 'Idle_Loop'], [17.2, -67.5, -434.8, 'Sprint_Loop'], [19.2, -68.6, -423.5, 'Crouch_Idle_Loop']] },
};
// The Triad hangs in the storm above the Scar, facing the road (east); Veyr highest, at the centre.
export const SEVERING_TRIAD = {
  veyr: { x: -107, y: 25, z: -456, yaw: Math.PI / 2 },
  sile: { x: -110, y: 22.5, z: -449.5, yaw: Math.PI / 2 },
  morcant: { x: -110, y: 22.5, z: -462.5, yaw: Math.PI / 2 },
};
function veyrClip(t) {
  if (t >= 34.2) return ['Hit_Knockback', true];
  if (SEVERING_BREAKS.some(b => t >= b - .3 && t < b + .9) || (t >= 25.6 && t < 27.4)) return ['Spell_Simple_Shoot', true];
  if (t >= 12) return ['Spell_Simple_Idle_Loop', false];
  return ['Idle_FoldArms_Loop', false];
}

export function createSeveringFlashback({ scene, campaign, npcs, look, state }) {
  const group = new THREE.Group(); group.name = 'Flashback · The Severing'; scene.add(group);
  const smoke = createSmoke(group, 0x8c5cff), binding = createBeam(group, 0x9b6bff, .16);
  const scarPoint = new THREE.Vector3(SCAR.x, 12.4, SCAR.z), hand = new THREE.Vector3(), veyrAt = new THREE.Vector3();
  let cast = [], triad = null, playing = false;

  function begin() {
    playing = true; state.memory = true; npcs?.setHidden?.('*', true); // present-day villagers, Iven included, step aside
    cast = Object.entries(SEVERING_CAST).map(([name, def]) => ({ name, def, actor: npcs?.actor?.(def) })).filter(c => c.actor);
    for (const c of cast) group.add(c.actor.group);
    triad = createTriad({ npcs, group });
  }
  function update(t, dt) {
    if (!playing) return;
    const stage = severingStage(t);
    look.amount = stage.amount; look.shimmer = stage.shimmer; look.storm = stage.storm;
    const iven = cast.find(c => c.name === 'iven');
    hand.set(iven?.actor.group.position.x ?? -39, 13.9, iven?.actor.group.position.z ?? -420.4); // the seal leaves Iven's hand
    campaign?.memoryStage?.({ ...stage, beamFrom: hand });
    for (const c of cast) poseActor(c.actor, c.def.keys, c.def.face, t, dt, 12);
    triad?.update(t, dt, SEVERING_TRIAD, { veyr: stage.veyr, sile: stage.triad, morcant: stage.triad },
      { veyr: veyrClip(t), sile: ['Spell_Simple_Idle_Loop', false], morcant: [t < 12 ? 'Idle_FoldArms_Loop' : 'Spell_Simple_Idle_Loop', false] });
    binding.set(triad?.hand('veyr', veyrAt), scarPoint, stage.binding * stage.veyr);
    const v = SEVERING_TRIAD.veyr;
    smoke.set(veyrAt.set(v.x, v.y, v.z), Math.max(ramp(t, 7.3, 8.2) * (1 - ramp(t, 9.5, 11)), ramp(t, 34.4, 35) * (1 - ramp(t, 35.6, 37))), t);
  }
  function end() {
    if (!playing) return;
    playing = false; state.memory = false; look.amount = look.shimmer = look.storm = 0;
    campaign?.memoryStage?.(null);
    for (const c of cast) c.actor.dispose();
    triad?.dispose(); cast = []; triad = null;
    smoke.set(scarPoint, 0, 0); binding.set(null, null, 0);
    npcs?.setHidden?.('*', false);
  }
  // actors: who is on stage (for debugging, e.g. dreamscape.severing.actors), heads: Triad members wearing head pieces.
  return { begin, update, end, get playing() { return playing; },
    get actors() { return [...cast.map(c => c.name), ...Object.keys(triad?.members ?? {})]; },
    get heads() { return Object.values(triad?.members ?? {}).filter(m => m.bone).length; } };
}
