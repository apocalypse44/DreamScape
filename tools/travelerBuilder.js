import { headGeometry } from './peopleKit.js';
// DreamScape "sigil-blade wanderer": an original fantasy outfit, face and sword
// built reproducibly around the CC0 Quaternius rig. No image textures: the body
// is one skinned, vertex-coloured mesh (opaque + glow groups), the sword is one
// small rigid mesh that the runtime moves between a back and a hand socket.
const PALETTE = {
  skin: 0xe6b48f, blush: 0xd18a74, lip: 0xb86a5c,
  hair: 0x2b2436, hairTip: 0x8b6fe0, brow: 0x241d2c,
  white: 0xf7f1e6, iris: 0x4c3b86, pupil: 0x1a1426,
  tunic: 0xe9dfc6, skirt: 0x2c3a68, cloak: 0x2a3560, lining: 0x7b2d3d, trim: 0xd6aa55,
  leather: 0x6f4a32, darkLeather: 0x3e2b23, pants: 0x34343f, boots: 0x4b3227, sole: 0x2a2224,
  glove: 0x3e2b23, steel: 0xaab6c6, steelDark: 0x5d6778, gold: 0xd9ad55,
  glow: 0xc4a3ff, glowSoft: 0x8f6cff,
};
const GLOW = new Set(['glow', 'glowSoft']);
// Runtime name -> [pack, source clip, root-motion source or null].
const CLIPS = {
  idle: [1, 'Idle_Loop'], walk: [1, 'Walk_Loop'], jog: [1, 'Jog_Fwd_Loop'], run: [1, 'Sprint_Loop'],
  jumpStart: [1, 'Jump_Start'], fall: [1, 'Jump_Loop'], land: [1, 'Jump_Land'],
  crouchIdle: [1, 'Crouch_Idle_Loop'], crouchWalk: [1, 'Crouch_Fwd_Loop'],
  cast: [1, 'Spell_Simple_Idle_Loop'], castShoot: [1, 'Spell_Simple_Shoot'], interact: [1, 'Interact'],
  combatIdle: [1, 'Sword_Idle'], roll: [1, 'Roll'], hit: [1, 'Hit_Chest'], death: [1, 'Death01'],
  slash1: [2, 'Sword_Regular_A', 'Sword_Regular_A'], slash1End: [2, 'Sword_Regular_A_Rec', 'Sword_Regular_A_Rec'],
  slash2: [2, 'Sword_Regular_B', 'Sword_Regular_B'], slash2End: [2, 'Sword_Regular_B_Rec', 'Sword_Regular_B_Rec'],
  slash3: [2, 'Sword_Regular_C', 'Sword_Regular_C'], block: [2, 'Sword_Block'],
  dash: [2, 'Sword_Dash_RM', 'Sword_Dash_RM'], knockback: [2, 'Hit_Knockback', 'Hit_Knockback_RM'],
};
const PACKS = {
  1: '../assets/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
  2: '../assets/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb',
};

