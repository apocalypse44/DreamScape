// Lore NPCs: the shrine keeper and one wanderer per theme. A finite state machine per NPC
// (idle / walk / talk / scared) with speech bubbles; they flee a sprinting player in chaos.
// Bodies = UAL Female Mannequin; clips = UAL1 + UAL2 (same skeleton).
import { turnTowards, stepTowards } from './anim.js';
import { Bubble } from '../views/overlay.js';
import { makeRng, subSeed } from '../models/rng.js';
import { createPerson, villagerColors } from './person.js';
import { createKeeperRoutine } from '../models/keeperRoutine.js';
import {
  NPC_TINTS, NPC_HEIGHT, TALK_DISTANCE, SCARE_DISTANCE,
  NPC_ACTIVE_RADIUS, WANDER_RADIUS, CHAOS_ENTER, CHAOS_CALM,
} from '../models/encounterConfig.js';

// Place seeded, separated lore characters around the Crossing so they are easy to find.
export function findCrossingHomes(rng, terrainHeight, themes, blocked) {
  const homes = {};
  for (const theme of themes) {
    let home = null;
    for (let attempt = 0; attempt < 1000 && !home; attempt++) {
      const angle = rng() * Math.PI * 2;
      const radius = 24 + rng() * 48;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const separated = Object.values(homes).every((point) => Math.hypot(point.x - x, point.z - z) >= 16);
      if (separated && !blocked(x, z)) {
        home = new THREE.Vector3(x, terrainHeight(x, z), z);
      }
    }
    if (!home) throw new Error(`Unable to find an NPC home for "${theme}".`);
    homes[theme] = home;
  }
  return homes;
}

export class People {
  // blocked(x, z): true inside the shrine, landmarks or props, so NPCs walk around them.
  // colliders: the shared static list the player collides with (live entries; npc: true means
  // other NPCs ignore them). Each NPC adds one and keeps it on its feet.
  constructor({ scene, terrainHeight, seed, blocked, colliders = [] }) {
    this.colliders = colliders;
    this.scene = scene;
    this.terrainHeight = terrainHeight;
    this.blocked = blocked;
    this.seed = seed;
    this.npcs = [];
    this.clips = { idle: 'Idle_Loop', walk: 'Walk_Loop', talk: 'Idle_Talking_Loop', scared: 'Crouch_Idle_Loop', flee: 'Jog_Fwd_Loop' };
  }

  _create({ kind, home, line, yaw = 0, personName = 'villager', colors = null }) {
    // A people-kit character (src/assets/people/<name>.glb): body, face and clips.
    const person = createPerson({ name: personName, height: NPC_HEIGHT, colors });
    const root = new THREE.Group();
    root.add(person.root);
    root.position.set(home.x, this.terrainHeight(home.x, home.z), home.z);
    root.rotation.y = yaw;
    this.scene.add(root);
    const player = { play: clip => person.play(clip), stop() {} };
    const npc = {
      kind, root, model: person.root, player, line, person, lookAt: null, face: null, talking: false,
      home: home.clone(), target: null, state: 'idle', timer: 1,
      rng: makeRng(subSeed(this.seed, this.npcs.length + 1)),
      bubble: new Bubble(),
    };
    player.play(this.clips.idle);
    npc.collider = { x: home.x, z: home.z, radius: 0.42, npc: true };
    this.colliders.push(npc.collider);
    this.npcs.push(npc);
    return npc;
  }

  // lineFn() returns the text to show, e.g. the shrine line for the quest stage.
  // shrine: { x, z } centre; the keeper tends candle spots around it between visitors.
  spawnKeeper(pos, lineFn, yaw = 0, { shrine = null } = {}) {
    const keeper = this._create({ kind: 'keeper', home: pos, line: lineFn, yaw, personName: 'shrineKeeper' });
    keeper.spots = []; keeper.shrine = shrine;
    if (shrine) {
      const radius = Math.max(2.2, Math.hypot(pos.x - shrine.x, pos.z - shrine.z)), base = Math.atan2(pos.x - shrine.x, pos.z - shrine.z);
      for (const turn of [.7, -.7, 1.4, -1.4]) {
        const x = shrine.x + Math.sin(base + turn) * radius, z = shrine.z + Math.cos(base + turn) * radius;
        if (!this.blocked(x, z) && keeper.spots.length < 3) keeper.spots.push({ x, z });
      }
    }
    keeper.routine = createKeeperRoutine({ spots: keeper.spots.length, random: keeper.rng });
    return keeper;
  }

