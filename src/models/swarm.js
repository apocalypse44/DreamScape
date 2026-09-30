/* Violet Mist boid swarm: separation + alignment + cohesion + player steering. */
export class DreamSwarm {
  constructor(scene, terrainHeight, count = 84) {
    this.scene = scene;
    this.terrainHeight = terrainHeight;
    this.count = count;
    this.enabled = false;
    this.positions = [];
    this.velocities = [];
    this.accelerations = Array.from({ length: count }, () => new THREE.Vector3());
    this.forward = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.dummy = new THREE.Object3D();

    const geometry = new THREE.ConeGeometry(0.13, 0.7, 3);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshPhongMaterial({
      color: 0xc4a7ff,
      emissive: 0x6242a8,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.9
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshBasicMaterial({ color:0xdacaff, wireframe:true, transparent:true, opacity:0.75 })
    );
    this.marker.visible = false;
    scene.add(this.marker);
  }

  seedAround(center) {
    this.positions.length = 0;
    this.velocities.length = 0;
    for (let i = 0; i < this.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 15;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      const floor = this.terrainHeight(x, z);
      this.positions.push(new THREE.Vector3(x, floor + 2 + Math.random() * 9, z));
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

  update(dt, playerPosition, camera, mode, chaos) {
    if (!this.enabled) return;
    camera.getWorldDirection(this.forward);
    this.target.copy(playerPosition).addScaledVector(this.forward, mode === "recall" ? 2 : 13);
    this.target.y += mode === "recall" ? 4 : 1.5;
    this.marker.position.copy(this.target);
    this.marker.visible = mode === "attract" || mode === "repel";
    this.marker.material.color.set(mode === "repel" ? 0xff6f9f : 0xdacaff);
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
      this.positions[i].addScaledVector(velocity, dt);
      const ground = this.terrainHeight(this.positions[i].x, this.positions[i].z) + 0.8;
      if (this.positions[i].y < ground) {
        this.positions[i].y = ground;
        velocity.y = Math.abs(velocity.y) + 0.5;
      }
      this.dummy.position.copy(this.positions[i]);
      this.dummy.lookAt(this.positions[i].clone().add(velocity));
      this.dummy.scale.setScalar(0.8 + Math.min(0.45, velocity.length() * 0.035));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.material.emissiveIntensity = 1.2 + chaos * 2.5;
  }
}
