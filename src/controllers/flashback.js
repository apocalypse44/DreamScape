// Shared pieces for story flashbacks (cloverFlashback.js, emberFlashback.js): timing helpers, actor
// blocking, the Dark Triad as floating actors, smoke and beams. Each flashback is a pure stage(t)
// timeline plus a director that applies it, then restores the present.

export const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
export const pulse = (t, at, width) => Math.max(0, 1 - Math.abs(t - at) / width);

// Blocking: keys are [time, x, z, clip from this time on]. Actors move in straight lines between keys.
export function castPose(keys, t) {
  let i = keys.length - 1;
  while (i > 0 && t < keys[i][0]) i--;
  const [t0, x0, z0, clip] = keys[i], next = keys[i + 1];
  if (!next || t <= t0) return { x: x0, z: z0, clip, moving: false };
  const [t1, x1, z1] = next, k = Math.min(1, (t - t0) / (t1 - t0)), moving = Math.hypot(x1 - x0, z1 - z0) > .01;
  return { x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, clip, moving, dx: x1 - x0, dz: z1 - z0 };
}
// Place a walking actor for this frame: position, facing (motion, else `face`) and clip.
export function poseActor(actor, keys, face, t, dt, y) {
  const pose = castPose(keys, t), g = actor.group;
  g.position.set(pose.x, y, pose.z);
  const yaw = pose.moving ? Math.atan2(pose.dx, pose.dz) : Math.atan2(face.x - pose.x, face.z - pose.z);
  g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 8);
  actor.play(pose.clip); actor.update(dt);
}

