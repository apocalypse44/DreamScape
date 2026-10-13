// Ember shards: glowing crystals with a light beam, picked up, carried in orbit, then offered.
import { Burst, addShake, sfx } from './fx.js';
import { EMBER_LIGHT_RANGE } from '../models/encounterConfig.js';

export class EmberSystem {
  constructor(scene) {
    this.scene = scene;
    this.embers = []; // { group, crystal, beam, mat, phase, state: 'world'|'carried'|'flying'|'gone', fly }
    this.burst = new Burst(scene, { color: 0xffaa44 });
    this.offerBurst = new Burst(scene, { color: 0xffe6a0, count: 140, speed: [1, 5], up: [3, 9], life: 1.6 });
    this.light = new THREE.PointLight(0xff6a20, 0, 10, 2);
    scene.add(this.light);
    this.offering = null;
  }

  // Create one shard per position. Call again any time to rebuild.
  setEmbers(positions) {
    this.clearEmbers();
    positions.forEach((p, i) => this.embers.push(this._createShard(p, i)));
  }

  setWorldVisible(visible) {
    for (const ember of this.embers) {
      if (ember.state === 'world') ember.group.visible = visible;
    }
  }

  _createShard(pos, index) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff7a2a, emissive: 0xff4a10, emissiveIntensity: 2, roughness: 0.25, metalness: 0.1,
    });
    const crystalGeometry = new THREE.OctahedronGeometry(0.35, 0);
    crystalGeometry.scale(1, 1.8, 1);
    const crystal = new THREE.Mesh(crystalGeometry, mat);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffa040, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.3, 14, 12, 1, true), beamMat);
    beam.position.y = 7;
    group.add(crystal, beam);
    group.position.copy(pos);
    this.scene.add(group);
    return { group, crystal, beam, mat, phase: index * 2.1, state: 'world', base: pos.clone(), fly: null };
  }

  // For an ember that moves (e.g. carried by the hound).
  setEmberPosition(i, pos) {
    const e = this.embers[i];
    if (e && e.state === 'world') { e.base.copy(pos); e.group.position.copy(pos); }
  }

  get carriedCount() {
    return this.embers.filter((e) => e.state === 'carried').length;
  }

  pickup(i) {
    const e = this.embers[i];
    if (!e || e.state !== 'world') return;
    const at = e.group.position.clone();
    at.y += 1.2;
    this.burst.fire(at);
    addShake(0.35);
    sfx.pickup();
    e.state = 'carried';
    e.beam.visible = false;
    e.group.scale.setScalar(0.5);
  }

  // Offering: carried embers fly into `target` one after another.
  // onDone runs once the last one lands (the quest cures the hound there).
  startOffering(target, onDone) {
    const carried = this.embers.filter((e) => e.state === 'carried');
    if (!carried.length) { onDone?.(); return; }
    sfx.whoosh();
    carried.forEach((e, k) => {
      const p0 = e.group.position.clone();
      const p2 = target.clone();
      const p1 = p0.clone().lerp(p2, 0.5);
      p1.y += 4;
      e.state = 'flying';
      e.fly = { k: -k * 0.3, p0, p1, p2 };
    });
    this.offering = { target: target.clone(), onDone };
  }

  update(dt, t, playerPos, chaos) {
    let nearest = null;
    let nearestD = Infinity;
    let orbitIndex = 0;
    const carriedTotal = this.carriedCount;

    for (const e of this.embers) {
      if (e.state === 'gone') continue;

      e.crystal.rotation.y = t * 0.8 + e.phase;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + e.phase);
      e.mat.emissiveIntensity = 1.5 + pulse + chaos * 2;

      if (e.state === 'world') {
        e.group.position.set(e.base.x, e.base.y + Math.sin(t * 2 + e.phase) * 0.15, e.base.z);
        e.beam.material.opacity = 0.1 + 0.15 * pulse + chaos * 0.2;
        if (e.group.visible) {
          const d = e.group.position.distanceTo(playerPos);
          if (d < nearestD) { nearestD = d; nearest = e; }
        }
      } else if (e.state === 'carried') {
        const a = t * 1.5 + (orbitIndex / Math.max(1, carriedTotal)) * Math.PI * 2;
        e.group.position.set(
          playerPos.x + Math.cos(a) * 0.9,
          playerPos.y + 1.3 + Math.sin(t * 3 + orbitIndex) * 0.1,
          playerPos.z + Math.sin(a) * 0.9
        );
        orbitIndex++;
      } else if (e.state === 'flying') {
        e.fly.k += dt / 1.2;
        if (e.fly.k > 0) bezier(e.fly.p0, e.fly.p1, e.fly.p2, Math.min(1, e.fly.k), e.group.position);
      }
    }

    // single point light follows the nearest uncollected ember
    if (nearest && nearestD < EMBER_LIGHT_RANGE) {
      this.light.position.copy(nearest.group.position);
      this.light.intensity = 1.5 + chaos * 2;
    } else {
      this.light.intensity = 0;
    }

    if (this.offering) {
      const flying = this.embers.filter((e) => e.state === 'flying');
      if (flying.every((e) => e.fly.k >= 1)) {
        flying.forEach((e) => { e.state = 'gone'; e.group.visible = false; });
        this.offerBurst.fire(this.offering.target);
        addShake(0.25);
        sfx.cure();
        const done = this.offering.onDone;
        this.offering = null;
        done?.();
      }
    }

    this.burst.update(dt);
    this.offerBurst.update(dt);
  }

  clearEmbers() {
    for (const e of this.embers) {
      this.scene.remove(e.group);
      e.crystal.geometry.dispose();
      e.beam.geometry.dispose();
      e.beam.material.dispose();
      e.mat.dispose();
    }
    this.embers = [];
    this.offering = null;
  }

  dispose() {
    this.clearEmbers();
    this.burst.dispose();
    this.offerBurst.dispose();
    this.scene.remove(this.light);
  }
}

function bezier(p0, p1, p2, k, out) {
  const u = 1 - k;
  return out.set(
    u * u * p0.x + 2 * u * k * p1.x + k * k * p2.x,
    u * u * p0.y + 2 * u * k * p1.y + k * k * p2.y,
    u * u * p0.z + 2 * u * k * p1.z + k * k * p2.z
  );
}
