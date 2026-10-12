// Visual + sound effects: particle bursts, camera shake, synthesized sounds.
// These are purely cosmetic, so Math.random() is fine here.
import { THREE } from './deps.js';

// ---------------------------------------------------------------- particles
// A small pool of THREE.Points. fire(pos) throws particles out of pos; they
// fall with gravity and fade. Several systems rotate so bursts can overlap.
export class Burst {
  constructor(scene, opts = {}) {
    this.o = {
      count: 80, color: 0xffaa44, size: 0.18, gravity: 9,
      speed: [2, 6], up: [2, 7], life: 1.0, systems: 3, ...opts,
    };
    this.systems = [];
    this.next = 0;
    for (let s = 0; s < this.o.systems; s++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.o.count * 3), 3));
      const mat = new THREE.PointsMaterial({
        color: this.o.color, size: this.o.size, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.visible = false;
      pts.frustumCulled = false;
      pts.userData = { vel: new Float32Array(this.o.count * 3), life: 0 };
      scene.add(pts);
      this.systems.push(pts);
    }
  }

  fire(pos) {
    const pts = this.systems[this.next];
    this.next = (this.next + 1) % this.systems.length;
    const p = pts.geometry.attributes.position.array;
    const v = pts.userData.vel;
    const [s0, s1] = this.o.speed;
    const [u0, u1] = this.o.up;
    for (let i = 0; i < p.length; i += 3) {
      p[i] = pos.x; p[i + 1] = pos.y; p[i + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const s = s0 + Math.random() * (s1 - s0);
      v[i] = Math.cos(a) * s;
      v[i + 1] = u0 + Math.random() * (u1 - u0);
      v[i + 2] = Math.sin(a) * s;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.userData.life = 1;
    pts.visible = true;
  }

  update(dt) {
    for (const pts of this.systems) {
      const u = pts.userData;
      if (!pts.visible) continue;
      u.life -= dt / this.o.life;
      if (u.life <= 0) { pts.visible = false; continue; }
      const p = pts.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        u.vel[i + 1] -= this.o.gravity * dt;
        p[i] += u.vel[i] * dt;
        p[i + 1] += u.vel[i + 1] * dt;
        p[i + 2] += u.vel[i + 2] * dt;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      pts.material.opacity = u.life;
    }
  }

  dispose() {
    for (const pts of this.systems) {
      pts.parent?.remove(pts);
      pts.geometry.dispose();
      pts.material.dispose();
    }
    this.systems = [];
  }
}

// ------------------------------------------------------------- camera shake
const shake = { amount: 0 };
export function addShake(amount) {
  shake.amount = Math.max(shake.amount, amount);
}
// Call AFTER your camera controller has positioned the camera each frame.
export function applyCameraShake(camera, dt) {
  if (shake.amount <= 0) return;
  camera.position.x += (Math.random() - 0.5) * shake.amount;
  camera.position.y += (Math.random() - 0.5) * shake.amount;
  shake.amount = Math.max(0, shake.amount - dt * 1.5);
}

// ------------------------------------------------------------------- sounds
// Recorded samples from assets/sounds/<name>.mp3 when present (see SOUNDS), otherwise the
// synthesized WebAudio fallback below. Browsers only allow audio after the first key press or
// click; unlockAudio() is called on keydown and also starts loading the samples.
const SOUNDS = ['bark', 'howl', 'pet', 'pickup', 'whoosh', 'cure'];
const samples = {}; // name -> AudioBuffer, or null if the file is missing
let ac = null;
function ctx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ac) {
    ac = new AC();
    for (const name of SOUNDS) {
      samples[name] = null;
      fetch(`assets/sounds/${name}.mp3`)
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then(data => ac.decodeAudioData(data))
        .then(buffer => { samples[name] = buffer; })
        .catch(() => {}); // no file: keep the synthesized version
    }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function unlockAudio() { ctx(); }

// Play a loaded sample with a slight random pitch so repeats don't sound identical.
function sample(name, vol = 0.8) {
  const buffer = samples[name];
  if (!buffer || !ac || ac.state !== 'running') return false;
  const source = ac.createBufferSource();
  const gain = ac.createGain();
  source.buffer = buffer;
  source.playbackRate.value = 0.92 + Math.random() * 0.16;
  gain.gain.value = vol;
  source.connect(gain).connect(ac.destination);
  source.start();
  return true;
}

function tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.4, vol = 0.2, delay = 0 }) {
  // Only unlockAudio() creates the context; creating it here before a key press triggers autoplay warnings.
  const a = ac;
  if (!a || a.state !== 'running') return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  pickup() {
    if (sample('pickup', 0.6)) return;
    tone({ type: 'triangle', f0: 660, f1: 1320, dur: 0.35, vol: 0.22 });
    tone({ type: 'sine', f0: 990, f1: 1980, dur: 0.5, vol: 0.12, delay: 0.08 });
  },
  bark() {
    if (sample('bark')) return;
    tone({ type: 'sawtooth', f0: 420, f1: 180, dur: 0.12, vol: 0.18 });
    tone({ type: 'sawtooth', f0: 440, f1: 190, dur: 0.12, vol: 0.15, delay: 0.18 });
  },
  howl() { if (!sample('howl', 0.6)) tone({ type: 'sine', f0: 300, f1: 620, dur: 1.2, vol: 0.15 }); },
  pet() { if (!sample('pet')) tone({ type: 'sine', f0: 520, f1: 780, dur: 0.3, vol: 0.12 }); },
  whoosh() { if (!sample('whoosh', 0.5)) tone({ type: 'triangle', f0: 200, f1: 900, dur: 0.6, vol: 0.1 }); },
  cure() {
    if (sample('cure', 0.6)) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ type: 'triangle', f0: f, f1: f, dur: 0.6, vol: 0.15, delay: i * 0.12 }));
  },
};
