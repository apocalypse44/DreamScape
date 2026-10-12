// Dog behaviour layer (3.5 pet, 3.6 reactions, 3.7 howl at embers, 3.8 fetch).
//
// Your existing companion.js keeps moving the dog normally. Every frame it asks
// this brain first:   if (Phase3.updateDog(dt)) return;
// When update() returns true, this file is controlling the dog (sitting,
// barking, being petted, fetching...) and companion.js should skip its own
// movement for that frame. When it returns false, companion.js runs as usual.
import { THREE } from './deps.js';
import { makeActionPlayer, resolveClips, turnTowards, stepTowards } from './anim.js';
import { Burst, sfx } from './fx.js';
import {
  DOG_CLIPS, DOG_YAW_OFFSET, PET_TIME, BARK_DISTANCE, BARK_COOLDOWN, SIT_DISTANCE,
  FETCH_EVERY, FETCH_CHAOS_DROP,
} from './config.js';

const S = {
  FREE: 'free', SIT: 'sit', BARK: 'bark', WAIT: 'wait', PET: 'pet', HOWL: 'howl',
  FETCH_GO: 'fetch_go', FETCH_BACK: 'fetch_back',
};

export class DogBrain {
  // dog = { object, mixer?, clips?, play?(state), onRelease?() }
  //   object : the dog's root Object3D (the thing your code moves)
  //   mixer/clips : its AnimationMixer + gltf.animations (used if play is absent)
  //   play(state) : OPTIONAL. If your companion.js already has its own
  //                 "play this clip" function, pass a wrapper here and map the
  //                 state names ('sit','bark','wait','pet','howl','run') to clips.
  //   onRelease() : OPTIONAL. Called when control goes back to companion.js,
  //                 so it can restart its walk/idle clip.
  constructor({ scene, dog, rng, terrainHeight, addChaos }) {
    this.scene = scene;
    this.dog = dog;
    this.rng = rng;
    this.terrainHeight = terrainHeight;
    this.addChaos = addChaos;
    this.state = S.FREE;
    this.timer = 0;
    this.barkCooldown = 0;
    this.fetchTimer = FETCH_EVERY;
    this.groundOffset = 0;
    this.hearts = new Burst(scene, { color: 0xff7aa8, count: 30, size: 0.25, gravity: -0.5, speed: [0.3, 1], up: [1, 2], life: 1.6, systems: 2 });
    this.sparkle = new Burst(scene, { color: 0xbfe8ff, count: 50, size: 0.15, life: 1.0, systems: 2 });

    // own animation player, only if no play() adapter was given
    if (!dog.play && dog.mixer && dog.clips) {
      this.clips = resolveClips('dog', dog.clips, DOG_CLIPS);
      this.player = makeActionPlayer(dog.mixer);
    }

    // glowing ring that marks an ember while the cursed dog howls
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.2, 40),
      new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);

    // the thing the dog fetches
    this.mote = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff })
    );
    this.mote.visible = false;
    scene.add(this.mote);
  }

  get object() { return this.dog.object; }

  _play(state) {
    if (this.dog.play) { this.dog.play(state); return; }
    if (!this.player) return;
    const clip = this.clips[state === 'fetch_go' || state === 'fetch_back' ? 'run' : state];
    this.player.play(clip);
  }

  _go(next) {
    if (next === this.state) return;
    const wasFree = this.state === S.FREE;
    this.state = next;
    this.timer = 0;
    if (next === S.FREE) {
      this.ring.visible = false;
      if (this.player) this.dog.mixer.stopAllAction();
      this.dog.onRelease?.();
      return;
    }
    if (wasFree) {
      // taking control: remember how high the model sits above the ground
      const o = this.object.position;
      this.groundOffset = o.y - this.terrainHeight(o.x, o.z);
      if (this.player) this.dog.mixer.stopAllAction();
    }
    this._play(next);
    if (next === S.BARK) sfx.bark();
    if (next === S.HOWL) sfx.howl();
  }

  _ground(x, z) { return this.terrainHeight(x, z) + this.groundOffset; }

  // Called by the E key handler. Returns true if petting started.
  tryPet(playerPos) {
    if (this.state === S.PET) return false;
    this._go(S.PET);
    turnTowards(this.object, playerPos.x, playerPos.z, 1, 1, DOG_YAW_OFFSET);
    const at = this.object.position.clone();
    at.y += 1;
    this.hearts.fire(at);
    sfx.pet();
    return true;
  }

  // info = { playerPos, sprinting, crouching, onCourse, elevated, stage, nextEmberPos }
  // returns true when this brain controls the dog this frame
  update(dt, t, info) {
    this.timer += dt;
    this.barkCooldown -= dt;
    if (info.stage === 'cured') this.fetchTimer -= dt;
    // Note: companion.js keeps calling dog.mixer.update(dt) every frame as it does today.

    const o = this.object.position;
    const p = info.playerPos;
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    const cursed = info.stage === 'cursed';

    switch (this.state) {
      case S.FREE: {
        if (cursed) {
          // companion.js already walks the cursed dog to the next ember;
          // we only add the howl + ring when it gets there and you are far away
          const em = info.nextEmberPos;
          if (em && Math.hypot(em.x - o.x, em.z - o.z) < 2.5 && d > 5) this._go(S.HOWL);
          break;
        }
        if (info.crouching && d < SIT_DISTANCE) this._go(S.SIT);
        else if (info.sprinting && d < BARK_DISTANCE && this.barkCooldown <= 0) {
          this.barkCooldown = BARK_COOLDOWN;
          this._go(S.BARK);
        } else if (info.onCourse && d < 30) this._go(S.WAIT);
        // The mote lands on base terrain, so no fetch while the player is up on terraces or the Sky Garden.
        else if (info.stage === 'cured' && !info.elevated && this.fetchTimer <= 0 && d < 15) this._startFetch(p);
        break;
      }
      case S.SIT:
        turnTowards(this.object, p.x, p.z, dt, 4, DOG_YAW_OFFSET);
        if (!info.crouching || d > SIT_DISTANCE + 2) this._go(S.FREE);
        break;
      case S.BARK: {
        turnTowards(this.object, p.x, p.z, dt, 8, DOG_YAW_OFFSET);
        const hop = Math.abs(Math.sin(this.timer * 18)) * 0.15;
        o.y = this._ground(o.x, o.z) + hop;
        if (this.timer > 1.0) { o.y = this._ground(o.x, o.z); this._go(S.FREE); }
        break;
      }
      case S.WAIT:
        turnTowards(this.object, p.x, p.z, dt, 4, DOG_YAW_OFFSET);
        if (this.timer % 3 < dt) sfx.bark();
        if (!info.onCourse) this._go(S.FREE);
        break;
      case S.PET:
        turnTowards(this.object, p.x, p.z, dt, 6, DOG_YAW_OFFSET);
        if (this.timer > PET_TIME) this._go(S.FREE);
        break;
      case S.HOWL: {
        const em = info.nextEmberPos;
        if (!cursed || !em) { this._go(S.FREE); break; }
        this.ring.visible = true;
        this.ring.position.set(em.x, this.terrainHeight(em.x, em.z) + 0.05, em.z);
        this.ring.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4));
        turnTowards(this.object, p.x, p.z, dt, 3, DOG_YAW_OFFSET);
        if (this.timer % 4 < dt && this.timer > 0.5) sfx.howl();
        if (d < 4) this._go(S.FREE);
        break;
      }
      case S.FETCH_GO: {
        const m = this.mote.position;
        if (stepTowards(this.object, m.x, m.z, 6, dt, (x, z) => this._ground(x, z), DOG_YAW_OFFSET, 0.8)) {
          this._go(S.FETCH_BACK);
        } else if (this.timer > 10) {
          this.mote.visible = false; this.fetchTimer = FETCH_EVERY; this._go(S.FREE);
        }
        break;
      }
      case S.FETCH_BACK: {
        // carry the mote in front of the nose
        const fwd = new THREE.Vector3(0, 0, 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.object.rotation.y - DOG_YAW_OFFSET);
        this.mote.position.copy(o).add(fwd);
        this.mote.position.y += 0.6;
        if (stepTowards(this.object, p.x, p.z, 6, dt, (x, z) => this._ground(x, z), DOG_YAW_OFFSET, 1.6)) {
          this.mote.visible = false;
          this.sparkle.fire(this.mote.position);
          sfx.pickup();
          this.addChaos?.(FETCH_CHAOS_DROP);
          this.fetchTimer = FETCH_EVERY;
          this._go(S.FREE);
        }
        if (this.timer > 15) { this.mote.visible = false; this.fetchTimer = FETCH_EVERY; this._go(S.FREE); }
        break;
      }
    }

    this.hearts.update(dt);
    this.sparkle.update(dt);
    return this.state !== S.FREE;
  }

  _startFetch(playerPos) {
    // seeded spot 8-14 m from the player
    const a = this.rng() * Math.PI * 2;
    const r = 8 + this.rng() * 6;
    const x = playerPos.x + Math.cos(a) * r;
    const z = playerPos.z + Math.sin(a) * r;
    this.mote.position.set(x, this.terrainHeight(x, z) + 0.4, z);
    this.mote.visible = true;
    this._go(S.FETCH_GO);
  }

  reset(rng) {
    this.rng = rng;
    this.barkCooldown = 0;
    this.fetchTimer = FETCH_EVERY;
    this.mote.visible = false;
    if (this.state !== S.FREE) this._go(S.FREE);
  }

  dispose() {
    this.hearts.dispose();
    this.sparkle.dispose();
    for (const m of [this.ring, this.mote]) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
