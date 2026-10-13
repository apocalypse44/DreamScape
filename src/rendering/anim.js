// Animation and movement helpers shared by the dog's moods and the lore NPCs.

// Resolve a { role: [patterns] } table to { role: clip }; the first pattern that matches wins.
export function resolveClips(clips, table) {
  const out = {};
  for (const [role, patterns] of Object.entries(table)) {
    out[role] = null;
    for (const p of patterns) {
      out[role] = clips.find((clip) => p.test(clip.name)) ?? null;
      if (out[role]) break;
    }
  }
  return out;
}

// Crossfading player: play(clip) fades from the current clip to the new one.
export function makeActionPlayer(mixer) {
  const actions = new Map();
  let current = null;
  return {
    play(clip) {
      if (!clip) return;
      if (!actions.has(clip)) actions.set(clip, mixer.clipAction(clip));
      const next = actions.get(clip);
      if (next === current) return;
      next.reset().fadeIn(0.25).play();
      current?.fadeOut(0.25);
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
export function turnTowards(obj, x, z, dt, speed = 6) {
  const want = Math.atan2(x - obj.position.x, z - obj.position.z);
  let diff = want - obj.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
  obj.rotation.y += diff * Math.min(1, dt * speed);
}

// Move obj toward (x, z) at `speed` m/s on the ground. Returns true on arrival.
export function stepTowards(obj, x, z, speed, dt, groundY, arriveDist = 0.4) {
  const dx = x - obj.position.x;
  const dz = z - obj.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < arriveDist) return true;
  const step = Math.min(dist, speed * dt);
  obj.position.x += (dx / dist) * step;
  obj.position.z += (dz / dist) * step;
  obj.position.y = groundY(obj.position.x, obj.position.z);
  turnTowards(obj, x, z, dt, 8);
  return false;
}
