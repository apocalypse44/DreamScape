/* Spade Kingdom boid swarm: separation + alignment + cohesion + player steering. */
const WISP = new THREE.Color(0xc9a8ff), REMEMBERED = new THREE.Color(0xffcf6a), CHAOS = new THREE.Color(0xff6fae);

// A wisp: one of Spade's stolen people. A soft flame with a bright core, a tail streaming behind and
// two tiny dark eyes looking where it flies (+z). Vertex colours stay pale so each instance's
// colour sets the hue: violet, gold once its name is remembered, crimson in chaos.
function wispGeometry() {
  const parts = [];
  const add = (geometry, shade) => {
    const g = geometry.toNonIndexed(), n = g.attributes.position.count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => shade(g.attributes.position, Math.floor(i / 3))), 3));
    parts.push(g);
  };
  const body = new THREE.LatheGeometry([[0, -.09], [.06, -.075], [.09, -.03], [.085, .02], [.06, .08], [.03, .15], [0, .25]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
  body.rotateX(-Math.PI / 2); // round head forward (+z), tail behind (-z)
  add(body, (p, i) => .55 + .45 * Math.min(1, Math.max(0, (p.getZ(i) + .2) / .25))); // the tail fades
  add(new THREE.SphereGeometry(.05, 10, 8).translate(0, 0, .02), () => 1.15);            // bright core
  for (const x of [-.042, .042]) add(new THREE.SphereGeometry(.017, 8, 6).translate(x, .04, .068), () => .04); // eyes
  const merged = new THREE.BufferGeometry(), position = [], color = [];
  for (const g of parts) { position.push(...g.attributes.position.array); color.push(...g.attributes.color.array); g.dispose(); }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  return merged;
}
// The wisps as two instanced meshes (bodies and soft halos); `paint(i, color)` sets one wisp's hue.
export function createWisps(count) {
  const body = new THREE.InstancedMesh(wispGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), count);
  const halo = new THREE.InstancedMesh(new THREE.SphereGeometry(.2, 10, 8), new THREE.MeshBasicMaterial({
    transparent: true, opacity: .26, depthWrite: false, toneMapped: false }), count); // normal blending: no white-out on bright skies
  for (const m of [body, halo]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; }
  const group = new THREE.Group(); group.add(body, halo);
  return {
    group, body, halo,
    paint(i, color) { body.setColorAt(i, color); halo.setColorAt(i, color); body.instanceColor.needsUpdate = halo.instanceColor.needsUpdate = true; },
    place(i, matrix) { body.setMatrixAt(i, matrix); halo.setMatrixAt(i, matrix); },
    commit() { body.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true; },
  };
}

