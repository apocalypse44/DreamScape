// NPCs: shrine keeper (3.9), one wanderer per biome (3.10),
// chaos reactions (3.11), speech bubbles (3.12).
// Bodies = UAL Female Mannequin; clips = UAL1 + UAL2 (same skeleton).
import { THREE } from './deps.js';
import { cloneSkinned, makeActionPlayer, resolveClips, turnTowards, stepTowards, normalizeHeight } from './anim.js';
import { Bubble } from './hud.js';
import { makeRng, subSeed } from './rng.js';
import {
  NPC_CLIPS, NPC_TINTS, NPC_YAW_OFFSET, NPC_HEIGHT, TALK_DISTANCE, SCARE_DISTANCE,
  NPC_ACTIVE_RADIUS, WANDER_RADIUS, CHAOS_ENTER, CHAOS_CALM,
} from './config.js';

// Place seeded, separated lore characters around the Crossing so they are easy to find.
export function findCrossingHomes(rng, terrainHeight, themes) {
  const homes = {};
  for (const theme of themes) {
    let home = null;
    for (let attempt = 0; attempt < 1000 && !home; attempt++) {
      const angle = rng() * Math.PI * 2;
      const radius = 24 + rng() * 48;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const separated = Object.values(homes).every((point) => Math.hypot(point.x - x, point.z - z) >= 16);
      if (separated) {
        home = new THREE.Vector3(x, terrainHeight(x, z), z);
      }
    }
    if (!home) throw new Error(`Unable to find an NPC home for "${theme}".`);
    homes[theme] = home;
  }
  return homes;
}

function makeFallbackPerson(tint) {
  const model = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8b59a, roughness: 0.9 });
  const limb = (x, y, z, length, material, radius = 0.08) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, length, 7), material);
    mesh.position.set(x, y, z);
    model.add(mesh);
    return mesh;
  };
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.82, 8), cloth);
  torso.position.y = 1.02;
  model.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.y = 1.58;
  model.add(head);
  const arms = [limb(-0.34, 1.06, 0, 0.66, cloth), limb(0.34, 1.06, 0, 0.66, cloth)];
  const legs = [limb(-0.13, 0.38, 0, 0.7, skin, 0.09), limb(0.13, 0.38, 0, 0.7, skin, 0.09)];
  return { model, torso, arms, legs };
}

export class People {
  // assets = { mannequin: gltf, ual1: gltf, ual2: gltf }
  constructor({ scene, assets, terrainHeight, seed }) {
    this.scene = scene;
    this.terrainHeight = terrainHeight;
    this.seed = seed;
    this.npcs = [];
    this.template = assets?.mannequin?.scene ?? null;
    const clips = [
      ...(assets?.ual1?.animations || []),
      ...(assets?.ual2?.animations || []),
      ...(assets?.mannequin?.animations || []),
    ];
    this.clips = resolveClips('npc', clips, NPC_CLIPS);
    if (!this.template) console.warn('[phase3] NPC model assets unavailable; using procedural character fallbacks.');
    else if (!this.clips.idle) console.warn('[phase3] No idle clip found for NPCs; edit NPC_CLIPS in config.js');
  }