const solid = color => new THREE.MeshStandardMaterial({ color, roughness: .7 });
// The Dark Triad, after Black Clover's: Veyr the Binder (Dante: long black hair, flared collar, violet
// coat), Sile the Harvester (Vanica: crimson, horns) and Morcant the Gatekeeper (Zenon: charcoal, a
// pale bone crown). Mannequin actors with head pieces that follow the 'Head' bone, and each an aura.
function headPieces(name) {
  const pieces = [];
  const add = (geometry, material, offset, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.set(...rotation);
    const holder = new THREE.Group(); holder.add(mesh); pieces.push({ holder, offset }); return mesh;
  };
  if (name === 'veyr') {
    const hair = solid(0x120c1e);
    add(new THREE.SphereGeometry(.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * .58), hair, [0, .04, -.01]);
    add(new THREE.CylinderGeometry(.15, .22, .85, 10), hair, [0, -.38, -.12]).scale.z = .45;      // long hair down the back
    add(new THREE.CylinderGeometry(.36, .2, .42, 14, 1, true, Math.PI * .2, Math.PI * 1.6), solid(0x3a2a62), [0, -.2, -.02]); // flared collar
  } else if (name === 'sile') {
    for (const side of [-1, 1]) add(new THREE.ConeGeometry(.045, .34, 8), solid(0x2a0a12), [side * .09, .16, .02], [0, 0, -side * .45]); // horns
  } else {
    const bone = solid(0xe8e2d0);
    add(new THREE.TorusGeometry(.15, .025, 6, 18), bone, [0, .1, 0], [Math.PI / 2, 0, 0]);       // crown band
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      add(new THREE.ConeGeometry(.03, .16, 6), bone, [Math.sin(a) * .15, .2, Math.cos(a) * .15]);
    }
  }
  return pieces;
}
export const TRIAD = {
  veyr: { body: 'M', tint: 0x2b2244, robe: 0x221838, aura: 0x7a45ff },
  sile: { body: 'F', tint: 0x5a1020, robe: 0x7a1530, aura: 0xff3355 },
  morcant: { body: 'M', tint: 0x2c2c33, robe: 0x26262c, aura: 0xd8c27a },
};
export function createTriad({ npcs, group }) {
  const members = {}, head = new THREE.Vector3(), offset = new THREE.Vector3();
  for (const [name, def] of Object.entries(TRIAD)) {
    const actor = npcs?.actor?.(def);
    if (!actor) continue;
    const pieces = headPieces(name), bone = actor.model.getObjectByName('Head');
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), new THREE.MeshBasicMaterial({ color: def.aura, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(actor.group, aura); for (const p of pieces) group.add(p.holder);
    members[name] = { actor, pieces, bone, aura, phase: Object.keys(members).length * 2.1 };
  }
  return {
    members,
    // place: { name: { x, y, z, yaw } }; presence (0..1) scales each member in or out; clips: { name: [clip, once] }.
    update(t, dt, place, presence, clips) {
      for (const [name, m] of Object.entries(members)) {
        const p = place[name], k = presence[name] ?? 0, g = m.actor.group;
        g.visible = k > 0; g.scale.setScalar(Math.max(.001, k));
        g.position.set(p.x, p.y + Math.sin(t * 1.3 + m.phase) * .3, p.z); g.rotation.y = p.yaw;
        const [clip, once] = clips[name] ?? ['Spell_Simple_Idle_Loop', false]; m.actor.play(clip, .2, once); m.actor.update(dt);
        m.aura.position.set(g.position.x, g.position.y + 1.2 * k, g.position.z);
        m.aura.material.opacity = k * (.16 + .05 * Math.sin(t * 5 + m.phase));
        g.updateMatrixWorld(true); m.bone?.getWorldPosition(head);
        for (const piece of m.pieces) {
          piece.holder.visible = k > 0 && Boolean(m.bone);
          offset.set(...piece.offset).multiplyScalar(k).applyAxisAngle(THREE.Object3D.DefaultUp, p.yaw);
          piece.holder.position.copy(head).add(offset); piece.holder.rotation.y = p.yaw; piece.holder.scale.setScalar(Math.max(.001, k));
        }
      }
    },
    // A member's casting hand, roughly: in front of the chest.
    hand(name, out = new THREE.Vector3()) {
      const g = members[name]?.actor.group;
      if (!g) return null;
      return out.set(g.position.x + Math.sin(g.rotation.y) * .5, g.position.y + 1.3 * g.scale.y, g.position.z + Math.cos(g.rotation.y) * .5);
    },
    dispose() {
      for (const m of Object.values(members)) { m.actor.dispose(); m.aura.parent?.remove(m.aura); for (const p of m.pieces) p.holder.parent?.remove(p.holder); }
    },
  };
}

// A burst of coloured smoke around a point; set(center, strength) each frame.
export function createSmoke(group, color, count = 70) {
  const data = new Float32Array(count * 3), seeds = Array.from({ length: count }, (_, i) => [i * 2.399, (i * .37) % 1.6 - .3, .5 + (i * .61) % 1]);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: .5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false; group.add(points);
  return {
    set(center, strength, t) {
      points.material.opacity = strength * .75;
      if (strength <= 0) return;
      seeds.forEach(([a, y, speed], i) => {
        const r = .4 + ((t * speed * .6) % 1) * 2.4;
        data.set([center.x + Math.cos(a + t * .4) * r, center.y + y + ((t * speed * .5) % 1) * 2.2, center.z + Math.sin(a + t * .4) * r], i * 3);
      });
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
// A glowing beam between two points; set(from, to, strength) each frame (strength 0 hides it).
export function createBeam(group, color, radius = .12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  mesh.visible = false; group.add(mesh);
  const up = new THREE.Vector3(0, 1, 0), along = new THREE.Vector3();
  return {
    set(from, to, strength) {
      mesh.visible = strength > 0 && Boolean(from && to);
      if (!mesh.visible) return;
      along.subVectors(to, from); mesh.position.lerpVectors(from, to, .5); mesh.scale.set(1, along.length(), 1);
      mesh.quaternion.setFromUnitVectors(up, along.normalize()); mesh.material.opacity = Math.min(1, strength) * .85;
    },
  };
}
