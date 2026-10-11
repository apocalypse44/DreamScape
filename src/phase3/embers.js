// Ember shards: look (3.1), pickup moment (3.2), carrying + offering (3.3).
import { THREE } from './deps.js';
import { Burst, addShake, sfx } from './fx.js';
import { toast } from './hud.js';
import { EMBER_LIGHT_RANGE } from './config.js';

// Build the glowing material once and share it (cheap).
function emberMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xff7a2a, emissive: 0xff4a10, emissiveIntensity: 2,
    roughness: 0.25, metalness: 0.1,
  });
}

// Turn a crystal GLB scene into a ~0.7 m tall template with the ember material.
export function makeCrystalTemplate(gltfScene) {
  const t = gltfScene.clone(true);
  const box = new THREE.Box3().setFromObject(t);
  const h = box.max.y - box.min.y || 1;
  t.scale.multiplyScalar(0.7 / h);
  const box2 = new THREE.Box3().setFromObject(t);
  const c = box2.getCenter(new THREE.Vector3());
  t.position.sub(c); // centre on origin so it spins in place
  const holder = new THREE.Group();
  holder.add(t);
  return holder;
}

function codeCrystal() {
  const geo = new THREE.OctahedronGeometry(0.35, 0);
  geo.scale(1, 1.8, 1);
  return new THREE.Mesh(geo);
}

export class EmberSystem {
  constructor({ scene, crystalTemplate = null }) {
    this.scene = scene;
    this.template = crystalTemplate;
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
    const mat = emberMaterial();
    let crystal;
    if (this.template) {
      crystal = this.template.clone(true);
      crystal.traverse((o) => { if (o.isMesh) o.material = mat; });
    } else {
      crystal = codeCrystal();
      crystal.material = mat;
    }
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

  // 3.2 pickup moment. count/total are for the toast text.
  pickup(i, count, total) {
    const e = this.embers[i];
    if (!e || e.state !== 'world') return;
    const at = e.group.position.clone();
    at.y += 1.2;
    this.burst.fire(at);
    addShake(0.35);
    sfx.pickup();
    toast(`EMBER ${count}/${total}`);
    e.state = 'carried';
    e.beam.visible = false;
    e.group.scale.setScalar(0.5);
  }

  // 3.3 offering: carried embers fly into `target` one after another.
  // onDone runs once the last one lands (call your existing cure there).
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

      // spin + pulse for every visible ember
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

    // offering finished?
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
      e.group.traverse((o) => {
        if (o.geometry && (!this.template || o.geometry === e.beam.geometry)) o.geometry.dispose();
        if (o === e.beam) { o.geometry.dispose(); o.material.dispose(); }
      });
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
