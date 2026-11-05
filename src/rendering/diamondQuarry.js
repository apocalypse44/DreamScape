// Diamond · Shatterglass Quarry dressing (the pit itself is terrain: src/models/diamondQuarry.js).
// Cut crystal stumps on the benches, uncut crystal clusters on the rim, two timber derricks
// hoisting crystal blocks, a cart track down the haul ramp, and lanterns lining it.
// No new lights: lanterns and crystals glow through their materials. In chaos the crystals
// turn Triad violet.

const CRYSTAL = new THREE.Color(0xcfe9ff), CRYSTAL_GLOW = new THREE.Color(0x3a6f9a);
const VIOLET = new THREE.Color(0xb48cff), VIOLET_GLOW = new THREE.Color(0x5a1f9a);
const TIMBER = 0x6b4a2b, IRON = 0x3b3f46;

// quarry: world.quarry. layout: the Diamond campaign layout (Orin, fragments, board).
// surfaceHeight(x, z): the drawn ground height.
export function buildDiamondQuarry({ scene, quarry, layout, surfaceHeight }) {
  const root = new THREE.Group();
  root.name = 'diamond-quarry';
  scene.add(root);
  const colliders = [];
  const keepClear = [layout.orin, ...layout.fragments];
  const clear = (p, r) => keepClear.every(q => Math.hypot(p.x - q.x, p.z - q.z) > r);
  const onRamp = (u, v) => u > 5 && Math.abs(v) < 4.5;
  // Points around a ring, skipping the haul ramp and the quest's standing spots.
  function ring(radius, count, phase) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = phase + i / count * Math.PI * 2;
      const u = Math.cos(a) * radius, v = Math.sin(a) * radius;
      const p = quarry.at(u, v);
      if (!onRamp(u, v) && clear(p, 3.2)) out.push({ ...p, a, i });
    }
    return out;
  }
  const dummy = new THREE.Object3D();
  const crystalMat = new THREE.MeshStandardMaterial({ color: CRYSTAL.clone(), emissive: CRYSTAL_GLOW.clone(), emissiveIntensity: 0.6,
    roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });

  // Cut stumps: hexagonal prisms sawn flat, left where the workers stopped. Benches and floor edge.
  const stumpSpots = [...ring(15.2, 11, 0.3), ...ring(21.8, 15, 0.1), ...ring(10.2, 7, 0.5)];
  const stumps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.85, 1, 6), crystalMat, stumpSpots.length);
  stumpSpots.forEach((p, k) => {
    const h = 0.6 + ((p.i * 37) % 10) / 10 * 1.4;
    dummy.position.set(p.x, surfaceHeight(p.x, p.z) + h / 2 - 0.1, p.z);
    dummy.rotation.set(0, p.a, ((p.i * 13) % 7 - 3) * 0.03);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    stumps.setMatrixAt(k, dummy.matrix);
    colliders.push({ x: p.x, z: p.z, radius: 0.7, height: () => h });
  });
  stumps.castShadow = true;
  root.add(stumps);

  // Uncut clusters on the rim: three leaning shards each, the seams the quarry was dug for.
  const rimSpots = ring(28.5, 12, 0.2);
  const shards = new THREE.InstancedMesh(new THREE.CylinderGeometry(0, 0.9, 1, 6), crystalMat, rimSpots.length * 3);
  rimSpots.forEach((p, k) => {
    const y = surfaceHeight(p.x, p.z);
    for (let s = 0; s < 3; s++) {
      const h = (s ? 2.6 : 4.6) + ((p.i + s * 5) % 4) * 0.5, lean = s ? 0.45 : 0.12;
      const side = s === 1 ? 1 : s === 2 ? -1 : 0;
      dummy.position.set(p.x + Math.cos(p.a + side) * 0.7 * Math.abs(side), y + h / 2 - 0.3, p.z + Math.sin(p.a + side) * 0.7 * Math.abs(side));
      dummy.rotation.set(lean * side, p.a, lean * (s === 0 ? 1 : -side * 0.5));
      dummy.scale.set(s ? 0.7 : 1, h, s ? 0.7 : 1);
      dummy.updateMatrix();
      shards.setMatrixAt(k * 3 + s, dummy.matrix);
    }
    colliders.push({ x: p.x, z: p.z, radius: 1.1 });
  });
  shards.castShadow = true;
  root.add(shards);

  // Timber derricks on the rim, each hoisting a cut crystal block over the pit.
  const timber = new THREE.MeshStandardMaterial({ color: TIMBER, roughness: 0.9, flatShading: true });
  const iron = new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.6, metalness: 0.5 });
  const hoisted = [];
  for (const angle of [Math.PI * 0.62, -Math.PI * 0.55]) {
    const base = quarry.at(Math.cos(angle) * 27, Math.sin(angle) * 27);
    const inward = Math.atan2(quarry.center.x - base.x, quarry.center.z - base.z);
    const derrick = new THREE.Group();
    derrick.position.set(base.x, surfaceHeight(base.x, base.z), base.z);
    derrick.rotation.y = inward;
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), timber);
    mast.position.y = 4.5;
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 9), timber);
    boom.position.set(0, 8.2, 4);
    boom.rotation.x = -0.12;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 2.6), timber);
    foot.position.y = 0.2;
    derrick.add(mast, boom, foot);
    for (const s of [-1, 1]) { // A-frame braces
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6.4, 0.25), timber);
      brace.position.set(s * 1.1, 3, -0.6);
      brace.rotation.set(0.18, 0, s * 0.2);
      derrick.add(brace);
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4, 4), iron);
    rope.position.set(0, 7.1, 8.2);
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), crystalMat);
    block.position.set(0, 4.5, 8.2);
    derrick.add(rope, block);
    hoisted.push(block);
    for (const object of derrick.children) object.castShadow = true;
    root.add(derrick);
    colliders.push({ x: base.x, z: base.z, radius: 1.5 });
  }

  // Haul ramp: two iron rails on timber sleepers, a loaded cart at the foot, lanterns either side.
  const { start, end } = { start: 9.5, end: 27.5 };
  const steps = Math.round(end - start);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 1.02), iron, steps * 2);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.14, 0.32), timber, steps + 1);
  const point = (u, v) => { const p = quarry.at(u, v); return new THREE.Vector3(p.x, surfaceHeight(p.x, p.z), p.z); };
  for (let s = 0; s < steps; s++) {
    for (const [j, v] of [[0, -0.7], [1, 0.7]]) {
      const a = point(start + s, v), b = point(start + s + 1, v);
      dummy.position.copy(a).add(b).multiplyScalar(0.5);
      dummy.position.y += 0.18;
      dummy.scale.set(1, 1, 1);
      dummy.lookAt(b.x, b.y + 0.18, b.z);
      dummy.updateMatrix();
      rails.setMatrixAt(s * 2 + j, dummy.matrix);
    }
  }
  for (let s = 0; s <= steps; s++) {
    const a = point(start + s, 0), b = point(start + s + 0.5, 0);
    dummy.position.copy(a);
    dummy.position.y += 0.06;
    dummy.lookAt(b.x, b.y + 0.06, b.z);
    dummy.updateMatrix();
    sleepers.setMatrixAt(s, dummy.matrix);
  }
  rails.receiveShadow = sleepers.receiveShadow = true;
  root.add(rails, sleepers);

  const cartAt = point(start + 1.5, 0), cartAhead = point(start + 3, 0);
  const cart = new THREE.Group();
  cart.position.copy(cartAt);
  cart.lookAt(cartAhead.x, cartAt.y, cartAhead.z);
  const bin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.9), timber);
  bin.position.y = 0.75;
  cart.add(bin);
  for (const [x, z] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), iron);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.3, z);
    cart.add(wheel);
  }
  for (let s = 0; s < 4; s++) { // crystal load
    const piece = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), crystalMat);
    piece.position.set((s % 2 - 0.5) * 0.6, 1.25 + (s > 1 ? 0.2 : 0), (s < 2 ? -0.4 : 0.4));
    piece.scale.y = 1.5;
    cart.add(piece);
  }
  for (const object of cart.children) object.castShadow = true;
  root.add(cart);
  colliders.push({ x: cartAt.x, z: cartAt.z, radius: 1.1 });

  const lanternGlow = new THREE.MeshBasicMaterial({ color: 0xffd37a });
  for (let u = start + 2; u <= end; u += 6) {
    for (const v of [-2.9, 2.9]) {
      const p = point(u, v);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), timber);
      post.position.set(p.x, p.y + 1.2, p.z);
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), lanternGlow);
      lamp.position.set(p.x, p.y + 2.5, p.z);
      root.add(post, lamp);
    }
  }

  // Chaos: two dust devils wander the pit, twisting columns of sand (Kenney Particle Pack circle sprite).
  const DEVIL = 140;
  const dustSprite = new THREE.TextureLoader().load(encodeURI('assets/kenney_particle-pack/PNG (Transparent)/circle_05.png'));
  const devils = [0, 1].map(k => {
    const positions = new Float32Array(DEVIL * 3), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ map: dustSprite, color: 0xb08a5a, size: 0.6, transparent: true, opacity: 0, depthWrite: false }));
    points.frustumCulled = false; points.visible = false; root.add(points);
    return { k, points, positions };
  });

  const tint = new THREE.Color(), glow = new THREE.Color();
  let time = 0, shown = -1;
  return {
    root, colliders,
    update(dt, chaos) {
      time += dt;
      const storm = Math.max(0, Math.min(1, (chaos - 0.35) / 0.3));
      for (const d of devils) {
        d.points.visible = storm > 0;
        if (!d.points.visible) continue;
        d.points.material.opacity = storm * 0.55;
        // Each wanders a loop over the floor and benches; the column leans and spins.
        const a = time * (0.12 + d.k * 0.05) + d.k * 3, r = 7 + d.k * 9 + Math.sin(time * 0.3 + d.k) * 3;
        const cx = quarry.center.x + Math.cos(a) * r, cz = quarry.center.z + Math.sin(a) * r, cy = quarry.pit(cx, cz);
        for (let i = 0; i < DEVIL; i++) {
          const h = (i / DEVIL) * 9, spin = time * (4 + d.k) + i * 0.7, rad = 0.3 + h * 0.32;
          d.positions[i * 3] = cx + Math.cos(spin) * rad + h * 0.15;
          d.positions[i * 3 + 1] = cy + h;
          d.positions[i * 3 + 2] = cz + Math.sin(spin) * rad;
        }
        d.points.geometry.attributes.position.needsUpdate = true;
      }
      for (let k = 0; k < hoisted.length; k++) hoisted[k].rotation.y = time * 0.3 + k; // blocks turn on the rope
      const c = Math.round(Math.max(0, Math.min(1, (chaos - 0.3) / 0.4)) * 50) / 50;
      if (c === shown) return;
      shown = c;
      crystalMat.color.copy(tint.copy(CRYSTAL).lerp(VIOLET, c));
      crystalMat.emissive.copy(glow.copy(CRYSTAL_GLOW).lerp(VIOLET_GLOW, c));
      crystalMat.emissiveIntensity = 0.6 + c * 0.8;
    },
  };
}
