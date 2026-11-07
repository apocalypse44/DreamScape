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

// The Triad: Veyr the Binder, Sile the Harvester and Morcant the Gatekeeper, each an original
// people-kit recipe (tools/peopleBuilder.js, CHARACTER_PLAN.md 5.12) floating in an aura.
export const TRIAD = {
  veyr: { person: 'veyr', size: 1.12, aura: 0x7a45ff },
  sile: { person: 'sile', size: 1, aura: 0xff3355 },
  morcant: { person: 'morcant', size: 1.15, aura: 0xd8c27a },
};
export function createTriad({ npcs, group }) {
  const members = {};
  for (const [name, def] of Object.entries(TRIAD)) {
    const actor = npcs?.actor?.(def);
    if (!actor) continue;
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), new THREE.MeshBasicMaterial({ color: def.aura, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(actor.group, aura);
    members[name] = { actor, aura, size: def.size, phase: Object.keys(members).length * 2.1 };
  }
  return {
    members,
    // place: { name: { x, y, z, yaw } }; presence (0..1) scales each member in or out; clips: { name: [clip, once] }.
    update(t, dt, place, presence, clips) {
      for (const [name, m] of Object.entries(members)) {
        const p = place[name], k = presence[name] ?? 0, g = m.actor.group;
        g.visible = k > 0; g.scale.setScalar(Math.max(.001, k * m.size));
        g.position.set(p.x, p.y + Math.sin(t * 1.3 + m.phase) * .3, p.z); g.rotation.y = p.yaw;
        const [clip, once] = clips[name] ?? ['Spell_Simple_Idle_Loop', false]; m.actor.play(clip, .2, once); m.actor.update(dt);
        m.aura.position.set(g.position.x, g.position.y + 1.2 * k, g.position.z);
        m.aura.material.opacity = k * (.16 + .05 * Math.sin(t * 5 + m.phase));
      }
    },
    // A member's casting hand, roughly: in front of the chest.
    hand(name, out = new THREE.Vector3()) {
      const g = members[name]?.actor.group;
      if (!g) return null;
      return out.set(g.position.x + Math.sin(g.rotation.y) * .5, g.position.y + 1.3 * g.scale.y, g.position.z + Math.cos(g.rotation.y) * .5);
    },
    dispose() {
      for (const m of Object.values(members)) { m.actor.dispose(); m.aura.parent?.remove(m.aura); }
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
