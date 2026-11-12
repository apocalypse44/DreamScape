// Dog moods, a finite state machine: free / sit / bark / wait / pet / howl.
//
// companion.js moves the dog every frame, then asks this brain. When update() returns true
// the brain controls the dog this frame (sitting, barking, being petted...) and
// companion.js takes the brain's position; when false, companion.js movement stands.
import { turnTowards } from './anim.js';
import { Burst, sfx } from './fx.js';
import {
  PET_TIME, BARK_DISTANCE, BARK_COOLDOWN, SIT_DISTANCE,
} from '../models/encounterConfig.js';

const S = {
  FREE: 'free', SIT: 'sit', BARK: 'bark', WAIT: 'wait', PET: 'pet', HOWL: 'howl',
};

export class DogBrain {
  // dog = { object, play(state), onRelease() } from companion.js:
  //   object      : the active body's root Object3D
  //   play(state) : plays the clip for a mood ('sit', 'bark', 'wait', 'pet', 'howl')
  //   onRelease() : control goes back to companion.js
  constructor({ scene, dog, terrainHeight }) {
    this.scene = scene;
    this.dog = dog;
    this.terrainHeight = terrainHeight;
    this.state = S.FREE;
    this.timer = 0;
    this.barkCooldown = 0;
    this.groundOffset = 0;
    this.hearts = new Burst(scene, { color: 0xff7aa8, count: 30, size: 0.25, gravity: -0.5, speed: [0.3, 1], up: [1, 2], life: 1.6, systems: 2 });

    // glowing ring that marks an ember while the cursed dog howls
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.2, 40),
      new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);

  }

  get object() { return this.dog.object; }

  _go(next) {
    if (next === this.state) return;
    const wasFree = this.state === S.FREE;
    this.state = next;
    this.timer = 0;
    if (next === S.FREE) {
      this.ring.visible = false;
      this.dog.onRelease();
      return;
    }
    if (wasFree) {
      // taking control: remember how high the model sits above the ground
      const o = this.object.position;
      this.groundOffset = o.y - this.terrainHeight(o.x, o.z);
    }
    this.dog.play(next);
    if (next === S.BARK) sfx.bark();
    if (next === S.HOWL) sfx.howl();
  }

  _ground(x, z) { return this.terrainHeight(x, z) + this.groundOffset; }

  // Called by the E key handler. Returns true if petting started.
  tryPet(playerPos) {
    if (this.state === S.PET) return false;
    this._go(S.PET);
    turnTowards(this.object, playerPos.x, playerPos.z, 1, 1);
    const at = this.object.position.clone();
    at.y += 1;
    this.hearts.fire(at);
    sfx.pet();
    return true;
  }

  // info = { playerPos, sprinting, crouching, onCourse, cursed, nextEmberPos }
  // returns true when this brain controls the dog this frame
  update(dt, t, info) {
    this.timer += dt;
    this.barkCooldown -= dt;

    const o = this.object.position;
    const p = info.playerPos;
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    const cursed = info.cursed;

    switch (this.state) {
      case S.FREE: {
        if (cursed) {
          // companion.js walks the cursed dog to the next ember;
          // this only adds the howl + ring when it gets there and the player is far away
          const em = info.nextEmberPos;
          if (em && Math.hypot(em.x - o.x, em.z - o.z) < 2.5 && d > 5) this._go(S.HOWL);
          break;
        }
        if (info.crouching && d < SIT_DISTANCE) this._go(S.SIT);
        else if (info.sprinting && d < BARK_DISTANCE && this.barkCooldown <= 0) {
          this.barkCooldown = BARK_COOLDOWN;
          this._go(S.BARK);
        } else if (info.onCourse && d < 30) this._go(S.WAIT);
        break;
      }
      case S.SIT:
        turnTowards(this.object, p.x, p.z, dt, 4);
        if (!info.crouching || d > SIT_DISTANCE + 2) this._go(S.FREE);
        break;
      case S.BARK: {
        turnTowards(this.object, p.x, p.z, dt, 8);
        const hop = Math.abs(Math.sin(this.timer * 18)) * 0.15;
        o.y = this._ground(o.x, o.z) + hop;
        if (this.timer > 1.0) { o.y = this._ground(o.x, o.z); this._go(S.FREE); }
        break;
      }
      case S.WAIT:
        turnTowards(this.object, p.x, p.z, dt, 4);
        if (this.timer % 3 < dt) sfx.bark();
        if (!info.onCourse) this._go(S.FREE);
        break;
      case S.PET:
        turnTowards(this.object, p.x, p.z, dt, 6);
        if (this.timer > PET_TIME) this._go(S.FREE);
        break;
      case S.HOWL: {
        const em = info.nextEmberPos;
        if (!cursed || !em) { this._go(S.FREE); break; }
        this.ring.visible = true;
        this.ring.position.set(em.x, this.terrainHeight(em.x, em.z) + 0.05, em.z);
        this.ring.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4));
        turnTowards(this.object, p.x, p.z, dt, 3);
        if (this.timer % 4 < dt && this.timer > 0.5) sfx.howl();
        if (d < 4) this._go(S.FREE);
        break;
      }
    }

    this.hearts.update(dt);
    return this.state !== S.FREE;
  }

  reset() {
    this.barkCooldown = 0;
    if (this.state !== S.FREE) this._go(S.FREE);
  }

  dispose() {
    this.hearts.dispose();
    for (const m of [this.ring]) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