export async function buildTraveler() {
  const T = THREE;
  const load = url => new Promise((resolve, reject) => new T.GLTFLoader().load(encodeURI(url), resolve, undefined, reject));
  const [asset, pack2] = await Promise.all([load(PACKS[1]), load(PACKS[2])]);
  const animations = { 1: asset.animations, 2: pack2.animations };
  const root = asset.scene; root.name = 'DreamscapeTraveler'; root.updateMatrixWorld(true);
  const originals = []; root.traverse(o => { if (o.isSkinnedMesh) originals.push(o); });
  const skeleton = originals[0].skeleton;
  const bone = name => { const b = skeleton.bones.find(x => x.name === name); if (!b) throw new Error(`Missing bone ${name}`); return b; };
  const at = name => bone(name).getWorldPosition(new T.Vector3());
  const rgb = new Map(Object.entries(PALETTE).map(([k, hex]) => [k, new T.Color(hex).convertSRGBToLinear()]));

  // Spring bones for the cape; animations never key them, the runtime swings them.
  const capeTop = new T.Vector3(0, 1.405, -.262), capePivots = [capeTop, new T.Vector3(0, 1.07, -.30), new T.Vector3(0, .76, -.33)];
  const capeBones = []; let parentBone = bone('spine_03');
  const worldQ = new T.Quaternion();
  capePivots.forEach((pivot, i) => {
    const b = new T.Bone(); b.name = `cape_${i + 1}`;
    parentBone.updateMatrixWorld(true); parentBone.getWorldQuaternion(worldQ);
    b.position.copy(parentBone.worldToLocal(pivot.clone())); b.quaternion.copy(worldQ.invert());
    parentBone.add(b); b.updateMatrixWorld(true); capeBones.push(b); parentBone = b;
  });
  const bones = [...skeleton.bones, ...capeBones];
  const boneIndex = new Map(bones.map((b, i) => [b.name, i]));
  const index = name => { if (!boneIndex.has(name)) throw new Error(`Missing bone ${name}`); return boneIndex.get(name); };

  // A surface collects triangles into an opaque and a glow group.
  function surface(skinned) {
    const positions = [], normals = [], colors = [], joints = [], weights = [], solid = [], glow = [];
    const p = new T.Vector3(), n = new T.Vector3(), normalMatrix = new T.Matrix3();
    function append(geometry, color, bones, transform = new T.Matrix4(), keep = () => true) {
      const source = geometry.attributes, oldIndex = geometry.index, remap = new Map(), kind = [];
      normalMatrix.getNormalMatrix(transform);
      const vertex = i => {
        if (remap.has(i)) return remap.get(i);
        p.fromBufferAttribute(source.position, i).applyMatrix4(transform);
        n.fromBufferAttribute(source.normal, i).applyMatrix3(normalMatrix).normalize();
        const id = positions.length / 3; remap.set(i, id); positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
        const name = typeof color === 'function' ? color(p, i) : color; kind[id] = name;
        const c = rgb.get(name); if (!c) throw new Error(`Missing colour ${name}`); colors.push(c.r, c.g, c.b);
        if (skinned) {
          const influence = bones ? bones(p, i) : Array.from({ length: 4 }, (_, k) => [source.skinIndex.array[i * 4 + k], source.skinWeight.array[i * 4 + k]]);
          const total = influence.reduce((s, x) => s + (x?.[1] || 0), 0) || 1;
          for (let k = 0; k < 4; k++) { joints.push(influence[k]?.[0] || 0); weights.push((influence[k]?.[1] || 0) / total); }
        }
        return id;
      };
      const count = oldIndex ? oldIndex.count : source.position.count;
      for (let i = 0; i < count; i += 3) {
        const tri = [0, 1, 2].map(k => oldIndex ? oldIndex.getX(i + k) : i + k);
        if (!keep(tri.map(k => new T.Vector3().fromBufferAttribute(source.position, k).applyMatrix4(transform)))) continue;
        const ids = tri.map(vertex);
        (GLOW.has(kind[ids[0]]) ? glow : solid).push(...ids);
      }
    }
    function finish() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      if (skinned) { g.setAttribute('skinIndex', new T.Uint16BufferAttribute(joints, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4)); }
      g.setIndex([...solid, ...glow]); g.addGroup(0, solid.length, 0); g.addGroup(solid.length, glow.length, 1);
      return g;
    }
    return { append, finish, get vertices() { return positions.length / 3; }, get triangles() { return (solid.length + glow.length) / 3; } };
  }

  const body = surface(true);
  const rigid = name => () => [[index(name), 1]];
  const pose = new T.Object3D();
  function shape(target, geometry, color, bones, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    pose.position.set(...position); pose.scale.set(...scale);
    if (rotation.isQuaternion) pose.quaternion.copy(rotation); else pose.rotation.set(...rotation);
    pose.updateMatrix();
    target.append(geometry, color, typeof bones === 'function' ? bones : bones && rigid(bones), pose.matrix); geometry.dispose();
  }
  const put = (...args) => shape(body, ...args);
  const sphere = (color, b, p, s, r) => put(new T.SphereGeometry(1, 14, 10), color, b, p, s, r);
  const box = (color, b, p, s, r) => put(new T.BoxGeometry(1, 1, 1), color, b, p, s, r);
  const up = new T.Vector3(0, 1, 0);
  const toward = (x, y, z) => new T.Quaternion().setFromUnitVectors(up, new T.Vector3(x, y, z).normalize());
  // A thin box (or cylinder) stretched between two points.
  function strap(color, b, a, c, width, depth, cylinder = false) {
    const d = new T.Vector3().subVectors(c, a), mid = a.clone().add(c).multiplyScalar(.5);
    const geometry = cylinder ? new T.CylinderGeometry(1, 1, 1, 8) : new T.BoxGeometry(1, 1, 1);
    put(geometry, color, b, mid.toArray(), [width, d.length(), depth], new T.Quaternion().setFromUnitVectors(up, d.normalize()));
  }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // 1. Proven mannequin topology for limbs, painted as trousers, sleeves and gloves.
  //    The faceless head is removed and rebuilt below.
  for (const mesh of originals) {
    body.append(mesh.geometry, v => {
      const ax = Math.abs(v.x);
      if (v.y < .27) return 'boots';
      if (v.y < .95 && ax < .3) return 'pants';
      if (ax > .735) return 'glove';
      if (ax > .5) return 'darkLeather';
      return 'tunic';
    }, null, mesh.bindMatrix, tri => !tri.every(v => v.y > 1.53));
  }
  // 2. Split skirt: each side follows its thigh near the hem, with a soft seam.
  const skirtWeights = v => {
    const hem = smooth(1.0, .74, v.y) * .55, left = smooth(-.07, .07, v.x);
    return [[index('pelvis'), 1 - hem], [index('thigh_l'), hem * left], [index('thigh_r'), hem * (1 - left)]];
  };
  const torsoWeights = v => { const w = smooth(1.02, 1.32, v.y); return [[index('pelvis'), (1 - w) * .6], [index('spine_01'), (1 - w) * .4], [index('spine_03'), w]]; };
  const lathe = (points, segments, start, length) => new T.LatheGeometry(points.map(([r, y]) => new T.Vector2(r, y)), segments, start, length);
  put(lathe([[.262, .70], [.267, .728], [.267, .732], [.262, .745], [.235, .86], [.205, .96], [.19, 1.03]], 24, .26, Math.PI * 2 - .52),
    v => v.y < .73 ? 'trim' : 'skirt', skirtWeights, [0, 0, 0], [1, 1, .8]);
  // Ivory tunic under a laced leather jerkin.
  put(lathe([[.188, .99], [.172, 1.08], [.205, 1.24], [.218, 1.36], [.18, 1.46], [.11, 1.52]], 22), 'tunic', torsoWeights, [0, 0, 0], [1, 1, .79]);
  put(lathe([[.2, 1.0], [.185, 1.08], [.218, 1.24], [.229, 1.35], [.212, 1.392], [.21, 1.396], [.2, 1.41]], 22, .3, Math.PI * 2 - .6), v => v.y > 1.394 ? 'trim' : 'leather', torsoWeights, [0, 0, 0], [1, 1, .8]);
  for (let i = 0; i < 4; i++) box('darkLeather', 'spine_02', [0, 1.1 + i * .075, .182 + i * .004], [.075, .009, .01], [0, 0, i % 2 ? .35 : -.35]);
  // Belt, buckle, pouch and a glowing sigil charm.
  put(new T.TorusGeometry(.19, .028, 6, 26), 'darkLeather', 'pelvis', [0, 1.005, -.005], [1, .8, 1], [Math.PI / 2, 0, 0]);
  box('gold', 'pelvis', [0, 1.005, .158], [.07, .055, .02]);
  box('darkLeather', 'pelvis', [0, 1.005, .17], [.035, .025, .01]);
  box('leather', 'pelvis', [-.165, .95, .07], [.075, .095, .065], [0, -.6, 0]);
  box('gold', 'pelvis', [-.163, .985, .108], [.03, .018, .01], [0, -.6, 0]);
  strap('gold', 'pelvis', new T.Vector3(.11, .99, .14), new T.Vector3(.12, .93, .145), .006, .006, true);
  put(new T.OctahedronGeometry(1, 0), 'glow', 'pelvis', [.12, .91, .148], [.02, .032, .012]);

  // 3. Mantle, fallen hood and a clasp; the long cape hangs on spring bones.
  put(lathe([[.105, 1.545], [.16, 1.5], [.25, 1.43], [.29, 1.365], [.292, 1.352], [.294, 1.35], [.296, 1.33]], 26), v => v.y < 1.351 ? 'trim' : 'cloak', 'spine_03', [0, 0, -.015], [1, 1, .88]);
  put(new T.TorusGeometry(.13, .055, 8, 20, Math.PI * 1.25), 'cloak', 'spine_03', [0, 1.525, -.03], [1.05, .95, 1.1], [Math.PI / 2 - .25, 0, Math.PI * .125 + Math.PI]);
  sphere('cloak', 'spine_03', [0, 1.5, -.225], [.15, .1, .08]);
  sphere('lining', 'spine_03', [0, 1.525, -.205], [.11, .06, .05]);
  put(new T.CylinderGeometry(.034, .034, .016, 12), 'gold', 'spine_03', [0, 1.405, .255], [1, 1, 1], [Math.PI / 2 - .3, 0, 0]);
  put(new T.OctahedronGeometry(1, 0), 'glow', 'spine_03', [0, 1.406, .266], [.017, .024, .012], [-.3, 0, 0]);
  // Swallowtail cape: two layers (cloak outside, wine lining inside) on a grid.
  {
    const cols = 12, levels = [...Array.from({ length: 11 }, (_, i) => i / 11 * .94), .944, .948, 1], rows = levels.length - 1, length = .86, position = [], uv = [], ids = [];
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const u = c / cols, v = levels[r], side = 2 * u - 1, drop = length * (.84 + .16 * Math.abs(side) ** 1.5);
      position.push(side * (.25 + .11 * v), capeTop.y - v * drop, capeTop.z - .07 * v + .07 * side * side * (1 - .3 * v));
      uv.push(u, v);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
      ids.push(a, d, b, b, d, e);
    }
    const capeWeight = (p, i) => {
      const s = Math.min(2.999, uv[i * 2 + 1] * 2.6);
      return capeBones.map((b, k) => [index(b.name), Math.max(0, 1 - Math.abs(s - k))]).filter(x => x[1] > 0);
    };
    for (const [layer, offset, flip] of [['outer', -.006, false], ['inner', .006, true]]) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(position.map((x, k) => k % 3 === 2 ? x + offset : x), 3));
      g.setIndex(flip ? ids.map((_, k) => ids[k - k % 3 + 2 - k % 3]) : ids); g.computeVertexNormals();
      body.append(g, (p, i) => layer === 'outer' ? (uv[i * 2 + 1] > .946 ? 'trim' : 'cloak') : 'lining', capeWeight);
      g.dispose();
    }
  }
  // 4. Baldric, back scabbard, bracers, a left pauldron and rounded boots.
  const bladeDir = new T.Vector3(.4, -1, 0).normalize(), backFlat = new T.Vector3(0, 0, -1);
  const guard = new T.Vector3(-.155, 1.465, -.22);
  const backBasis = new T.Matrix4().makeBasis(new T.Vector3().crossVectors(bladeDir, backFlat), bladeDir, backFlat);
  const backQ = new T.Quaternion().setFromRotationMatrix(backBasis);
  const along = d => guard.clone().addScaledVector(bladeDir, d).toArray();
  box('darkLeather', 'spine_03', along(.41), [.085, .76, .046], backQ);
  box('gold', 'spine_03', along(.04), [.095, .06, .054], backQ);
  box('gold', 'spine_03', along(.77), [.09, .055, .05], backQ);
  box('glowSoft', 'spine_03', along(.42), [.012, .5, .05], backQ);
  strap('darkLeather', 'spine_03', new T.Vector3(-.17, 1.45, .14), new T.Vector3(.16, 1.06, .19), .045, .014);
  strap('darkLeather', 'spine_03', new T.Vector3(-.17, 1.45, -.17), new T.Vector3(.17, 1.04, -.21), .045, .014);
  for (const side of [-1, 1]) {
    const arm = side > 0 ? 'lowerarm_l' : 'lowerarm_r';
    put(new T.CylinderGeometry(.056, .05, .17, 10), 'leather', arm, [side * .62, 1.44, -.068], [1, 1, 1], [0, 0, Math.PI / 2]);
    for (const x of [.54, .70]) put(new T.TorusGeometry(.055, .009, 5, 14), 'gold', arm, [side * x, 1.44, -.068], [1, 1, 1], [0, Math.PI / 2, 0]);
    // Boots: folded cuff, rounded heel and toe over the mannequin feet.
    const foot = side > 0 ? 'foot_l' : 'foot_r', ball = side > 0 ? 'ball_l' : 'ball_r', calf = side > 0 ? 'calf_l' : 'calf_r';
    put(new T.CylinderGeometry(.068, .058, .07, 12), 'leather', calf, [side * .089, .29, -.01]);
    put(new T.TorusGeometry(.066, .014, 5, 14), 'gold', calf, [side * .089, .325, -.01], [1, 1, 1], [Math.PI / 2, 0, 0]);
    sphere('boots', foot, [side * .089, .062, -.03], [.06, .062, .085]);
    sphere('boots', ball, [side * .089, .045, .125], [.06, .046, .085]);
  }
  put(new T.TorusGeometry(.047, .012, 5, 14), 'glow', 'lowerarm_l', [.62, 1.44, -.068], [1, 1, 1], [0, Math.PI / 2, 0]);
  sphere('steelDark', 'upperarm_l', [.215, 1.47, -.065], [.1, .065, .1]);
  sphere('steel', 'upperarm_l', [.258, 1.452, -.065], [.075, .052, .088]);
  put(new T.TorusGeometry(.088, .01, 5, 18), 'gold', 'upperarm_l', [.22, 1.452, -.065], [1, 1, 1.05], [0, 0, -.2]);

  // 5. Stylised head: big eyes, pointed ears, spiky swept hair with a wisp streak.
  put(new T.CylinderGeometry(.068, .074, .14, 12), 'skin', 'Head', [0, 1.55, 0]);
  put(headGeometry(), 'skin', 'Head', [0, 1.77, .01], [.205, .228, .192]); // one skull, soft jaw: no chin patch
  for (const side of [-1, 1]) {
    put(new T.ConeGeometry(1, 1, 6), 'skin', 'Head', [side * .225, 1.79, -.015], [.042, .16, .026], [-.35, 0, -side * 1.15]);
    put(new T.ConeGeometry(1, 1, 6), 'blush', 'Head', [side * .228, 1.79, -.008], [.022, .11, .014], [-.35, 0, -side * 1.15]);
  }
  // Eyes, brows, mouth and blush are drawn at runtime on the face shell (section 6b), so
  // the face can change expression; only the small nose stays as geometry.
  sphere('skin', 'Head', [0, 1.728, .2], [.011, .013, .014]);
  // Hair: dome, back mass, radial spikes, a side-swept fringe and a tied tail.
  put(new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * .52), 'hair', 'Head', [0, 1.8, -.005], [.222, .252, .212]);
  sphere('hair', 'Head', [0, 1.765, -.105], [.205, .2, .13]);
  for (let i = 0; i <= 10; i++) {
    const phi = Math.PI * (.42 + 1.16 * i / 10), sx = Math.sin(phi), sz = Math.cos(phi);
    put(new T.ConeGeometry(1, 1, 5), 'hair', 'Head', [sx * .19, 1.72 + .03 * Math.abs(sx), sz * .17 - .02], [.065, .19 - .05 * Math.abs(sx), .05], toward(sx * .55, -1, sz * .6 - .2));
  }
  const fringe = [[-.16, .1, .2], [-.095, .16, .32], [-.03, .19, .4], [.035, .18, .45], [.1, .15, .55], [.155, .1, .5]];
  fringe.forEach(([x, len, sweep], k) => put(new T.ConeGeometry(1, 1, 5), 'hair', 'Head',
    [x, 1.9 - Math.abs(x) * .25, .165 - Math.abs(x) * .12], [.058, len, .042], toward(sweep, -1, .35)));
  for (const [x, len] of [[-.12, .14], [.13, .12]]) put(new T.ConeGeometry(1, 1, 5), 'hair', 'Head', [x * 1.45, 1.8, .07], [.05, len, .04], toward(Math.sign(x) * .25, -1, .15));
  put(new T.ConeGeometry(1, 1, 5), 'hair', 'Head', [.02, 2.02, .0], [.03, .12, .025], toward(.4, 1, -.5));
  put(new T.ConeGeometry(1, 1, 5), 'hair', 'Head', [0, 1.63, -.2], [.055, .2, .045], toward(0, -1, -.25));
  put(new T.TorusGeometry(.04, .011, 5, 12), 'gold', 'Head', [0, 1.705, -.2], [1, 1, 1], [Math.PI / 2 - .25, 0, 0]);
  put(new T.OctahedronGeometry(1, 0), 'hairTip', 'Head', [.02, 1.705, -.235], [.012, .016, .01]);

  // 6. Sword: rigid, origin at the grip centre, +Y toward the tip, flat on local Z.
  const sword = surface(false);
  const swordShape = (geometry, color, position, scale, rotation) => shape(sword, geometry, color, null, position, scale, rotation);
  const blade = new T.BufferGeometry();
  {
    const half = .042, thick = .011, base = .09, tip = .9, taper = .79;
    const v = [[-half, base, 0], [half, base, 0], [-half * .92, taper, 0], [half * .92, taper, 0], [0, tip, 0], [0, base, thick], [0, taper, thick * .9], [0, base, -thick], [0, taper, -thick * .9]];
    blade.setAttribute('position', new T.Float32BufferAttribute(v.flat(), 3));
    blade.setIndex([0, 5, 2, 2, 5, 6, 5, 1, 6, 6, 1, 3, 2, 6, 4, 6, 3, 4, 0, 2, 7, 2, 8, 7, 7, 8, 1, 8, 3, 1, 2, 4, 8, 8, 4, 3]);
  }
  const facetedBlade = blade.toNonIndexed(); facetedBlade.computeVertexNormals(); blade.dispose();
  swordShape(facetedBlade, 'steel', [0, 0, 0]);
  swordShape(new T.BoxGeometry(1, 1, 1), 'glow', [0, .43, 0], [.012, .54, .024]);
  swordShape(new T.BoxGeometry(1, 1, 1), 'gold', [0, .075, 0], [.2, .028, .036]);
  for (const s of [-1, 1]) swordShape(new T.SphereGeometry(1, 8, 6), 'gold', [s * .105, .085, 0], [.022, .028, .022]);
  swordShape(new T.CylinderGeometry(.019, .021, .15, 8), 'darkLeather', [0, -.005, 0]);
  swordShape(new T.SphereGeometry(1, 10, 8), 'gold', [0, -.095, 0], [.03, .032, .03]);
  swordShape(new T.OctahedronGeometry(1, 0), 'glow', [0, -.095, 0], [.016, .02, .034]);
  const swordGeometry = sword.finish();
  const swordMaterials = [new T.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .2, name: 'TravelerPalette' }), new T.MeshStandardMaterial({ vertexColors: true, name: 'TravelerGlow' })];
  const swordMesh = new T.Mesh(swordGeometry, swordMaterials); swordMesh.name = 'TravelerSword';
  // Sockets carry the sword. Grip axis runs index->pinky; the blade leaves the fist on the index side.
  function socket(name, parent, position, quaternion) {
    const s = new T.Object3D(); s.name = name; parent.updateMatrixWorld(true);
    s.position.copy(parent.worldToLocal(position.clone()));
    s.quaternion.copy(parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(quaternion));
    parent.add(s); return s;
  }
  const handQ = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(-1, 0, 0), new T.Vector3(0, 0, 1), new T.Vector3(0, 1, 0)));
  const grip = at('middle_01_r').lerp(at('hand_r'), .15).add(new T.Vector3(0, -.035, -.012));
  socket('socket_hand_r', bone('hand_r'), grip, handQ);
  socket('socket_back', bone('spine_03'), guard.clone().addScaledVector(bladeDir, -.075), backQ).add(swordMesh);

  // 6b. Face shell: a thin UV patch hugging the front of the head and chin (raycast onto those
  // two skin shapes only, so it never slides over the hair). The runtime draws anime eyes,
  // brows, mouth and blush into a small canvas texture on it and swaps expressions.
  {
    const centre = new T.Vector3(0, 1.75, .01), skinShapes = [
      [[0, 1.77, .01], [.205, .228, .192]],
    ].map(([at, scale]) => { const m = new T.Mesh(headGeometry()); m.position.set(...at); m.scale.set(...scale); m.updateMatrixWorld(true); return m; });
    // Front patch: phi spans the face width (+z is the front), theta from brow to chin.
    const patch = new T.SphereGeometry(1, 36, 28, Math.PI / 2 - .95, 1.9, Math.PI * .3, Math.PI * .42);
    const ray = new T.Raycaster(), dir = new T.Vector3(), pos = patch.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      dir.fromBufferAttribute(pos, i).normalize();
      ray.set(centre.clone().addScaledVector(dir, 1), dir.clone().negate());
      const hit = ray.intersectObjects(skinShapes)[0];
      const p = hit ? hit.point.addScaledVector(dir, .0025) : centre.clone().addScaledVector(dir, .21);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    patch.computeVertexNormals();
    for (const m of skinShapes) m.geometry.dispose();
    // Geometry is in model space; the socket at the origin with identity orientation keeps it there.
    const faceSocket = socket('socket_face', bone('Head'), new T.Vector3(), new T.Quaternion());
    const face = new T.Mesh(patch, new T.MeshStandardMaterial({ name: 'TravelerFace', transparent: true }));
    face.name = 'TravelerFace'; faceSocket.add(face);
  }

  // 7. One skinned mesh with an opaque palette group and an unlit glow group.
  const geometry = body.finish();
  const materials = [new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, skinning: true, side: T.DoubleSide, name: 'TravelerPalette' }),
    new T.MeshStandardMaterial({ vertexColors: true, skinning: true, name: 'TravelerGlow' })];
  const traveler = new T.SkinnedMesh(geometry, materials); traveler.name = 'Traveler'; traveler.frustumCulled = false;
  root.updateMatrixWorld(true);
  const boneInverses = [...skeleton.boneInverses, ...capeBones.map(b => b.matrixWorld.clone().invert())];
  traveler.bind(new T.Skeleton(bones, boneInverses), new T.Matrix4()); root.add(traveler);
  for (const mesh of originals) mesh.parent.remove(mesh);

  // 8. Clips: keep rotations, pelvis translation and root height. Bone scale and
  //    other translations never change in this rig, and leaf bones are never skinned.
  //    Forward root travel becomes a small sampled curve the controller can follow.
  const rootMotion = {};
  const clips = Object.entries(CLIPS).map(([name, [packId, source, motionSource]]) => {
    const found = animations[packId].find(c => c.name === source); if (!found) throw new Error(`Missing clip ${source}`);
    const clip = found.clone(); clip.name = name;
    clip.tracks = clip.tracks.filter(t => {
      const [node, prop] = t.name.split('.');
      return !node.includes('_leaf') && prop !== 'scale' && (prop !== 'position' || node === 'root' || node === 'pelvis');
    });
    if (motionSource) {
      const motionClip = animations[packId].find(c => c.name === motionSource);
      const track = motionClip.tracks.find(t => t.name === 'root.position'), samples = [], rate = 30;
      for (let s = 0; s <= Math.ceil(motionClip.duration * rate); s++) {
        const time = Math.min(motionClip.duration, s / rate), values = track.createInterpolant().evaluate(time);
        samples.push(+(values[2] - track.values[2]).toFixed(3));
      }
      rootMotion[name] = { rate, z: samples };
    }
    for (const track of clip.tracks) if (track.name === 'root.position') for (let i = 0; i < track.values.length; i += 3) { track.values[i] = track.values[0]; track.values[i + 2] = track.values[2]; }
    return clip.optimize();
  });
  root.userData = { author: 'DreamScape', character: 'Sigil-blade wanderer', rig: 'Quaternius Universal Animation Library 1+2 (CC0)', version: 2, rootMotion };
  const buffer = await new Promise(resolve => new T.GLTFExporter().parse(root, resolve, { binary: true, animations: clips, trs: true, onlyVisible: true }));
  return { buffer, stats: { bytes: buffer.byteLength, vertices: body.vertices, triangles: body.triangles, swordTriangles: sword.triangles, bones: bones.length, clips: clips.map(c => c.name), textures: 0, meshes: 2 } };
}