export class DreamSwarm {
  constructor(scene, terrainHeight, count = 84) {
    this.scene = scene;
    this.terrainHeight = terrainHeight;
    this.count = count;
    this.enabled = false;
    this.positions = [];
    this.previous = []; // last frame's positions, for swept hit tests
    this.velocities = [];
    this.accelerations = Array.from({ length: count }, () => new THREE.Vector3());
    this.forward = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.dummy = new THREE.Object3D();

    // remembered: how many wisps have their name back (one per lit memory lantern); they glow gold.
    this.remembered = 0;
    this.wisps = createWisps(count);
    this.mesh = this.wisps.group;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.palette = '';

    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshBasicMaterial({ color:0xdacaff, wireframe:true, transparent:true, opacity:0.75 })
    );
    this.marker.visible = false;
    scene.add(this.marker);
  }

  seedAround(center) {
    this.positions.length = 0;
    this.previous.length = 0;
    this.velocities.length = 0;
    for (let i = 0; i < this.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 15;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      const floor = this.terrainHeight(x, z);
      this.positions.push(new THREE.Vector3(x, floor + 2 + Math.random() * 9, z));
      this.previous.push(this.positions[i].clone());
      this.velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 3
      ));
    }
  }

  setEnabled(enabled, playerPosition) {
    if (enabled && !this.enabled) this.seedAround(playerPosition);
    this.enabled = enabled;
    this.mesh.visible = enabled;
    if (!enabled) this.marker.visible = false;
  }

  // strike (optional {x, y, z}): with mode "strike" the flock dives through this point instead.
  update(dt, playerPosition, camera, mode, chaos, strike = null) {
    if (!this.enabled) return;
    if (mode === "strike" && !strike) mode = "repel";
    camera.getWorldDirection(this.forward);
    this.target.copy(playerPosition).addScaledVector(this.forward, mode === "recall" ? 2 : 13);
    this.target.y += mode === "recall" ? 4 : 1.5;
    if (mode === "strike") this.target.set(strike.x, strike.y, strike.z);
    this.marker.position.copy(this.target);
    this.marker.visible = mode === "attract" || mode === "repel" || mode === "strike";
    this.marker.material.color.set(mode === "attract" ? 0xdacaff : 0xff6f9f);
    this.marker.rotation.y += dt * 2;
    const neighborRadiusSq = 7.5 * 7.5;
    const separationRadiusSq = 2.1 * 2.1;

    for (let i = 0; i < this.count; i++) {
      const position = this.positions[i];
      const velocity = this.velocities[i];
      const acceleration = this.accelerations[i].set(0, 0, 0);
      const alignment = new THREE.Vector3();
      const cohesion = new THREE.Vector3();
      const separation = new THREE.Vector3();
      let neighbors = 0;

      for (let j = 0; j < this.count; j++) {
        if (i === j) continue;
        const other = this.positions[j];
        const dx = other.x - position.x;
        const dy = other.y - position.y;
        const dz = other.z - position.z;
        const distanceSq = dx*dx + dy*dy + dz*dz;
        if (distanceSq < neighborRadiusSq) {
          alignment.add(this.velocities[j]);
          cohesion.add(other);
          neighbors++;
          if (distanceSq < separationRadiusSq && distanceSq > 0.001) {
            separation.add(new THREE.Vector3(-dx, -dy, -dz).multiplyScalar(1 / distanceSq));
          }
        }
      }

      if (neighbors) {
        alignment.multiplyScalar(1 / neighbors).sub(velocity).multiplyScalar(0.55);
        cohesion.multiplyScalar(1 / neighbors).sub(position).multiplyScalar(0.09);
        acceleration.add(alignment).add(cohesion).addScaledVector(separation, 1.8);
      }

      const toTarget = this.target.clone().sub(position);
      if (mode === "attract") acceleration.addScaledVector(toTarget.normalize(), 4.8);
      if (mode === "repel" && toTarget.lengthSq() < 28 * 28) acceleration.addScaledVector(toTarget.normalize(), -8.5);
      if (mode === "recall") acceleration.addScaledVector(toTarget.normalize(), 7.5);
      if (mode === "strike") acceleration.addScaledVector(toTarget.normalize(), 9.5);

      const fromPlayer = position.clone().sub(playerPosition);
      if (fromPlayer.lengthSq() > 42 * 42) acceleration.addScaledVector(fromPlayer.normalize(), -4.5);
      const floor = this.terrainHeight(position.x, position.z) + 1.2;
      if (position.y < floor + 2.2) acceleration.y += 5.5;
      if (position.y > floor + 16) acceleration.y -= 2.5;
      acceleration.y += Math.sin(i * 1.7 + performance.now() * 0.0015) * 0.09;
    }

    const minSpeed = 2.2 + chaos * 1.4;
    const maxSpeed = 5.2 + chaos * 4.8;
    for (let i = 0; i < this.count; i++) {
      const velocity = this.velocities[i];
      velocity.addScaledVector(this.accelerations[i], dt);
      let speed = velocity.length();
      if (speed > maxSpeed) velocity.multiplyScalar(maxSpeed / speed);
      else if (speed < minSpeed) velocity.multiplyScalar(minSpeed / Math.max(speed, 0.01));
      this.previous[i].copy(this.positions[i]);
      this.positions[i].addScaledVector(velocity, dt);
      const ground = this.terrainHeight(this.positions[i].x, this.positions[i].z) + 0.8;
      if (this.positions[i].y < ground) {
        this.positions[i].y = ground;
        velocity.y = Math.abs(velocity.y) + 0.5;
      }
      this.dummy.position.copy(this.positions[i]);
      this.dummy.position.y += Math.sin(performance.now() * .003 + i * 1.7) * .06; // a gentle bob
      this.dummy.lookAt(this.positions[i].clone().add(velocity));
      // Faster wisps stretch along their flight (a startled streak in chaos); remembered ones are larger.
      const stretch = Math.min(.6, velocity.length() * .05), size = i < this.remembered ? 1.35 : 1;
      this.dummy.scale.set(size * (1 - stretch * .3), size * (1 - stretch * .3), size * (1 + stretch));
      this.dummy.updateMatrix();
      this.wisps.place(i, this.dummy.matrix);
    }
    this.wisps.commit();
    // Colours change only when the remembered count or the calm/chaos state does.
    const palette = `${this.remembered}|${chaos > 0.4}`;
    if (palette !== this.palette) {
      this.palette = palette;
      for (let i = 0; i < this.count; i++) this.wisps.paint(i, i < this.remembered ? REMEMBERED : chaos > 0.4 ? CHAOS : WISP);
    }
  }
}
