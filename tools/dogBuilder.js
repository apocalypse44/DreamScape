// DreamScape companion builder: the CC0 Quaternius Shiba Inu (dog) and Wolf (Ember Hound)
// rebuilt as one vertex-coloured skinned mesh each, with original details, extra clips
// authored in code (sit, lie, howl, bark, pet, play bow, shake off) and stripped tracks.
// Output GLBs live in src/assets (deployed); this tool and the source packs are dev-only.
const SOURCES = { dog: '../assets/animals/ShibaInu.gltf', hound: '../assets/animals/Wolf.gltf' };
const PALETTES = {
  dog: {
    Main: 0xd9894a, Main_Light: 0xf3e2c4, Black: 0x2a211c, Eyes_Black: 0x1c1512, Eyes_White: 0xfbf6ee, Eyes_Pupil: 0x120c08,
    Nose: 0x241a16, cream: 0xf6e8cf, brow: 0xf8ecd6, blush: 0xe7a083, bandana: 0x2c3a68, bandanaTrim: 0xd6aa55, rust: 0xb2533a,
    shine: 0xffffff, glow: 0xc4a3ff,
  },
  hound: {
    // Veyr's curse burns violet: glowing eyes and lava-like fissures (char rim, deep edge, hot core).
    Main: 0x2b2524, Main_Light: 0x4a3d39, Black: 0x161212, Eyes_Black: 0xb27bff, Eyes_White: 0xd9b8ff, Eyes_Pupil: 0xf3e6ff,
    char: 0x120b10, lavaEdge: 0x6a2cff, lava: 0xe7d2ff,
    Nose: 0x110d0d, cream: 0x4a3d39, brow: 0x5a4a44, blush: 0x3a2e2b, bandana: 0x000000, bandanaTrim: 0x000000, rust: 0x000000,
    shine: 0xffd6a0, glow: 0xff7a2a,
  },
};