  _create({ kind, home, tint, line, yaw = 0 }) {
    // container moves on the ground; model inside is scaled + feet at y=0
    const fallback = !this.template;
    const fallbackParts = fallback ? makeFallbackPerson(tint) : null;
    const model = fallback ? fallbackParts.model : cloneSkinned(this.template);
    if (!fallback) {
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.color && m.color.set(tint));
      });
      normalizeHeight(model, NPC_HEIGHT);
    }
    const root = new THREE.Group();
    root.add(model);
    root.position.set(home.x, this.terrainHeight(home.x, home.z), home.z);
    root.rotation.y = yaw;
    this.scene.add(root);

    const mixer = fallback ? null : new THREE.AnimationMixer(model);
    const player = fallback ? { play() {}, stop() {} } : makeActionPlayer(mixer);
    const npc = {
      kind, root, model, mixer, player, line, fallbackParts,
      home: home.clone(), target: null, state: 'idle', timer: 1,
      animationTime: 0,
      rng: makeRng(subSeed(this.seed, this.npcs.length + 1)),
      bubble: new Bubble(),
    };
    player.play(this.clips.idle);
    this.npcs.push(npc);
    return npc;
  }

  // lineFn() returns the text to show, e.g. the shrine line for the quest stage.
  spawnKeeper(pos, lineFn, yaw = 0) {
    return this._create({ kind: 'keeper', home: pos, tint: NPC_TINTS.keeper, line: lineFn, yaw });
  }

  spawnWanderers(homes, hints) {
    for (const [biome, home] of Object.entries(homes)) {
      const text = hints[biome] || '...';
      this._create({ kind: 'wanderer', home, tint: NPC_TINTS[biome] ?? 0xcccccc, line: () => text });
    }
  }

  // info = { playerPos, sprinting, chaos, camera, renderer }
  update(dt, info) {
    const p = info.playerPos;
    const ground = (x, z) => this.terrainHeight(x, z);

    for (const n of this.npcs) {
      const d = n.root.position.distanceTo(p);
      // far away: hide and skip (performance)
      const far = d > NPC_ACTIVE_RADIUS;
      n.root.visible = !far;
      if (far) { n.bubble.hide(); continue; }

      n.mixer?.update(dt);
      n.timer -= dt;
      n.animationTime += dt;
      if (n.fallbackParts) {
        const swing = n.state === 'walk' || (n.state === 'scared' && n.timer > 0)
          ? Math.sin(n.animationTime * 8) * 0.45
          : Math.sin(n.animationTime * 2) * 0.04;
        n.fallbackParts.legs[0].rotation.x = swing;
        n.fallbackParts.legs[1].rotation.x = -swing;
        n.fallbackParts.arms[0].rotation.x = -swing;
        n.fallbackParts.arms[1].rotation.x = swing;
        n.fallbackParts.torso.rotation.z = n.state === 'talk' ? Math.sin(n.animationTime * 3) * 0.04 : 0;
      }

      // 3.11 scared: high chaos and the player sprints close by
      if (n.state !== 'scared' && info.chaos > CHAOS_ENTER && info.sprinting && d < SCARE_DISTANCE) {
        n.state = 'scared';
        n.timer = 1.5; // run for 1.5 s, then cower
        n.player.play(this.clips.flee || this.clips.walk);
      }
      if (n.state === 'scared') {
        n.bubble.hide();
        if (n.timer > 0) {
          // run directly away from the player
          const ax = n.root.position.x * 2 - p.x;
          const az = n.root.position.z * 2 - p.z;
          stepTowards(n.root, ax, az, 3.5, dt, ground, NPC_YAW_OFFSET, 0);
        } else {
          n.player.play(this.clips.scared || this.clips.idle);
          turnTowards(n.root, p.x, p.z, dt, 4, NPC_YAW_OFFSET);
        }
        if (info.chaos < CHAOS_CALM) { n.state = 'idle'; n.timer = 1; n.player.play(this.clips.idle); }
        continue;
      }

      // talk: player close and calm
      if (d < TALK_DISTANCE && info.chaos < CHAOS_CALM) {
        if (n.state !== 'talk') { n.state = 'talk'; n.player.play(this.clips.talk || this.clips.idle); }
        turnTowards(n.root, p.x, p.z, dt, 5, NPC_YAW_OFFSET);
        n.bubble.setText(n.line());
        const head = n.root.position.clone();
        head.y += NPC_HEIGHT + 0.35;
        n.bubble.showAt(head, info.camera, info.renderer);
        continue;
      }
      n.bubble.hide();
      if (n.state === 'talk') { n.state = 'idle'; n.timer = 1.5; n.player.play(this.clips.idle); }

      // keeper stays put
      if (n.kind === 'keeper') continue;

      // 3.10 wander: idle -> pick a point within WANDER_RADIUS of home -> walk -> idle
      if (n.state === 'idle' && n.timer <= 0) {
        const a = n.rng() * Math.PI * 2;
        const r = 4 + n.rng() * (WANDER_RADIUS - 4);
        const x = n.home.x + Math.cos(a) * r;
        const z = n.home.z + Math.sin(a) * r;
        // skip points that drop into a chasm
        if (this.terrainHeight(x, z) > n.home.y - 3) {
          n.target = { x, z };
          n.state = 'walk';
          n.player.play(this.clips.walk || this.clips.idle);
        } else {
          n.timer = 0.5;
        }
      }
      if (n.state === 'walk') {
        if (stepTowards(n.root, n.target.x, n.target.z, 1.4, dt, ground, NPC_YAW_OFFSET)) {
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
      this.scene.remove(n.root);
      n.root.traverse((o) => {
        if (!o.isMesh) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        if (n.fallbackParts) o.geometry.dispose();
      });
    }
    this.npcs = [];
  }
}
