// DreamScape people kit (dev-only): build low-poly, vertex-coloured NPCs on the CC0 Quaternius
// skeleton without Blender. Bodies are procedural (tubes along bones, lathe robes, mitten hands,
// a stylised head with a face shell for the runtime anime face), so each NPC stays a few thousand
// triangles and matches the player's art style. All NPCs share one clip pack (people-clips.glb).
export const PACKS = {
  M: '../assets/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
  F: '../assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Female Mannequin/Unreal-Godot/Mannequin_F.glb',
  UAL2: '../assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb',
};
export const load = url => new Promise((resolve, reject) => new THREE.GLTFLoader().load(encodeURI(url), resolve, undefined, reject));
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// One smooth skull with a soft, tapered jaw (unit size; scale it per character). A separate chin
// ball used to bulge past the skull and toon-shaded as a pale patch around the mouth.
export function headGeometry() {
  const g = new THREE.SphereGeometry(1, 22, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = smooth(0, 1, -y);
    p.setXYZ(i, p.getX(i) * (1 - .2 * t), y * (1 + .05 * t), p.getZ(i) * (p.getZ(i) > 0 ? 1 + .04 * t : 1));
  }
  g.computeVertexNormals(); return g;
}

// Clips: keep rotations plus root/pelvis translation; bone scale and other translations never
// change in this rig, leaf bones are never skinned, and root X/Z travel is removed (the game moves NPCs).
// fingers: false also drops finger tracks (people-kit bodies have mitten hands, no finger bones skinned).
export function stripClip(source, name = source.name, { fingers = true } = {}) {
  const clip = source.clone(); clip.name = name;
  clip.tracks = clip.tracks.filter(t => {
    const [node, prop] = t.name.split('.');
    if (!fingers && /^(index|middle|ring|pinky|thumb)_/.test(node)) return false;
    return !node.includes('_leaf') && prop !== 'scale' && (prop !== 'position' || node === 'root' || node === 'pelvis');
  });
  for (const t of clip.tracks) if (t.name === 'root.position') for (let i = 0; i < t.values.length; i += 3) { t.values[i] = t.values[0]; t.values[i + 2] = t.values[2]; }
  return clip.optimize();
}

export async function exportGLB(root, animations = []) {
  return new Promise(resolve => new THREE.GLTFExporter().parse(root, resolve, { binary: true, animations, trs: true, onlyVisible: true }));
}