// Authored poses: model-space rotations (degrees) applied on top of each bone's rest pose,
// plus an optional Body drop. Keys are [time, pose]. Model space: +z nose, +y up, +x dog's left.
const STAND = {};
const SIT = {
  // Rear on the ground: hips drop, the spine pitches up, front legs stay vertical, and each
  // hind leg folds as thigh forward (BackLeg), shin back (BackUpperLeg), hock flat (BackLowerLeg).
  Back: [['x', -36]], Body: { y: -1.12, z: -.2 },
  Neck1: [['x', 14]], Neck3: [['x', 10]], Head: [['x', 10]],
  FrontShoulderL: [['x', 36]], FrontShoulderR: [['x', 36]],
  BackLegL: [['x', -52]], BackLegR: [['x', -52]], BackUpperLegL: [['x', 118]], BackUpperLegR: [['x', 118]],
  BackLowerLegL: [['x', -62]], BackLowerLegR: [['x', -62]],
  Tail1: [['x', 30]],
};
const LIE = {
  Body: { y: -1.05, z: 0 }, Back: [['x', 0]],
  FrontShoulderL: [['x', -10]], FrontShoulderR: [['x', -10]], FrontUpperLegL: [['x', -75]], FrontUpperLegR: [['x', -75]], FrontLowerLegL: [['x', 0]], FrontLowerLegR: [['x', 0]],
  BackLegL: [['x', 75]], BackLegR: [['x', 75]], BackLowerLegL: [['x', -100]], BackLowerLegR: [['x', -100]],
  Neck1: [['x', 18]], Head: [['x', -6]], Tail1: [['x', 40], ['y', 25]],
};
// Layer poses: rotations append and Body offsets add, so a variation never undoes its base.
const merge = (...poses) => {
  const out = {};
  for (const p of poses) for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) out[k] = [...(out[k] || []), ...v];
    else { const sum = { ...(out[k] || {}) }; for (const [a, d] of Object.entries(v)) sum[a] = (sum[a] || 0) + d; out[k] = sum; }
  }
  return out;
};
const HOWL_UP = merge(SIT, { Neck1: [['x', -30]], Neck2: [['x', -15]], Neck3: [['x', -12]], Head: [['x', -22]] });
const TILT = merge(SIT, { Head: [['z', 22]], Neck3: [['z', 8]] });
const BOW = {
  Body: { y: -.35, z: .1 }, Back: [['x', 24]],
  FrontShoulderL: [['x', -45]], FrontShoulderR: [['x', -45]], FrontUpperLegL: [['x', -40]], FrontUpperLegR: [['x', -40]],
  BackLegL: [['x', -22]], BackLegR: [['x', -22]], Neck1: [['x', -32]], Head: [['x', -18]], Tail1: [['x', -35]],
};
const BARK_A = { Neck1: [['x', -8]], Head: [['x', -16]], Back: [['x', -4]], Body: { y: .06 } };
const BARK_B = { Neck1: [['x', 6]], Head: [['x', 10]], Back: [['x', 2]], Body: { y: -.05 } };
const SHAKE = s => ({ Torso: [['z', 14 * s]], Torso2: [['z', 16 * s]], Torso3: [['z', 18 * s]], Neck1: [['z', 20 * s]], Head: [['z', 18 * s]], Back: [['z', 8 * s]] });
const AUTHORED = {
  sit: { loop: true, keys: [[0, SIT], [1.6, merge(SIT, { Neck1: [['x', 2]], Body: { y: .015 } })], [3.2, SIT]] },
  lie: { loop: true, keys: [[0, LIE], [2, merge(LIE, { Back: [['x', 1.5]], Head: [['x', 3]] })], [4, LIE]] },
  pet: { loop: true, keys: [[0, SIT], [.5, TILT], [1.6, TILT], [2.1, SIT], [2.6, merge(SIT, { Head: [['z', -18]] })], [3.6, merge(SIT, { Head: [['z', -18]] })], [4.2, SIT]] },
  howl: { loop: true, keys: [[0, SIT], [.6, HOWL_UP], [2.4, HOWL_UP], [3.1, SIT], [3.6, SIT]] },
  bark: { loop: true, keys: [[0, STAND], [.09, BARK_A], [.2, BARK_B], [.3, STAND], [.39, BARK_A], [.5, BARK_B], [.62, STAND], [1.1, STAND]] },
  playBow: { loop: false, keys: [[0, STAND], [.35, BOW], [1.2, BOW], [1.4, merge(BOW, { Back: [['x', -4]], Body: { y: .1 } })], [1.7, STAND]] },
  shake: { loop: false, keys: [[0, STAND], ...Array.from({ length: 8 }, (_, i) => [.12 + i * .09, SHAKE(i % 2 ? -1 : 1) ]), [.95, STAND]] },
};

