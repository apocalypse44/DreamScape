// "The Chain Order": Orin's Artificers' Hall remembers how the Triad made Diamond's workers forge the
// chains, how one of them scratched the plea into a conduit, and how they broke the relay. Played when
// Orin hands over the Prism Sigil. cloverScenes.js flies the camera and shows the captions; this module
// stages the past in the real hall: the memory look, Morcant at the door, the workers and young Orin at
// the forge and the table, the pile of violet chain growing, the glowing mark, and the relay's conduit
// shattering. Timeline and cast: src/models/diamondStory.js.
import { poseActor, createTriad, createSmoke, createBeam } from './flashback.js';
import { chainOrderStage, chainOrderCast, MORCANT_AT, CHAIN_TABLE } from '../models/diamondStory.js';
import { DIAMOND_BASE } from '../models/diamond.js';

const LINKS = 64, SHARDS = 14;

export function createChainOrderFlashback({ scene, kingdom, npcs, look, state }) {
  const group = new THREE.Group(); group.name = 'Flashback · The Chain Order'; scene.add(group);
  const castDefs = chainOrderCast(kingdom);
  const at = (u, v, h) => { const p = kingdom.at(u, v); return new THREE.Vector3(p.x, DIAMOND_BASE + h, p.z); };
  const a = kingdom.at(0, 0), b = kingdom.at(1, 0), yaw = Math.atan2(b.x - a.x, b.z - a.z);   // +u, into the hall
  const morcantAt = at(MORCANT_AT.u, MORCANT_AT.v, MORCANT_AT.h), table = at(CHAIN_TABLE.u, CHAIN_TABLE.v, CHAIN_TABLE.h);
  const smoke = createSmoke(group, 0xd8c27a), binding = createBeam(group, 0xb48cff, .1);
  const hand = new THREE.Vector3();

  // The pile of violet chain on the table: links appear one by one as the stage's `chains` grows.
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xb48cff, emissive: 0x5a1f9a, emissiveIntensity: 1, metalness: .7, roughness: .35 });
  const links = new THREE.InstancedMesh(new THREE.TorusGeometry(.09, .025, 4, 8), chainMat, LINKS);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < LINKS; i++) {
    const a = i * 2.39996, r = .08 + Math.sqrt(i / LINKS) * .55;
    dummy.position.set(table.x + Math.cos(a) * r, table.y + .04 + (1 - r / .63) * .22 + (i % 3) * .03, table.z + Math.sin(a) * r);
    dummy.rotation.set(i * .7, i * 1.3, i % 2 ? Math.PI / 2 : 0); dummy.updateMatrix(); links.setMatrixAt(i, dummy.matrix);
  }
  links.count = 0; group.add(links);
  // The relay conduit on the table, its scratched plea, and the shards it breaks into.
  const conduitPos = table.clone().add(new THREE.Vector3(0, .06, 0));
  const device = new THREE.Group(); device.position.copy(conduitPos); device.rotation.y = yaw; group.add(device);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: .8, roughness: .35 });
  const crystal = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0x3a6f9a, emissiveIntensity: .7, roughness: .1, flatShading: true });
  const base = new THREE.Mesh(new THREE.BoxGeometry(.7, .14, .7), brass); base.position.set(.55, .07, -.45);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .62, 6), crystal); core.rotation.z = Math.PI / 2; core.position.set(.55, .2, -.45);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(.34, .1), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0 }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(.55, .145, -.3);
  device.add(base, core, mark);
  const shards = Array.from({ length: SHARDS }, (_, i) => {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(.07, 0), crystal); s.visible = false; group.add(s);
    const ang = i / SHARDS * Math.PI * 2;
    return { s, v: new THREE.Vector3(Math.cos(ang) * (1 + i % 3 * .4), 2 + (i % 4) * .6, Math.sin(ang) * (1 + i % 3 * .4)) };
  });
  const conduitWorld = new THREE.Vector3();

  let cast = [], triad = null, playing = false;
  function begin() {
    playing = true; state.memory = true; npcs?.setHidden?.('*', true);     // today's villagers (Orin too) step aside
    cast = Object.entries(castDefs).map(([name, def]) => ({ name, def, actor: npcs?.actor?.(def) })).filter(c => c.actor);
    for (const c of cast) group.add(c.actor.group);
    triad = createTriad({ npcs, group });
    device.visible = true;
  }
  function update(t, dt) {
    if (!playing) return;
    const st = chainOrderStage(t);
    look.amount = st.amount; look.shimmer = st.shimmer; look.storm = st.storm;
    for (const c of cast) poseActor(c.actor, c.def.keys, c.def.face, t, dt, DIAMOND_BASE);
    // Only Morcant comes to the forge; Veyr and Sile stay away (presence 0).
    triad?.update(t, dt, { veyr: { x: 0, y: -50, z: 0, yaw }, sile: { x: 0, y: -50, z: 0, yaw }, morcant: { x: morcantAt.x, y: morcantAt.y, z: morcantAt.z, yaw } },
      { veyr: 0, sile: 0, morcant: st.morcant },
      { morcant: [st.binding > 0 ? 'Spell_Simple_Shoot' : 'Idle_FoldArms_Loop', st.binding > 0] });
    binding.set(triad?.hand('morcant', hand), table, st.binding * st.morcant);
    smoke.set(morcantAt, st.smoke, t);
    links.count = Math.round(st.chains * LINKS);
    chainMat.emissiveIntensity = .6 + .5 * Math.sin(t * 4);
    mark.material.opacity = st.mark * (.75 + .25 * Math.sin(t * 6));
    // The smash: the conduit vanishes and its shards fly and fall.
    device.visible = st.smash < 0;
    device.localToWorld(conduitWorld.set(.55, .2, -.45));
    for (const { s, v } of shards) {
      s.visible = st.smash >= 0 && st.smash < 3;
      if (s.visible) { const k = st.smash; s.position.set(conduitWorld.x + v.x * k * .6, Math.max(DIAMOND_BASE + .05, conduitWorld.y + v.y * k - 4.9 * k * k), conduitWorld.z + v.z * k * .6); s.rotation.y = k * 9; }
    }
  }
  function end() {
    if (!playing) return;
    playing = false; state.memory = false; look.amount = look.shimmer = look.storm = 0;
    for (const c of cast) c.actor.dispose();
    triad?.dispose(); cast = []; triad = null;
    smoke.set(morcantAt, 0, 0); binding.set(null, null, 0);
    links.count = 0; device.visible = false; for (const { s } of shards) s.visible = false;
    npcs?.setHidden?.('*', false);
  }
  device.visible = false;
  return { begin, update, end, get playing() { return playing; }, get actors() { return [...cast.map(c => c.name), ...Object.keys(triad?.members ?? {})]; } };
}