  get keeper() { return this.npcs.find(n => n.kind === 'keeper') ?? null; }

  spawnWanderers(homes, hints) {
    for (const [biome, home] of Object.entries(homes)) {
      const text = hints[biome] || '...';
      const tint = NPC_TINTS[biome] ?? 0xcccccc;
      this._create({ kind: 'wanderer', home, line: () => text, colors: villagerColors(tint, this.npcs.length + 2) });
    }
  }

  // Step toward (x, z); returns 'arrived', 'blocked' (stays put) or 'moving'.
  _move(n, x, z, speed, dt, arriveDist) {
    const { x: ox, z: oz } = n.root.position;
    if (stepTowards(n.root, x, z, speed, dt, (gx, gz) => this.terrainHeight(gx, gz), arriveDist)) return 'arrived';
    // Already overlapping (a prop loaded on top of it): let it walk out instead of freezing.
    if (!this.blocked(n.root.position.x, n.root.position.z) || this.blocked(ox, oz)) return 'moving';
    n.root.position.x = ox;
    n.root.position.z = oz;
    return 'blocked';
  }

  // info = { playerPos, sprinting, chaos, camera, renderer }
  update(dt, info) {
    const p = info.playerPos;

    for (const n of this.npcs) {
      n.collider.x = n.root.position.x; n.collider.z = n.root.position.z;
      const d = n.root.position.distanceTo(p);
      // far away: hide and skip (performance)
      const far = d > NPC_ACTIVE_RADIUS;
      n.root.visible = !far;
      if (far) { n.bubble.hide(); continue; }
      // Chaos reshapes the terrain under standing NPCs too, so keep their feet on it every frame.
      n.root.position.y = this.terrainHeight(n.root.position.x, n.root.position.z);

      n.person.update(dt, { look: n.lookAt, expression: n.face, talking: n.talking });
      n.lookAt = null; n.face = null; n.talking = false;
      if (info.cinematic) {
        const speaking = n.kind === 'keeper' && info.speaker === 'SHRINE KEEPER';
        if (n.person) { n.lookAt = p; n.talking = speaking; n.face = speaking ? info.face || 'smile' : 'smile'; }
        n.state = speaking ? 'talk' : 'idle';
        n.player.play(speaking ? this.clips.talk || this.clips.idle : this.clips.idle);
        if (n.kind === 'keeper') turnTowards(n.root, p.x, p.z, dt, 5);
        n.bubble.hide();
        continue;
      }
      n.timer -= dt;

      // The keeper never flees: in chaos she raises a calming hand and watches until it passes.
      if (n.kind === 'keeper' && info.chaos > CHAOS_ENTER && d < 12) {
        n.bubble.hide(); n.state = 'halt'; n.player.play('Idle_No_Loop');
        n.lookAt = p; n.face = 'focus'; turnTowards(n.root, p.x, p.z, dt, 4);
        continue;
      }
      // scared: high chaos and the player sprints close by
      if (n.kind !== 'keeper' && n.state !== 'scared' && info.chaos > CHAOS_ENTER && info.sprinting && d < SCARE_DISTANCE) {
        n.state = 'scared';
        n.timer = 1.5; // run for 1.5 s, then cower
        n.player.play(this.clips.flee || this.clips.walk);
      }
      if (n.state === 'scared') {
        n.bubble.hide();
        if (n.timer > 0) {
          const ax = n.root.position.x * 2 - p.x;
          const az = n.root.position.z * 2 - p.z;
          if (this._move(n, ax, az, 3.5, dt, 0) === 'blocked') n.timer = 0; // cornered: cower here
        } else {
          n.player.play(this.clips.scared || this.clips.idle);
          turnTowards(n.root, p.x, p.z, dt, 4);
        }
        if (info.chaos < CHAOS_CALM) { n.state = 'idle'; n.timer = 1; n.player.play(this.clips.idle); }
        continue;
      }

      // talk: player close and calm
      if (d < TALK_DISTANCE && info.chaos < CHAOS_CALM) {
        if (n.state !== 'talk') { n.state = 'talk'; n.player.play(this.clips.talk || this.clips.idle); }
        turnTowards(n.root, p.x, p.z, dt, 5);
        n.lookAt = p; n.face = 'smile';
        n.bubble.setText(n.line());
        const head = n.root.position.clone();
        head.y += NPC_HEIGHT + 0.35;
        n.bubble.showAt(head, info.camera, info.renderer);
        continue;
      }
      n.bubble.hide();
      if (n.state === 'talk') { n.state = 'idle'; n.timer = 1.5; n.player.play(this.clips.idle); }

      // The keeper's routine: watch visitors, tend candles around the shrine, greet the dog.
      if (n.kind === 'keeper') {
        const dog = info.dogPos, dogDistance = dog ? Math.hypot(dog.x - n.root.position.x, dog.z - n.root.position.z) : Infinity;
        const goal = n.routine.mode === 'toSpot' ? n.spots[n.routine.spot] : n.home;
        const arrived = Math.hypot(goal.x - n.root.position.x, goal.z - n.root.position.z) < .45;
        const plan = n.routine.update(dt, { arrived, playerDistance: d, dogDistance });
        if (plan.walk) {
          const target = plan.mode === 'toSpot' ? n.spots[plan.spot] : n.home;
          if (this._move(n, target.x, target.z, 1.2, dt, .4) === 'blocked') { n.root.position.x = n.home.x; n.root.position.z = n.home.z; }
        } else if (plan.mode === 'pet' && dog) turnTowards(n.root, dog.x, dog.z, dt, 4);
        else if (plan.mode === 'tend' && n.shrine) turnTowards(n.root, n.shrine.x, n.shrine.z, dt, 3); // kneel facing the shrine
        else if (d < 10) turnTowards(n.root, p.x, p.z, dt, 2);
        n.state = plan.walk ? 'walk' : 'idle';
        n.player.play(plan.clip);
        n.lookAt = plan.look === 'player' ? (d < 10 ? p : null) : plan.look === 'dog' ? dog : null;
        n.face = plan.expression || (d < 10 ? 'smile' : 'neutral');
        continue;
      }

      // wander: idle -> pick a point within WANDER_RADIUS of home -> walk -> idle
      if (n.state === 'idle' && n.timer <= 0) {
        const a = n.rng() * Math.PI * 2;
        const r = 4 + n.rng() * (WANDER_RADIUS - 4);
        const x = n.home.x + Math.cos(a) * r;
        const z = n.home.z + Math.sin(a) * r;
        // skip points that drop into a chasm (relative to home's current ground) or sit in an obstacle
        if (this.terrainHeight(x, z) > this.terrainHeight(n.home.x, n.home.z) - 3 && !this.blocked(x, z)) {
          n.target = { x, z };
          n.state = 'walk';
          n.player.play(this.clips.walk || this.clips.idle);
        } else {
          n.timer = 0.5;
        }
      }
      if (n.state === 'walk') {
        if (this._move(n, n.target.x, n.target.z, 1.4, dt, 0.4) !== 'moving') {
          n.state = 'idle';
          n.timer = 2 + n.rng() * 3;
          n.player.play(this.clips.idle);
        }
      }
    }
  }

  dispose() {
    for (const n of this.npcs) {
      n.player.stop();
      n.bubble.dispose();
      n.person.dispose();
      this.scene.remove(n.root);
      const at = this.colliders.indexOf(n.collider); if (at >= 0) this.colliders.splice(at, 1);
      n.root.traverse((o) => {
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }
    this.npcs = [];
  }
}