export async function buildDog(kind = 'dog') {
  const T = THREE, palette = PALETTES[kind];
  const asset = await new Promise((resolve, reject) => new T.GLTFLoader().load(SOURCES[kind], resolve, undefined, reject));
  const root = asset.scene; root.name = kind === 'dog' ? 'DreamscapeDog' : 'DreamscapeHound'; root.updateMatrixWorld(true);
  const parts = []; root.traverse(o => { if (o.isSkinnedMesh) parts.push(o); });
  const skeleton = parts[0].skeleton, bones = skeleton.bones;
  const bone = name => { const b = bones.find(x => x.name === name); if (!b) throw new Error(`Missing bone ${name}`); return b; };
  const index = name => bones.indexOf(bone(name));
  const rgb = name => { const hex = palette[name]; if (hex == null) throw new Error(`Missing colour ${name}`); return new T.Color(hex).convertSRGBToLinear(); };
  const positions = [], normals = [], colors = [], joints = [], weights = [], solid = [], glow = [];
  const p = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3();
  function append(geometry, colour, influence, matrix = new T.Matrix4(), glowing = false) {
    const src = geometry.attributes, base = positions.length / 3; nm.getNormalMatrix(matrix);
    for (let i = 0; i < src.position.count; i++) {
      p.fromBufferAttribute(src.position, i).applyMatrix4(matrix); n.fromBufferAttribute(src.normal, i).applyMatrix3(nm).normalize();
      positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
      const c = rgb(typeof colour === 'function' ? colour(p) : colour); colors.push(c.r, c.g, c.b);
      const get = (a, k) => [a.getX, a.getY, a.getZ, a.getW][k].call(a, i); // r128 has no getComponent
      const w = influence ? influence(p) : Array.from({ length: 4 }, (_, k) => [get(src.skinIndex, k), get(src.skinWeight, k)]);
      for (let k = 0; k < 4; k++) { joints.push(w[k]?.[0] || 0); weights.push(w[k]?.[1] || 0); }
    }
    const ids = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: src.position.count }, (_, i) => i);
    (glowing ? glow : solid).push(...ids.map(i => i + base));
  }
  // 1. The source body, recoloured per material. Hound eyes join the glow group.
  for (const part of parts) {
    const name = part.material.name;
    if (!palette[name]) throw new Error(`Unmapped material ${name}`);
    append(part.geometry, name, null, part.bindMatrix, kind === 'hound' && /^Eyes/.test(name));
  }
  // Smooth toon bands: average normals of source vertices that share a position, while
  // keeping their separate colours (the low-poly source is faceted per material).
  const sourceCount = positions.length / 3;
  {
    const groups = new Map(), key = i => [0, 1, 2].map(k => Math.round(positions[i * 3 + k] * 500)).join(',');
    for (let i = 0; i < sourceCount; i++) { const k = key(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      const sum = new T.Vector3();
      for (const i of ids) sum.x += normals[i * 3], sum.y += normals[i * 3 + 1], sum.z += normals[i * 3 + 2];
      sum.normalize();
      for (const i of ids) normals[i * 3] = sum.x, normals[i * 3 + 1] = sum.y, normals[i * 3 + 2] = sum.z;
    }
  }
  // Outermost body point along `dir`, among source vertices within `radius` of the ray from `origin`.
  const q = new T.Vector3(), rel = new T.Vector3();
  function surface(origin, dir, radius = .12) {
    dir = dir.clone().normalize(); let best = null, bestDot = -Infinity;
    for (let i = 0; i < sourceCount; i++) {
      q.fromArray(positions, i * 3); rel.subVectors(q, origin);
      const along = rel.dot(dir); if (along < 0) continue;
      if (rel.addScaledVector(dir, -along).length() > radius) continue;
      if (along > bestDot) { bestDot = along; best = q.clone(); }
    }
    if (best) return best;
    if (radius > 1) throw new Error('No body surface found for a detail');
    return surface(origin, dir, radius * 2); // low-poly areas are sparse: widen the search
  }
  // 2. Original details, rigidly bound to one bone each and placed on the actual surface.
  const at = name => bone(name).getWorldPosition(new T.Vector3());
  const pose = new T.Object3D();
  function add(geometry, colour, boneName, position, scale = [1, 1, 1], rotation = [0, 0, 0], glowing = false) {
    pose.position.set(...(position.isVector3 ? position.toArray() : position)); pose.scale.set(...scale);
    if (rotation.isQuaternion) pose.quaternion.copy(rotation); else pose.rotation.set(...rotation);
    pose.updateMatrix();
    append(geometry, colour, () => [[index(boneName), 1]], pose.matrix, glowing); geometry.dispose();
  }
  const ball = () => new T.SphereGeometry(1, 12, 9);
  const head = at('Head');
  // Neck thickness for the collar: farthest source vertex from the neck axis near Neck1-Neck2.
  const neckA = at('Neck1'), neckB = at('Neck2'), neckAxis = neckB.clone().sub(neckA).normalize(), neckMid = neckA.clone().lerp(neckB, .55);
  let neckRadius = 0;
  for (let i = 0; i < sourceCount; i++) {
    q.fromArray(positions, i * 3).sub(neckMid); const along = q.dot(neckAxis);
    if (Math.abs(along) < .06) neckRadius = Math.max(neckRadius, q.addScaledVector(neckAxis, -along).length());
  }
  if (kind === 'dog') {
    // Shiba "maro" eyebrow dots and an eye shine, each sitting on the face surface.
    for (const s of [-1, 1]) {
      const brow = surface(new T.Vector3(head.x + s * .17, head.y + .17, head.z), new T.Vector3(0, .35, 1), .05);
      add(ball(), 'brow', 'Head', brow, [.07, .042, .035], [-.5, 0, 0]);
      const cheek = surface(new T.Vector3(head.x, head.y - .1, head.z + .05), new T.Vector3(s, -.2, .35), .09);
      add(ball(), 'cream', 'Head', cheek, [.11, .1, .12]);
    }
  }
  if (kind === 'hound') {
    // Volcanic fissures: connected, branching cracks that follow the real body surface
    // (raycast onto the bind-pose mesh), each a charred rim, a deep-violet edge and a hot core.
    // They borrow the skin weights of the nearest body vertex, so they bend with the hound.
    const solidSource = [];
    for (let k = 0; k < solid.length; k += 3) if (solid[k] < sourceCount && solid[k + 1] < sourceCount && solid[k + 2] < sourceCount) solidSource.push(solid[k], solid[k + 1], solid[k + 2]);
    const shell = new T.BufferGeometry();
    shell.setAttribute('position', new T.Float32BufferAttribute(positions.slice(0, sourceCount * 3), 3)); shell.setIndex(solidSource);
    const target = new T.Mesh(shell, new T.MeshBasicMaterial({ side: T.DoubleSide })), ray = new T.Raycaster();
    const spine = ['Back', 'Torso', 'Torso2', 'Torso3', 'Neck1', 'Neck2'].map(at);
    let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const axisPoint = p => { // nearest point on the spine polyline
      let best = spine[0], bestD = Infinity;
      for (let i = 0; i < spine.length - 1; i++) {
        const a = spine[i], ab = spine[i + 1].clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
        const c = a.clone().addScaledVector(ab, t), d = c.distanceToSquared(p); if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    };
    // Snap a point onto the fur: cast from outside toward the spine.
    function onSurface(p) {
      const centre = axisPoint(p), out = p.clone().sub(centre); out.y = Math.max(out.y, -.2); out.normalize();
      ray.set(centre.clone().addScaledVector(out, 1.5), out.clone().negate());
      const hit = ray.intersectObject(target)[0];
      return hit ? { point: hit.point, normal: out } : null;
    }
    const nearest = p => { let best = 0, bestD = Infinity; for (let i = 0; i < sourceCount; i++) { const d = (positions[i * 3] - p.x) ** 2 + (positions[i * 3 + 1] - p.y) ** 2 + (positions[i * 3 + 2] - p.z) ** 2; if (d < bestD) { bestD = d; best = i; } } return best; };
    const zMin = at('Back').z - .5, zMax = at('Neck2').z;
    function grow(start, heading, steps, width, depth) {
      const path = []; let p = start, dir = heading.clone();
      for (let i = 0; i < steps; i++) {
        const s = onSurface(p); if (!s || s.point.z < zMin || s.point.z > zMax || s.point.y < .85) break;
        path.push(s);
        // Jagged walk along the surface: turn a little each step, stay tangent to the fur.
        dir.applyAxisAngle(s.normal, (random() - .5) * .9); dir.addScaledVector(s.normal, -dir.dot(s.normal)).normalize();
        if (depth < 1 && i > 1 && random() < .3) grow(s.point.clone(), dir.clone().applyAxisAngle(s.normal, (random() < .5 ? 1 : -1) * (.6 + random() * .5)), 3 + Math.floor(random() * 4), width * .6, depth + 1);
        p = s.point.clone().addScaledVector(dir, .085);
      }
      if (path.length < 2) return;
      for (const [colour, scale, lift, glowing] of [['char', 2.4, .006, false], ['lavaEdge', 1.5, .011, true], ['lava', .7, .015, true]]) {
        const pos = [], idx = [];
        path.forEach((s, i) => {
          const next = path[Math.min(i + 1, path.length - 1)].point, prev = path[Math.max(i - 1, 0)].point;
          const side = new T.Vector3().crossVectors(s.normal, next.clone().sub(prev)).normalize();
          const w = width * scale * (1 - .75 * i / (path.length - 1)) * (.75 + random() * .5) / 2; // taper + jitter
          const c = s.point.clone().addScaledVector(s.normal, lift);
          pos.push(...c.clone().addScaledVector(side, w).toArray(), ...c.clone().addScaledVector(side, -w).toArray());
          if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        });
        const strip = new T.BufferGeometry(); strip.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); strip.setIndex(idx); strip.computeVertexNormals();
        append(strip, colour, v => { const n = nearest(v); return Array.from({ length: 4 }, (_, k) => [joints[n * 4 + k], weights[n * 4 + k]]); }, new T.Matrix4(), glowing);
        strip.dispose();
      }
    }
    // Seven fissures rising from the spine and running down both flanks like lava rivulets:
    // haunches, mid-flanks, shoulders and the nape. t is the position along the spine (0 hips, 1 neck).
    [[1, -.08], [-1, .02], [1, .32], [-1, .4], [1, .66], [-1, .72], [0, .93]].forEach(([side, t]) => {
      const a = t < 0 ? spine[0].clone().addScaledVector(spine[0].clone().sub(spine[1]).normalize(), -t * 2) : spine[0].clone().lerp(spine[spine.length - 1], t);
      const start = a.clone().add(new T.Vector3(side * .12, .5, 0));
      const heading = new T.Vector3(side || (random() < .5 ? 1 : -1), -1.1, (random() - .5) * .8).normalize();
      grow(start, heading, 10 + Math.floor(random() * 5), .05, 0);
    });
    shell.dispose(); target.material.dispose();
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  geometry.setIndex([...solid, ...glow]); geometry.addGroup(0, solid.length, 0);
  if (glow.length) geometry.addGroup(solid.length, glow.length, 1); // hound eyes; the dog has no glow on its body
  const materials = [new T.MeshStandardMaterial({ vertexColors: true, skinning: true, roughness: .9, name: 'DogPalette' }),
    new T.MeshStandardMaterial({ vertexColors: true, skinning: true, name: 'DogGlow' })];
  const mesh = new T.SkinnedMesh(geometry, materials); mesh.name = kind === 'dog' ? 'Dog' : 'Hound'; mesh.frustumCulled = false;
  const armature = parts[0].parent; armature.add(mesh); mesh.bind(skeleton, new T.Matrix4());
  for (const part of parts) part.parent.remove(part);

  // 3. Removable accessories (the pup in the Ember flashback hides them): bandana + sigil tag.
  if (kind === 'dog') {
    const neck = bone('Neck2'), acc = new T.Group(); acc.name = 'DogAccessories';
    const neckAt = at('Neck2'), local = neck.worldToLocal(neckAt.clone());
    const make = (geo, colour, glowing = false) => {
      const c = rgb(colour), count = geo.attributes.position.count;
      geo.setAttribute('color', new T.Float32BufferAttribute(Array.from({ length: count * 3 }, (_, i) => [c.r, c.g, c.b][i % 3]), 3));
      const m = new T.Mesh(geo, glowing ? materials[1].clone() : materials[0].clone()); m.material.skinning = false; return m;
    };
    // Built in model space around the neck, then expressed in the bone's frame.
    const holder = new T.Group(); holder.position.copy(local); holder.quaternion.copy(neck.getWorldQuaternion(new T.Quaternion()).invert());
    // Collar ring sized from the neck surface, tilted along the neck (Neck1 -> Neck3).
    const along = at('Neck3').sub(at('Neck1')).normalize(), ringAt = at('Neck1').lerp(at('Neck2'), .55).sub(neckAt);
    const radius = neckRadius * 1.06, tilt = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), along);
    const collar = make(new T.TorusGeometry(radius, .075, 8, 26), 'bandana'); collar.quaternion.copy(tilt); collar.position.copy(ringAt);
    const trim = make(new T.TorusGeometry(radius + .01, .02, 5, 26), 'bandanaTrim'); trim.quaternion.copy(tilt); trim.position.copy(ringAt).addScaledVector(along, -.07);
    // Triangle flap hanging from the throat side of the ring, with the sigil tag at its tip.
    const throat = new T.Vector3(0, -along.z, along.y); // perpendicular to the neck, toward the chest
    const flap = make(new T.ConeGeometry(.24, .4, 3), 'bandana'); flap.position.copy(ringAt).addScaledVector(throat, radius + .02).addScaledVector(along, -.12);
    flap.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), along.clone().negate()); flap.scale.set(1, 1, .3);
    const tag = make(new T.OctahedronGeometry(.075, 0), 'glow', true); tag.position.copy(flap.position).addScaledVector(along, -.25).addScaledVector(throat, .05); tag.scale.set(.8, 1, .5);
    holder.add(collar, trim, flap, tag); acc.add(holder); neck.add(acc);
  }

  // 4. Clips: source clips with constant/unused tracks removed, plus authored clips.
  const weightOf = new Float32Array(bones.length);
  for (let i = 0; i < joints.length; i++) weightOf[joints[i]] = Math.max(weightOf[joints[i]], weights[i]);
  const deforming = new Set();
  bones.forEach((b, i) => { if (weightOf[i] > 0) for (let o = b; o && o.isBone; o = o.parent) deforming.add(o.name); });
  // Keep every position track that actually moves: in this rig the paws hang off IK-target
  // bones (IKFrontLegL -> FFL ...), so their translation is what lifts and plants the feet.
  const varies = t => { const n = t.getValueSize(); for (let i = n; i < t.values.length; i++) if (Math.abs(t.values[i] - t.values[i % n]) > 1e-4) return true; return false; };
  const clips = asset.animations.map(source => {
    const clip = source.clone();
    clip.tracks = clip.tracks.filter(t => {
      const [node, prop] = t.name.split('.');
      return deforming.has(node) && prop !== 'scale' && (prop !== 'position' || varies(t));
    });
    return clip.optimize();
  });
  const rest = new Map(bones.map(b => [b.name, { q: b.quaternion.clone(), p: b.position.clone(), world: b.getWorldQuaternion(new T.Quaternion()) }]));
  const axes = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };
  const bodyParentQ = bone('Body').parent.getWorldQuaternion(new T.Quaternion()).invert();
  function poseQuaternion(name, spec) {
    const r = rest.get(name), q = r.q.clone();
    for (const [axis, deg] of spec || []) {
      // Model-space axis expressed in the bone's rest frame, applied after the rest rotation.
      const local = axes[axis].clone().applyQuaternion(r.world.clone().invert());
      q.multiply(new T.Quaternion().setFromAxisAngle(local, deg * Math.PI / 180));
    }
    return q;
  }
  for (const [name, def] of Object.entries(AUTHORED)) {
    const animated = new Set(def.keys.flatMap(([, pose]) => Object.keys(pose)));
    const tracks = [];
    for (const target of animated) {
      const times = def.keys.map(([t]) => t);
      if (target === 'Body') {
        const values = def.keys.flatMap(([, pose]) => {
          const d = pose.Body || {}, offset = new T.Vector3(d.x || 0, d.y || 0, d.z || 0).applyQuaternion(bodyParentQ);
          return rest.get('Body').p.clone().add(offset).toArray();
        });
        tracks.push(new T.VectorKeyframeTrack('Body.position', times, values));
      } else {
        const values = def.keys.flatMap(([, pose]) => poseQuaternion(target, pose[target]).toArray());
        tracks.push(new T.QuaternionKeyframeTrack(`${target}.quaternion`, times, values));
      }
    }
    clips.push(new T.AnimationClip(name, def.keys.at(-1)[0], tracks));
  }
  root.userData = { author: 'DreamScape', kind, rig: 'Quaternius Animated Animals (CC0)', version: 1, loops: Object.fromEntries(Object.entries(AUTHORED).map(([k, v]) => [k, v.loop])) };
  const buffer = await new Promise(resolve => new T.GLTFExporter().parse(root, resolve, { binary: true, animations: clips, trs: true, onlyVisible: true }));
  return { buffer, stats: { kind, bytes: buffer.byteLength, vertices: positions.length / 3, triangles: (solid.length + glow.length) / 3, bones: bones.length, clips: clips.map(c => c.name) } };
}
