import { createAnimationCadence } from '../models/animationCadence.js';
import { createPerson, preloadPerson, personReady, villagerColors } from './person.js';
import { Burst } from './fx.js';
import { toast } from '../views/overlay.js';

// Villagers and story leads, all people-kit characters (src/assets/people, one shared clip pack).
// Each NPC reacts to the behavior score: calm visitors get a greeting, chaotic ones a refusal.
const WALK_SPEED = 1.3; // m/s, matches Walk_Loop's stride
const GREET = 6;        // calm player within this range: NPC turns and talks
const REFUSE = 12;      // chaotic player within this range: NPC turns and shakes its head

// person: their own recipe (else the shared villager recoloured by tint) · idle: clip when alone ·
// path: walking loop around home · y: fixed floor height · lantern: a glowing wisp lantern colour.
export const VILLAGERS = [
  { name: 'Iven', person: 'iven', tint: 0x293c37, home: [-40, -414], y: 12, idle: 'Idle_Loop' },
  // The Shrine Keeper is the quest NPC in people.js; no second copy here.
  { name: 'Mage', role: 'mage', tint: 0x7a2f2f, home: [-20, -16], idle: 'Spell_Simple_Idle_Loop' },
  { name: 'Lantern Guard', role: 'guard', tint: 0x3b3b3b, home: [7, -42], idle: 'Idle_Lantern_Loop', lantern: 0xffc76a },
  { name: 'Farmer', role: 'farmer', tint: 0x7a6a2f, home: [24, 21], idle: 'Farm_Watering' },
  { name: 'Pilgrim', role: 'pilgrim', tint: 0x4f7a3a, home: [0, 0], path: 'ring' },        // walks the plaza's stone circle
  { name: 'Cartographer', role: 'cartographer', tint: 0x5a4a7a, home: [-34, 30], path: 'wander' }, // not 'Traveller': that is the player
  // Spade resistance guide, inside the Lantern Refuge (y: the refuge floor), carrying a wisp lantern.
  { name: 'Neris', person: 'neris', tint: 0x2e2448, home: [-368, -20], y: 1.65, idle: 'Idle_Lantern_Loop', lantern: 0xd9c8ff },
  { name: 'Sera', role: 'guardian', tint: 0x8c354c, home: [355, 0], idle: 'Idle_FoldArms_Loop' },
  // Diamond artificer beside the Shatterglass Relay. The game moves `home` to the relay at startup;
  // this default matches a Diamond gate at (0, 344).
  { name: 'Orin', person: 'orin', tint: 0x6a5f4a, home: [11, 374], idle: 'Idle_FoldArms_Loop' },
];
// Story actors (flashbacks, the stockade) may name these recipes; everyone else is a villager.
const ACTOR_RECIPES = ['ivenYoung'];
const FLASHBACK_RECIPES = ['veyr', 'sile', 'morcant'];
const LANTERN_DROP = 0.16, LANTERN_HAND = 'hand_r'; // lantern hangs below the right hand
const ACT_COOLDOWN = 45; // seconds before the Farmer offers another sun-apple
// The Cartographer's directions (the story's compass: Clover north, Heart east, Diamond south, Spade west).
const ROUTES = [
  'CARTOGRAPHER · Clover lies north, past the falls. Its road grows if you ask it nicely.',
  'CARTOGRAPHER · Heart is east, beyond the clouds. Bring something that floats.',
  'CARTOGRAPHER · Diamond is south: sand, glass and a long quarry road. Mind the storms.',
  'CARTOGRAPHER · Spade is west. Walk in quietly; the lights there are people.',
];
const isNight = hour => hour >= 19 || hour < 6;

