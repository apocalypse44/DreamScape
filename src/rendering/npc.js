import { cloneSkinned } from './anim.js';
import { createIvenStyle } from './ivenStyle.js';

// Villagers of the Grimoire Tower: Quaternius mannequins + Universal Animation Library clips (CC0).
// They share the library's own skeleton, so every clip plays without retargeting.
// Each NPC reacts to the behavior score: calm visitors get a greeting, chaotic ones a refusal.
const UAL1 = encodeURI('assets/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const UAL2 = encodeURI('assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb');
const FEMALE = encodeURI('assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb');
const WALK_SPEED = 1.3; // m/s, matches Walk_Loop's stride
const GREET = 6;        // calm player within this range: NPC turns and talks
const REFUSE = 12;      // chaotic player within this range: NPC turns and shakes its head

// idle: clip when alone · path: walking loop (points around a home) · body: M or F · tint: robe color
export const VILLAGERS = [
  { name: 'Iven', body: 'M', tint: 0x293c37, home: [-40, -414], y: 12, idle: 'Idle_Loop', style: 'scholar' },
  { name: 'Shrine Keeper', body: 'F', tint: 0x2f6f8f, home: [4, -6], idle: 'Idle_FoldArms_Loop' },
  { name: 'Mage', body: 'M', tint: 0x7a2f2f, home: [-20, -16], idle: 'Spell_Simple_Idle_Loop' },
  { name: 'Lantern Guard', body: 'M', tint: 0x3b3b3b, home: [7, -42], idle: 'Idle_Lantern_Loop' },
  { name: 'Farmer', body: 'F', tint: 0x7a6a2f, home: [24, 21], idle: 'Farm_Watering' },
  { name: 'Ring Walker', body: 'F', tint: 0x4f7a3a, home: [0, 0], path: 'ring' },
  { name: 'Traveller', body: 'M', tint: 0x5a4a7a, home: [-34, 30], path: 'wander' },
  // Spade resistance guide, inside the Lantern Refuge (y: the refuge floor). Hooded, carrying a wisp lantern.
  { name: 'Neris', body: 'F', tint: 0x2e2448, home: [-368, -20], y: 1.65, idle: 'Idle_Lantern_Loop', hood: 0x1f1833, lantern: 0xd9c8ff, robe: 0x241c3a },
  // Diamond artificer beside the Shatterglass Relay. The game moves `home` to the relay at startup;
  // this default matches a Diamond gate at (0, 344).
  { name: 'Orin', body: 'M', tint: 0x6a5f4a, home: [11, 374], idle: 'Idle_FoldArms_Loop', robe: 0x3f4656 }
];
// Full robe silhouette, shoulders to floor, as [radius, height] fractions of the model's height.
// Hem → hips → belted waist → chest → shoulders → collar.
const ROBE_PROFILE = [[0.21, 0], [0.17, 0.25], [0.13, 0.48], [0.11, 0.58], [0.115, 0.7], [0.105, 0.8], [0.06, 0.855], [0.045, 0.87]];
// Hood and lantern follow these bones' world positions (offsets in metres); tune if they sit off.
const HOOD_LIFT = 0.1, LANTERN_DROP = 0.16, LANTERN_HAND = 'hand_r';

function stripRootMotion(clip) {
  for (const track of clip.tracks) {
    if (track.name !== 'root.position') continue;
    const v = track.values;
    for (let i = 3; i < v.length; i++) v[i] = v[i % 3];
  }
  return clip;
}

// blocked(x, z): an NPC standing there would be inside a structure (the game supplies it).
export function createNPCs({ scene, state, player, terrainHeight, hash, colliders, blocked = () => false, onReady }) {
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
  const clips = {};
  const loader = new THREE.GLTFLoader();
  const fetchBuffer = url => fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); });
  const parse = buffer => new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject));

  function play(npc, name) {
    if (npc.current === name || !clips[name]) return;
    const next = npc.actions[name] ||= npc.mixer.clipAction(clips[name]);
    next.reset().fadeIn(0.35).play();
    npc.actions[npc.current]?.fadeOut(0.35);
    npc.current = name;
  }

  // Walkers: the ring follows the plaza's stone circle; wanderers pick seeded points near home.
  function target(npc, t) {
    const [hx, hz] = npc.def.home;
    if (npc.def.path === 'ring') return [Math.cos(t * WALK_SPEED / 16) * 16, Math.sin(t * WALK_SPEED / 16) * 16];
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
  const bodies = {}; // loaded mannequins, reused by story actors
  const ready = Promise.all([fetchBuffer(UAL1), fetchBuffer(UAL2), fetchBuffer(FEMALE)]).then(async ([male, extra, female]) => {
    const maleAsset = await parse(male);
    for (const clip of maleAsset.animations) clips[clip.name] = stripRootMotion(clip);
    await nextFrame();
    for (const clip of (await parse(extra)).animations) clips[clip.name] = stripRootMotion(clip);
    await nextFrame();
    const femaleAsset = await parse(female);
    bodies.M = maleAsset; bodies.F = femaleAsset;
    for (const def of VILLAGERS) {
      await nextFrame();
      const model = cloneSkinned((def.body === 'F' ? femaleAsset : maleAsset).scene);
      model.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.frustumCulled = false;
        if (def.style === 'scholar') {
          // Cover both mannequin materials, including its purple joint panels.
          object.material = new THREE.MeshBasicMaterial({ color:def.tint, toneMapped:false, skinning:Boolean(object.isSkinnedMesh) });
        } else if (object.material.name === 'M_Main') {
          object.material = object.material.clone();
          object.material.color.set(def.tint);
        }
      });
      const group = new THREE.Group();
      group.add(model);
      root.add(group);
      const collider = { x: def.home[0], z: def.home[1], radius: 0.45, npc: true }; // npc: not an obstacle to other NPCs
      colliders.push(collider);
      const npc = { def, group, collider, mixer: new THREE.AnimationMixer(model), actions: {}, current: null, t: 0 };
      if (def.style === 'scholar') npc.style = createIvenStyle({ model, group, root });
      if (def.robe) {
        // Rides on the NPC's group (feet origin, turns with her); legs and hips stay hidden inside.
        const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
        const cloth = new THREE.MeshStandardMaterial({ color: def.robe, roughness: 0.9, side: THREE.DoubleSide });
        const gold = new THREE.MeshStandardMaterial({ color: 0xb8954a, roughness: 0.5, metalness: 0.4 });
        const profile = ROBE_PROFILE.map(([r, y]) => new THREE.Vector2(r * height, y * height));
        const robe = new THREE.Mesh(new THREE.LatheGeometry(profile, 18), cloth);
        robe.castShadow = true;
        const hem = new THREE.Mesh(new THREE.TorusGeometry(0.21 * height, 0.012 * height, 6, 32), gold);
        hem.rotation.x = Math.PI / 2; hem.position.y = 0.01 * height;
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.112 * height, 0.01 * height, 6, 28), gold);
        belt.rotation.x = Math.PI / 2; belt.position.y = 0.58 * height;
        group.add(robe, hem, belt);
      }
      if (def.hood) {
        // Open-faced hood: a sphere shell with a 90° gap facing forward (+z).
        npc.hood = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, Math.PI * 0.75, Math.PI * 1.5, 0, Math.PI * 0.68),
          new THREE.MeshStandardMaterial({ color: def.hood, roughness: 0.95, side: THREE.DoubleSide }));
        npc.head = model.getObjectByName('Head');
        root.add(npc.hood);
      }
      if (def.lantern) {
        npc.lantern = new THREE.Group();
        npc.lantern.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: def.lantern })));
        npc.lantern.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({
          color: def.lantern, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })));
        npc.hand = model.getObjectByName(LANTERN_HAND);
        root.add(npc.lantern);
      }
      place(npc);
      npcs.push(npc);
      play(npc, def.idle || 'Walk_Loop');
    }
    onReady?.(root);
  }).catch(error => console.warn('NPCs could not load.', error));

  return {
    ready,
    update(dt) {
      for (const npc of npcs) {
        const { def, group } = npc;
        const dx = player.position.x - group.position.x;
        const dz = player.position.z - group.position.z;
        const distance = Math.hypot(dx, dz);
        const chaotic = state.mode === 'chaos';
        const reacting = chaotic ? distance < REFUSE : distance < GREET;
        let yaw = group.rotation.y;
        if (reacting) {
          play(npc, chaotic ? 'Idle_No_Loop' : 'Idle_Talking_Loop');
          yaw = Math.atan2(dx, dz);
        } else if (def.path) {
          npc.t += dt;
          const [tx, tz] = target(npc, npc.t);
          const mx = tx - group.position.x, mz = tz - group.position.z;
          const gap = Math.hypot(mx, mz);
          const step = Math.min(gap, WALK_SPEED * dt);
          if (gap > 0.3 && blocked(group.position.x + mx / gap * step, group.position.z + mz / gap * step)) {
            npc.t += 12; // something stands in the way: head for the next spot instead
            play(npc, 'Idle_Loop');
          } else if (gap > 0.3) {
            group.position.x += mx / gap * step;
            group.position.z += mz / gap * step;
            yaw = Math.atan2(mx, mz);
            play(npc, 'Walk_Loop');
          } else {
            play(npc, 'Idle_Loop');
          }
        } else {
          // Scenery streams in after the NPCs; a home it covers moves once to the nearest free spot.
          // Checked every 2 s (chunks keep streaming) until it has had to move once.
          npc.checkIn = (npc.checkIn ?? 0) - dt;
          if (!npc.settled && def.y === undefined && npc.checkIn <= 0) {
            npc.checkIn = 2;
            const spot = blocked(def.home[0], def.home[1]) && freeSpot(def.home[0], def.home[1]);
            if (spot) { console.info(`NPC ${def.name} moved out of a structure`, def.home, '->', spot); def.home = spot; npc.settled = true; }
          }
          group.position.set(def.home[0], 0, def.home[1]);
          play(npc, def.idle);
        }
        const turn = Math.atan2(Math.sin(yaw - group.rotation.y), Math.cos(yaw - group.rotation.y));
        group.rotation.y += turn * (1 - Math.exp(-6 * dt));
        group.position.y = def.y ?? terrainHeight(group.position.x, group.position.z);
        npc.collider.x = group.position.x;
        npc.collider.z = group.position.z;
        npc.mixer.update(dt);
        npc.style?.update();
        if (npc.hood || npc.lantern) group.updateMatrixWorld(true);
        if (npc.hood && npc.head) {
          npc.head.getWorldPosition(npc.hood.position).y += HOOD_LIFT;
          npc.hood.rotation.y = group.rotation.y;
        }
        if (npc.lantern && npc.hand) {
          npc.hand.getWorldPosition(npc.lantern.position).y -= LANTERN_DROP;
          npc.lantern.scale.setScalar(1 + 0.08 * Math.sin(npc.t * 3));
          npc.t += def.path ? 0 : dt;
        }
      }
    },
    reset() { npcs.forEach(place); },
    // Hide or show a villager by name (a flashback stages its younger self instead).
    // name '*' hides every villager (a flashback shows the past, where they were not).
    setHidden(name, hidden) { for (const npc of npcs) if (name === '*' || npc.def.name === name) npc.group.visible = !hidden; },
    // A story actor on the villagers' mannequins and clips: { group, play(clip, fade), update(dt), dispose() },
    // or null until the NPC assets have loaded. robe: an optional long coat or cloak colour.
    actor({ body = 'M', tint = 0x4a5a4a, robe = null } = {}) {
      if (!bodies[body]) return null;
      const model = cloneSkinned(bodies[body].scene), group = new THREE.Group();
      model.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true; object.frustumCulled = false;
        object.material = object.material.clone(); object.material.color.set(tint);
      });
      group.add(model);
      if (robe !== null) {
        const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
        const coat = new THREE.Mesh(new THREE.LatheGeometry(ROBE_PROFILE.map(([r, y]) => new THREE.Vector2(r * height, y * height)), 18),
          new THREE.MeshStandardMaterial({ color: robe, roughness: .85, side: THREE.DoubleSide }));
        coat.castShadow = true; group.add(coat);
      }
      const mixer = new THREE.AnimationMixer(model), actions = {};
      let current = null;
      return {
        group, model, // model: for bones such as 'Head' that decorations follow
        play(name, fade = .3, once = false) {
          if (current === name || !clips[name]) return;
          const next = actions[name] ||= mixer.clipAction(clips[name]);
          next.reset(); next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); next.clampWhenFinished = once;
          next.fadeIn(fade).play(); actions[current]?.fadeOut(fade); current = name;
        },
        update(dt) { mixer.update(dt); },
        dispose() { mixer.stopAllAction(); group.parent?.remove(group); }, // r128 has no removeFromParent()
      };
    },
  };
}