// A body under construction around `asset` (a loaded Quaternius mannequin used for its skeleton).
export function createBody(asset, palette) {
  const T = THREE, root = asset.scene; root.updateMatrixWorld(true);
  const originals = []; root.traverse(o => { if (o.isSkinnedMesh) originals.push(o); });
  const skeleton = originals[0].skeleton, bones = skeleton.bones;
  const bone = name => { const b = bones.find(x => x.name === name); if (!b) throw new Error(`Missing bone ${name}`); return b; };
  const index = name => bones.indexOf(bone(name));
  const at = name => bone(name).getWorldPosition(new T.Vector3());
  const rgb = new Map(Object.entries(palette).map(([k, hex]) => [k, new T.Color(hex).convertSRGBToLinear()]));
  const positions = [], normals = [], colors = [], joints = [], weights = [], solid = [], glow = [];
  const p = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3();
  const glowNames = new Set(Object.keys(palette).filter(k => k.startsWith('glow')));

  // influence(p) -> [[boneName, weight], ...] (normalised here); colour: name or (p) => name.
  function append(geometry, colour, influence, matrix = new T.Matrix4()) {
    const src = geometry.attributes, base = positions.length / 3, kinds = [];
    nm.getNormalMatrix(matrix);
    for (let i = 0; i < src.position.count; i++) {
      p.fromBufferAttribute(src.position, i).applyMatrix4(matrix); n.fromBufferAttribute(src.normal, i).applyMatrix3(nm).normalize();
      positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
      const name = typeof colour === 'function' ? colour(p, i) : colour, c = rgb.get(name);
      if (!c) throw new Error(`Missing colour ${name}`); colors.push(c.r, c.g, c.b); kinds.push(name);
      const w = influence(p, i).filter(x => x[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = w.reduce((s, x) => s + x[1], 0) || 1;
      for (let k = 0; k < 4; k++) { joints.push(w[k] ? index(w[k][0]) : 0); weights.push(w[k] ? w[k][1] / total : 0); }
    }
    const ids = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: src.position.count }, (_, i) => i);
    for (let k = 0; k < ids.length; k += 3) (glowNames.has(kinds[ids[k]]) ? glow : solid).push(ids[k] + base, ids[k + 1] + base, ids[k + 2] + base);
    geometry.dispose();
  }
  const rigid = name => () => [[name, 1]];
  const pose = new T.Object3D();
  // A primitive placed in model space: position, scale, rotation (Euler array or Quaternion).
  function put(geometry, colour, bones, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    pose.position.set(...(position.isVector3 ? position.toArray() : position)); pose.scale.set(...scale);
    if (rotation.isQuaternion) pose.quaternion.copy(rotation); else pose.rotation.set(...rotation);
    pose.updateMatrix(); append(geometry, colour, typeof bones === 'string' ? rigid(bones) : bones, pose.matrix);
  }
  const sphere = (c, b, at_, s, r) => put(new T.SphereGeometry(1, 12, 8), c, b, at_, s, r);
  const box = (c, b, at_, s, r) => put(new T.BoxGeometry(1, 1, 1), c, b, at_, s, r);
  const cone = (c, b, at_, s, r, sides = 6) => put(new T.ConeGeometry(1, 1, sides), c, b, at_, s, r);
  const up = new T.Vector3(0, 1, 0);
  const toward = (x, y, z) => new T.Quaternion().setFromUnitVectors(up, new T.Vector3(x, y, z).normalize());

  // A tube through points (model space) with a radius per point. segmentBones[i] owns the span
  // from point i to i+1; weights cross-fade over `blend` metres around each joint, so elbows and
  // knees bend smoothly. Optional colourAt(t 0..1 along the tube) paints cuffs and bands.
  function tube(points, radii, segmentBones, colour, { sides = 10, steps = 4, blend = .05, colourAt = null, squash = 1 } = {}) {
    const lengths = [0]; for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
    const total = lengths.at(-1), rings = [], pos = [], idx = [], along = [];
    for (let i = 0; i < points.length - 1; i++) for (let s = 0; s < steps; s++) rings.push([i, s / steps]);
    rings.push([points.length - 2, 1]);
    const side = new T.Vector3(), up2 = new T.Vector3();
    for (const [i, f] of rings) {
      const a = points[i], b = points[i + 1], c = a.clone().lerp(b, f), tangent = b.clone().sub(a).normalize();
      side.crossVectors(tangent, Math.abs(tangent.y) > .9 ? new T.Vector3(1, 0, 0) : up).normalize(); up2.crossVectors(side, tangent).normalize();
      const r = radii[i] + (radii[i + 1] - radii[i]) * f;
      for (let k = 0; k < sides; k++) {
        const a2 = k / sides * Math.PI * 2;
        pos.push(...c.clone().addScaledVector(side, Math.cos(a2) * r).addScaledVector(up2, Math.sin(a2) * r * squash).toArray());
        along.push((lengths[i] + (lengths[i + 1] - lengths[i]) * f) / total);
      }
    }
    for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < sides; k++) {
      const a2 = r * sides + k, b2 = r * sides + (k + 1) % sides, c2 = a2 + sides, d2 = b2 + sides;
      idx.push(a2, c2, b2, b2, c2, d2);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const last = segmentBones.length - 1;
    const influence = (q, vi) => {
      const s = along[vi] * total, out = new Map();
      let seg = 0; while (seg < last && s > lengths[seg + 1]) seg++;
      const add = (name, w) => out.set(name, (out.get(name) || 0) + w);
      // Cross-fade with the previous segment's bone near this segment's start joint, and with
      // the next one near its end joint; half-and-half exactly at each joint.
      const fromPrev = seg > 0 ? 1 - smooth(lengths[seg] - blend, lengths[seg] + blend, s) : 0;
      const toNext = seg < last ? smooth(lengths[seg + 1] - blend, lengths[seg + 1] + blend, s) : 0;
      if (fromPrev) add(segmentBones[seg - 1], fromPrev);
      if (toNext) add(segmentBones[seg + 1], toNext);
      add(segmentBones[seg], 1 - fromPrev - toNext);
      return [...out];
    };
    append(g, colourAt ? (q, vi) => colourAt(along[vi]) : colour, influence);
  }

  // A lathe (robes, collars): profile [[radius, y], ...], optional front gap, x/z squash.
  function lathe(profile, colour, influence, { segments = 24, gap = 0, scaleX = 1, scaleZ = 1, at: offset = [0, 0, 0] } = {}) {
    const g = new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), segments, gap / 2, Math.PI * 2 - gap);
    put(g, colour, influence, offset, [scaleX, 1, scaleZ]);
  }

  // Thin UV shell hugging the given skin shapes, for the runtime anime face. Same mapping as the
  // player's face (rendering/travelerFace.js): phi 1.9 rad across, theta .3pi..72pi down.
  function faceShell(centre, shapes) {
    const meshes = shapes.map(([c, s]) => { const m = new T.Mesh(headGeometry()); m.position.set(...c); m.scale.set(...s); m.updateMatrixWorld(true); return m; });
    const patch = new T.SphereGeometry(1, 24, 18, Math.PI / 2 - .95, 1.9, Math.PI * .3, Math.PI * .42);
    const ray = new T.Raycaster(), dir = new T.Vector3(), pa = patch.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      dir.fromBufferAttribute(pa, i).normalize(); ray.set(centre.clone().addScaledVector(dir, 1), dir.clone().negate());
      const hit = ray.intersectObjects(meshes)[0], q = hit ? hit.point.addScaledVector(dir, .0025) : centre.clone().addScaledVector(dir, .2);
      pa.setXYZ(i, q.x, q.y, q.z);
    }
    patch.computeVertexNormals(); for (const m of meshes) m.geometry.dispose();
    const face = new T.Mesh(patch, new T.MeshStandardMaterial({ name: 'PersonFace', transparent: true })); face.name = 'PersonFace';
    socket('socket_face', 'Head', new T.Vector3(), new T.Quaternion()).add(face);
  }
  function socket(name, boneName, position, quaternion = new T.Quaternion()) {
    const parent = bone(boneName), s = new T.Object3D(); s.name = name; parent.updateMatrixWorld(true);
    s.position.copy(parent.worldToLocal(position.clone()));
    s.quaternion.copy(parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(quaternion));
    parent.add(s); return s;
  }
  // A rigid, separately coloured prop (staff, bell...) built like the body, hung on a socket.
  function prop(name, build) {
    const sub = createPropSurface(rgb, glowNames); build(sub);
    const mesh = new T.Mesh(sub.finish(), [new T.MeshStandardMaterial({ vertexColors: true, name: 'PersonPalette' }), new T.MeshStandardMaterial({ vertexColors: true, name: 'PersonGlow' })]);
    mesh.name = name; return mesh;
  }
  function finish(name) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(joints, 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    geometry.setIndex([...solid, ...glow]); geometry.addGroup(0, solid.length, 0);
    if (glow.length) geometry.addGroup(solid.length, glow.length, 1);
    const materials = [new T.MeshStandardMaterial({ vertexColors: true, skinning: true, side: T.DoubleSide, name: 'PersonPalette' }),
      new T.MeshStandardMaterial({ vertexColors: true, skinning: true, name: 'PersonGlow' })];
    const mesh = new T.SkinnedMesh(geometry, materials); mesh.name = name; mesh.frustumCulled = false;
    root.add(mesh); mesh.bind(skeleton, new T.Matrix4());
    for (const o of originals) o.parent.remove(o);
    root.name = name;
    return { root, stats: { vertices: positions.length / 3, triangles: (solid.length + glow.length) / 3 } };
  }
  return { T, root, bone, at, put, sphere, box, cone, toward, tube, lathe, faceShell, socket, prop, finish, smooth };
}