// blocked(x, z): an NPC standing there would be inside a structure (the game supplies it).
// hour(): the world clock's hour (the Lantern Guard lights his lantern and patrols at night).
export function createNPCs({ scene, state, player, terrainHeight, hash, colliders, blocked = () => false, onReady, hour = () => 12 }) {
  // The nearest free spot around (x, z), searching rings 0.5 m apart out to 6 m; null if none.
  function freeSpot(x, z) {
    for (let r = 0.5; r <= 6; r += 0.5) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a * Math.PI / 8) * r, pz = z + Math.sin(a * Math.PI / 8) * r;
      if (!blocked(px, pz)) return [px, pz];
    }
    return null;
  }
  const root = new THREE.Group();
  scene.add(root);
  const npcs = [];
  const play = (npc, name) => { if (!(npc.acting > 0)) npc.person.play(name); };
  const sparks = new Burst(scene, { color: 0xd8b8ff, count: 40, size: .12, gravity: -1, speed: [.5, 1.6], up: [.5, 1.5], life: 1, systems: 2 });
  const smoke = new Burst(scene, { color: 0x8a8a8a, count: 30, size: .22, gravity: -1.5, speed: [.2, .7], up: [.3, 1], life: 1.2, systems: 1 });
  const hand = new THREE.Vector3();
  // A one-shot act (a clip that holds the stage for a moment) with a face to match.
  function act(npc, clip, seconds, face) { npc.person.play(clip, .2, true); npc.acting = seconds; npc.face = face; }
  // What each villager does as you arrive: calm greetings and chaos refusals with some character.
  function greet(npc, chaotic) {
    const role = npc.def.role, palm = npc.person.model?.getObjectByName(LANTERN_HAND);
    if (palm) palm.getWorldPosition(hand); else hand.copy(npc.group.position);
    if (role === 'mage') {
      if (chaotic) { act(npc, 'Hit_Chest', 1.2, 'surprised'); smoke.fire(hand); } // the spell fizzles
      else { act(npc, 'Spell_Simple_Shoot', 1.4, 'joy'); sparks.fire(hand); }
    } else if (chaotic) return;
    else if (role === 'guard') act(npc, 'Yes', 1.4, 'smile');
    else if (role === 'pilgrim') { act(npc, 'Yes', 1.6, 'smile'); hand.y += .6; sparks.fire(hand); }
    else if (role === 'farmer' && !(npc.cool > 0)) {
      act(npc, 'PickUp_Table', 1.8, 'joy'); npc.cool = ACT_COOLDOWN;
      state.chaos = Math.max(.03, state.chaos - .12);
      toast('FARMER · Here, a sun-apple from the east field. Slow down and taste it.', 3200);
    } else if (role === 'cartographer' && !(npc.cool > 0)) {
      act(npc, 'Interact', 1.6, 'smile'); npc.cool = 20;
      npc.route = ((npc.route ?? -1) + 1) % ROUTES.length;
      toast(ROUTES[npc.route], 4200);
    }
  }
  // Step toward (x, z) at walking pace; true once there (or when the way is blocked).
  function walkTo(npc, x, z, dt) {
    const g = npc.group, mx = x - g.position.x, mz = z - g.position.z, gap = Math.hypot(mx, mz);
    if (gap < .3) return true;
    const step = Math.min(gap, WALK_SPEED * dt);
    if (blocked(g.position.x + mx / gap * step, g.position.z + mz / gap * step)) return true;
    g.position.x += mx / gap * step; g.position.z += mz / gap * step; npc.yaw = Math.atan2(mx, mz);
    return false;
  }

  // Walkers: the ring follows the plaza's stone circle; wanderers pick seeded points near home.
  function target(npc, t) {
    const [hx, hz] = npc.def.home;
    if (npc.def.path === 'ring') return [Math.cos(t * WALK_SPEED / 16) * 16, Math.sin(t * WALK_SPEED / 16) * 16];
    if (npc.patrol) { const c = Math.floor(t / 6) % 4; return [hx + (c === 1 || c === 2 ? 3 : -3), hz + (c >= 2 ? 3 : -3)]; } // the guard's night beat
    const leg = Math.floor(t / 12); // a new spot every 12 s
    return [hx + (hash(leg, 41) - 0.5) * 30, hz + (hash(41, leg) - 0.5) * 30];
  }

  // Start position: walkers begin on their route (never on the spawn point), others at home.
  function place(npc) {
    npc.t = hash(npc.def.home[0], npc.def.home[1]) * 50;
    const [x, z] = npc.def.path ? target(npc, npc.t) : npc.def.home;
    npc.group.position.set(x, 0, z);
    npc.collider.x = x;
    npc.collider.z = z;
  }

  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const recipes = new Set(['villager', ...ACTOR_RECIPES, ...VILLAGERS.map(d => d.person).filter(Boolean)]);
  const ready = Promise.all([...recipes].map(preloadPerson)).then(async () => {
    for (const [index, def] of VILLAGERS.entries()) {
      await nextFrame();
      const person = createPerson({ name: def.person || 'villager', colors: def.person ? null : villagerColors(def.tint, index) });
      const group = new THREE.Group(); group.add(person.root); root.add(group);
      const collider = { x: def.home[0], z: def.home[1], radius: 0.45, npc: true }; // npc: not an obstacle to other NPCs
      colliders.push(collider);
      const npc = { def, group, collider, person, t: 0, animationStep: createAnimationCadence(hash(def.home[0], def.home[1])) };
      if (def.lantern) {
        npc.lantern = new THREE.Group();
        npc.lantern.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: def.lantern })));
        npc.lantern.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({
          color: def.lantern, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })));
        npc.hand = person.model?.getObjectByName(LANTERN_HAND);
        root.add(npc.lantern);
      }
      place(npc);
      npcs.push(npc);
      play(npc, def.idle || 'Walk_Loop');
    }
    onReady?.(root);
    for (const name of FLASHBACK_RECIPES) preloadPerson(name); // ready long before any flashback
  }).catch(error => console.warn('NPCs could not load.', error));

  return {
    ready,
    update(dt) {
      sparks.update(dt); smoke.update(dt);
      const night = isNight(hour());
      for (const npc of npcs) {
        const { def, group } = npc;
        const dx = player.position.x - group.position.x;
        const dz = player.position.z - group.position.z;
        const distance = Math.hypot(dx, dz);
        const chaotic = state.mode === 'chaos';
        const reacting = chaotic ? distance < REFUSE : distance < GREET;
        npc.acting = (npc.acting ?? 0) - dt; npc.cool = (npc.cool ?? 0) - dt;
        if (npc.acting <= 0) npc.face = null;
        if (reacting && !npc.wasReacting) greet(npc, chaotic);
        npc.wasReacting = reacting;
        npc.patrol = def.role === 'guard' && night;
        npc.yaw = group.rotation.y;
        if (def.role === 'pilgrim' && !(npc.pray > 0)) { // she kneels at a marker every quarter of the circle
          const marker = Math.floor(npc.t * WALK_SPEED / 16 / (Math.PI / 2));
          if (npc.marker !== undefined && marker !== npc.marker) npc.pray = 4;
          npc.marker = marker;
        }
        if (reacting) {
          play(npc, chaotic ? 'Idle_No_Loop' : 'Idle_Talking_Loop');
          npc.yaw = Math.atan2(dx, dz);
        } else if (npc.pray > 0) { // the Pilgrim kneels at a marker on the circle
          npc.pray -= dt; play(npc, 'Fixing_Kneeling');
        } else if (def.path || npc.patrol) {
          npc.t += dt;
          const [tx, tz] = target(npc, npc.t);
          if (walkTo(npc, tx, tz, dt)) {
            if (Math.hypot(tx - group.position.x, tz - group.position.z) >= .3) npc.t += 12; // blocked: head for the next spot
            play(npc, def.role === 'cartographer' ? 'Interact' : npc.patrol ? 'Idle_Lantern_Loop' : 'Idle_Loop'); // he sketches the view
          } else play(npc, 'Walk_Loop');
        } else {
          // Scenery streams in after the NPCs; a home it covers moves once to the nearest free spot.
          // Checked every 2 s (chunks keep streaming) until it has had to move once.
          npc.checkIn = (npc.checkIn ?? 0) - dt;
          if (!npc.settled && def.y === undefined && npc.checkIn <= 0) {
            npc.checkIn = 2;
            const spot = blocked(def.home[0], def.home[1]) && freeSpot(def.home[0], def.home[1]);
            if (spot) { console.info(`NPC ${def.name} moved out of a structure`, def.home, '->', spot); def.home = spot; npc.settled = true; }
          }
          // At the post (the guard walks home at dawn instead of snapping there).
          if (walkTo(npc, def.home[0], def.home[1], dt)) play(npc, def.idle); else play(npc, 'Walk_Loop');
        }
        const turn = Math.atan2(Math.sin(npc.yaw - group.rotation.y), Math.cos(npc.yaw - group.rotation.y));
        group.rotation.y += turn * (1 - Math.exp(-6 * dt));
        group.position.y = def.y ?? terrainHeight(group.position.x, group.position.z);
        npc.collider.x = group.position.x;
        npc.collider.z = group.position.z;
        if (npc.lantern) npc.lantern.visible = group.visible && (def.role !== 'guard' || night); // lit at dusk
        const animationDt = npc.animationStep(dt, distance, group.visible);
        if (!animationDt) continue;
        npc.person.update(animationDt, { look: reacting ? player.position : null, expression: npc.face || (reacting ? (chaotic ? 'focus' : 'smile') : 'neutral') });
        if (npc.lantern && npc.hand) {
          group.updateMatrixWorld(true);
          npc.hand.getWorldPosition(npc.lantern.position).y -= LANTERN_DROP;
          npc.glow = (npc.glow ?? 0) + dt;
          npc.lantern.scale.setScalar(1 + 0.08 * Math.sin(npc.glow * 3));
        }
      }
    },
    get list() { return npcs; }, // debugging: dreamscape.npcs.list
    reset() { npcs.forEach(place); },
    // Hide or show a villager by name (a flashback stages its younger self instead).
    // name '*' hides every villager (a flashback shows the past, where they were not).
    setHidden(name, hidden) {
      for (const npc of npcs) if (name === '*' || npc.def.name === name) { npc.group.visible = !hidden; if (npc.lantern) npc.lantern.visible = !hidden; }
    },
    // A story actor: { group, model, play(clip, fade, once), update(dt), dispose() }, or null until the
    // people kit has loaded. person: a recipe name (e.g. 'ivenYoung', 'orin'); otherwise a villager in `tint`.
    actor({ tint = 0x4a5a4a, person = null } = {}) {
      const name = person || 'villager';
      if (!personReady(name)) return null;
      const p = createPerson({ name, colors: person ? null : villagerColors(tint, Math.round(tint / 97) % 7) });
      return {
        group: p.root, model: p.model,
        play: (clip, fade = .3, once = false) => p.play(clip, fade, once),
        update: dt => p.update(dt),
        dispose: () => p.dispose(),
      };
    },
  };
}
