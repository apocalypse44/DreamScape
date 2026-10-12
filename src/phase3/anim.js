// Animation + small 3D helpers shared by the dog and the NPCs.
import { THREE } from './deps.js';

// Find the first clip whose name matches one of the patterns.
export function findClip(clips, patterns) {
  for (const p of patterns) {
    const c = clips.find((clip) => p.test(clip.name));
    if (c) return c;
  }
  return null;
}

// Resolve a { role: [patterns] } table to { role: clip } and log the result.
export function resolveClips(label, clips, table) {
  const out = {};
  for (const [role, patterns] of Object.entries(table)) out[role] = findClip(clips, patterns);
  console.log(`[phase3] ${label} clips available:`, clips.map((c) => c.name));
  console.log(
    `[phase3] ${label} clips chosen:`,
    Object.fromEntries(Object.entries(out).map(([k, c]) => [k, c ? c.name : '(none)']))
  );
  return out;
}

// Crossfading player: play(clip) fades from the current clip to the new one.
export function makeActionPlayer(mixer) {
  const actions = new Map();
  let current = null;
  const get = (clip) => {
    if (!clip) return null;
    if (!actions.has(clip)) actions.set(clip, mixer.clipAction(clip));
    return actions.get(clip);
  };
  return {
    play(clip, { fade = 0.25, once = false } = {}) {
      const next = get(clip);
      if (!next || next === current) return;
      next.reset();
      if (once) {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(THREE.LoopRepeat, Infinity);
      }
      next.fadeIn(fade).play();
      if (current) current.fadeOut(fade);
      current = next;
    },
    stop() {
      actions.forEach((a) => a.stop());
      current = null;
    },
  };
}

// Clone a rigged (skinned) model so each copy has its own skeleton.
// A plain .clone() shares the skeleton and breaks animation. Same algorithm
// as three's SkeletonUtils.clone, included here so no extra vendor file is needed.
export function cloneSkinned(source) {
  const sourceLookup = new Map();
  const cloneLookup = new Map();
  const copy = source.clone();
  parallelTraverse(source, copy, (a, b) => {
    sourceLookup.set(b, a);
    cloneLookup.set(a, b);
  });
  copy.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const src = sourceLookup.get(node);
    node.skeleton = src.skeleton.clone();
    node.bindMatrix.copy(src.bindMatrix);
    node.skeleton.bones = src.skeleton.bones.map((bone) => cloneLookup.get(bone));
    node.bind(node.skeleton, node.bindMatrix);
  });
  return copy;
}

function parallelTraverse(a, b, cb) {
  cb(a, b);
  for (let i = 0; i < a.children.length; i++) parallelTraverse(a.children[i], b.children[i], cb);
}

// Smoothly rotate obj (around Y) to face the point (x, z).
export function turnTowards(obj, x, z, dt, speed = 6, yawOffset = 0) {
  const want = Math.atan2(x - obj.position.x, z - obj.position.z) + yawOffset;
  let diff = want - obj.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
  obj.rotation.y += diff * Math.min(1, dt * speed);
}

// Move obj toward (x, z) at `speed` m/s on the ground. Returns true on arrival.
export function stepTowards(obj, x, z, speed, dt, groundY, yawOffset = 0, arriveDist = 0.4) {
  const dx = x - obj.position.x;
  const dz = z - obj.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < arriveDist) return true;
  const step = Math.min(dist, speed * dt);
  obj.position.x += (dx / dist) * step;
  obj.position.z += (dz / dist) * step;
  obj.position.y = groundY(obj.position.x, obj.position.z);
  turnTowards(obj, x, z, dt, 8, yawOffset);
  return false;
}

// Scale a model so its height is `height` metres and its feet sit at y = 0.
export function normalizeHeight(obj, height) {
  const box = new THREE.Box3().setFromObject(obj);
  const h = box.max.y - box.min.y;
  if (h > 0) obj.scale.multiplyScalar(height / h);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
  return obj;
}

// Promise wrapper around GLTFLoader.load (works on every r1xx loader).
export function loadGLTF(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}
