// "The Quiet Springs": the Listening Spring's memory of how the Dark Triad stole Heart's current, played
// when you first speak to Sera. cloverScenes.js flies the camera and shows the captions; this module stages
// the past on the real reef and town: the memory look, Tidewell alive and then drying, the three springs on
// the reef's buried ground, Sile's Diamond-made siphon drinking them, Sera hiding the water spirit, Queen
// Elowen taken through Morcant's rift with the siphon, and Veyr's chains closing round each buried island.
// Timeline and cast: src/models/heartStory.js. While it plays the present steps aside: the risen reef and its
// water hide (heart.setPast), the crater closes (game.js reads `playing`), Tidewell is shown alive
// (tidewell.setMemory) and today's villagers are hidden.
import { poseActor, createTriad, createSmoke, createBeam } from './flashback.js';
import { heartPastStage, heartPastCast, HEART_PAST_TRIAD, SIPHON_UP } from '../models/heartStory.js';
import { createWaterSurface } from '../rendering/waterfall.js';
import { createWaterSpirit } from '../rendering/waterSpirit.js';

// heart: the reef renderer ({ setPast }); tidewell: the town renderer ({ setMemory }); groundAt(x, z): the
// ground height (the crater is closed while this plays).
export function createHeartPastFlashback({ scene, layout, npcs, look, state, groundAt, heart, tidewell }) {
  const group = new THREE.Group(); group.name = 'Flashback · The Quiet Springs'; group.visible = false; scene.add(group);
  const castDefs = heartPastCast(layout);
  const point = (p, up = 0) => new THREE.Vector3(p.x, groundAt(p.x, p.z) + up, p.z);
  const reef = () => point(layout.reef);
  const towardTown = Math.atan2(layout.gate.x - layout.reef.x, layout.gate.z - layout.reef.z);

  // The three springs on the reef's ground: a column of water and a pool, drained by the siphon.
  const fall = createWaterSurface('fall'), pool = createWaterSurface('lake');
  const springs = layout.checkpoints.map(c => {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 6, 14, 1, true), fall);
    const basin = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), pool); basin.rotation.x = -Math.PI / 2;
    group.add(column, basin);
    return { c, column, basin, beam: createBeam(group, 0x7af5ff, 0.14) };
  });
  // The siphon: a brass ring round a teal crystal heart, Diamond's maker's mark in gold on its rim.
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.8, roughness: 0.35 });
  const siphon = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.26, 8, 28), brass);
  const heartGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0x7af5ff, emissive: 0x1f8a9a, emissiveIntensity: 1.2, roughness: 0.1, flatShading: true }));
  heartGem.scale.y = 1.5;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd36b, side: THREE.DoubleSide }));
  mark.position.set(0, 0, 1.75);
  siphon.add(ring, heartGem, mark);
  for (let k = 0; k < 4; k++) { const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 5), brass); spoke.rotation.z = Math.PI / 2; spoke.rotation.y = k * Math.PI / 4; siphon.add(spoke); }
  group.add(siphon);
  const harvest = createBeam(group, 0xff3355, 0.18);
  // Morcant's rift: a dark disc with a violet rim, opening under the siphon.
  const rift = new THREE.Group();
  const riftDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x12051f }));
  const riftRim = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.02, 48), new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  riftRim.position.z = 0.01;
  rift.add(riftDisc, riftRim); rift.rotation.x = -Math.PI / 2; group.add(rift);
  const gateBeam = createBeam(group, 0xd8c27a, 0.14);
  // Veyr's chains: a glowing violet loop round each buried island, closing one after another.
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xb48cff, emissive: 0x5a1f9a, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.35 });
  const loops = layout.islands.map(island => {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(island.radius * 0.95, 0.22, 6, 40), chainMat);
    loop.rotation.x = -Math.PI / 2; group.add(loop);
    return { island, loop };
  });
  const binding = createBeam(group, 0x9b6bff, 0.16);
  const smoke = createSmoke(group, 0xff3355);
  const spirit = createWaterSpirit(); group.add(spirit.root);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.12, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd36b, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }));
  crown.position.y = 1.86;

  const triadAt = {};
  const hand = new THREE.Vector3(), siphonAt = new THREE.Vector3(), riftAt = new THREE.Vector3(), target = new THREE.Vector3();
  let cast = [], triad = null, playing = false;
  function begin() {
    playing = true; state.memory = true; group.visible = true;
    npcs?.setHidden?.('*', true); // today's villagers (Sera and the townsfolk too) step aside
    heart?.setPast?.(true);
    cast = Object.entries(castDefs).map(([name, def]) => ({ name, def, actor: npcs?.actor?.(def) })).filter(c => c.actor);
    for (const c of cast) { group.add(c.actor.group); if (c.def.crown) c.actor.group.add(crown); }
    triad = createTriad({ npcs, group });
    for (const [name, p] of Object.entries(HEART_PAST_TRIAD)) {
      const w = layout.at(p.along, p.side);
      triadAt[name] = { x: w.x, y: groundAt(w.x, w.z) + p.up, z: w.z, yaw: towardTown };
    }
  }
  function update(t, dt) {
    if (!playing) return;
    const st = heartPastStage(t);
    look.amount = st.amount; look.shimmer = st.shimmer; look.storm = st.storm;
    tidewell?.setMemory?.(st.life);
    fall.uniforms.uTime.value = pool.uniforms.uTime.value = t;
    const centre = reef();
    // Springs: full columns that shrink as the siphon drinks; a beam carries each one up to it.
    siphonAt.set(centre.x, centre.y + SIPHON_UP - st.sink * 14, centre.z);
    for (const s of springs) {
      const g = point(s.c), full = 1 - st.drain;
      s.column.visible = full > 0.02; s.column.scale.set(1, Math.max(0.01, full), 1); s.column.position.set(g.x, g.y + 3 * full, g.z);
      s.basin.visible = full > 0.02; s.basin.scale.setScalar(0.3 + 0.7 * full); s.basin.position.set(g.x, g.y + 0.08, g.z);
      s.beam.set(target.set(g.x, g.y + 6 * full, g.z), siphonAt, st.harvest);
    }
    siphon.visible = st.siphon > 0 && st.sink < 1;
    siphon.position.copy(siphonAt); siphon.scale.setScalar(Math.max(0.01, st.siphon));
    siphon.rotation.y = t * 1.2 + towardTown;
    heartGem.material.emissiveIntensity = 0.6 + st.harvest * 1.4 + 0.2 * Math.sin(t * 6);
    rift.visible = st.rift > 0; rift.position.set(centre.x, centre.y + 0.1, centre.z); rift.scale.setScalar(Math.max(0.01, st.rift * 9));
    riftRim.material.opacity = 0.6 + 0.4 * Math.sin(t * 5);
    riftAt.set(centre.x, centre.y + 0.2, centre.z);
    // The cast walks on the ground; the queen is dragged into the rift and sinks out of sight.
    for (const c of cast) {
      poseActor(c.actor, c.def.keys, c.def.face, t, dt, 0);
      const g = c.actor.group; g.position.y = groundAt(g.position.x, g.position.z);
      if (c.name === 'queen') { g.position.y -= st.taken * 3; g.visible = st.taken < 1; }
    }
    // The water spirit sits by Sera at the Listening Spring until she sends it down into the stone.
    const sera = cast.find(c => c.name === 'sera')?.actor.group;
    if (sera) {
      const sx = sera.position.x + 1.1, sz = sera.position.z + 0.6;
      spirit.root.position.set(sx, groundAt(sx, sz) - st.hide * 0.9, sz);
      spirit.root.scale.setScalar(Math.max(0.01, 1 - st.hide));
      spirit.root.visible = st.hide < 1;
      spirit.update(dt);
    } else spirit.root.visible = false;
    triad?.update(t, dt, triadAt, { veyr: st.triad, sile: st.triad, morcant: st.triad }, {
      sile: [st.harvest > 0 ? 'Spell_Simple_Shoot' : 'Spell_Simple_Idle_Loop', st.harvest > 0],
      morcant: [st.gate > 0 ? 'Spell_Simple_Shoot' : 'Idle_FoldArms_Loop', st.gate > 0],
      veyr: [st.binding > 0 ? 'Spell_Simple_Shoot' : 'Idle_FoldArms_Loop', st.binding > 0],
    });
    harvest.set(triad?.hand('sile', hand), siphonAt, st.harvest * st.triad);
    gateBeam.set(triad?.hand('morcant', target), riftAt, st.gate * st.triad);
    // The chains close round each island in turn; Veyr's beam reaches for the one closing now.
    const n = loops.length;
    loops.forEach(({ island, loop }, i) => {
      const k = Math.min(1, Math.max(0, st.chains * n - i));
      loop.visible = k > 0;
      const g = point(island); loop.position.set(g.x, g.y + 0.3, g.z); loop.scale.setScalar(Math.max(0.01, 1.6 - 0.6 * k));
    });
    chainMat.emissiveIntensity = 0.9 + 0.4 * Math.sin(t * 5);
    const closing = loops[Math.min(n - 1, Math.floor(st.chains * n))];
    binding.set(triad?.hand('veyr', hand), closing ? point(closing.island, 0.3) : null, st.binding * st.triad);
    smoke.set(target.set(triadAt.sile?.x ?? centre.x, triadAt.sile?.y ?? centre.y, triadAt.sile?.z ?? centre.z), st.smoke, t);
  }
  function end() {
    if (!playing) return;
    playing = false; state.memory = false; group.visible = false; look.amount = look.shimmer = look.storm = 0;
    crown.parent?.remove(crown);
    for (const c of cast) c.actor.dispose();
    triad?.dispose(); cast = []; triad = null;
    tidewell?.setMemory?.(null);
    heart?.setPast?.(false);
    npcs?.setHidden?.('*', false);
  }
  return { begin, update, end, get playing() { return playing; }, get actors() { return [...cast.map(c => c.name), ...Object.keys(triad?.members ?? {})]; } };
}