// Minimal unskinned surface for props.
function createPropSurface(rgb, glowNames) {
  const T = THREE, positions = [], normals = [], colors = [], solid = [], glow = [], pose = new T.Object3D(), nm = new T.Matrix3(), p = new T.Vector3(), n = new T.Vector3();
  function put(geometry, colour, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    pose.position.set(...position); pose.scale.set(...scale); if (rotation.isQuaternion) pose.quaternion.copy(rotation); else pose.rotation.set(...rotation); pose.updateMatrix();
    nm.getNormalMatrix(pose.matrix); const src = geometry.attributes, base = positions.length / 3, c = rgb.get(colour);
    if (!c) throw new Error(`Missing colour ${colour}`);
    for (let i = 0; i < src.position.count; i++) {
      p.fromBufferAttribute(src.position, i).applyMatrix4(pose.matrix); n.fromBufferAttribute(src.normal, i).applyMatrix3(nm).normalize();
      positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); colors.push(c.r, c.g, c.b);
    }
    const ids = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: src.position.count }, (_, i) => i);
    (glowNames.has(colour) ? glow : solid).push(...ids.map(i => i + base)); geometry.dispose();
  }
  return {
    put,
    finish() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex([...solid, ...glow]);
      g.addGroup(0, solid.length, 0); if (glow.length) g.addGroup(solid.length, glow.length, 1); return g;
    },
  };
}
