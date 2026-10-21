/* Spade Kingdom boid swarm: separation + alignment + cohesion + player steering. */
import { spadeOutline } from './spade.js';
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

    // Each wisp is a small spade from the kingdom's crest: an upright fin, tip forward, stem trailing.
    // Dark ink faces, glowing violet rim (extrude group 0 = faces, 1 = sides).
    const geometry = new THREE.ExtrudeGeometry(spadeOutline(), { depth: 0.9, bevelEnabled: false, curveSegments: 6 });
    geometry.translate(0, 0, -0.45).scale(0.075, 0.09, 0.075).rotateY(Math.PI / 2).rotateX(Math.PI / 2);
    this.faces = new THREE.MeshPhongMaterial({ color: 0x1c1535, emissive: 0x3a2378, emissiveIntensity: 0.6, shininess: 60 });
    this.rim = new THREE.MeshPhongMaterial({ color: 0xc4a7ff, emissive: 0x8a5cff, emissiveIntensity: 1.6 });
    this.mesh = new THREE.InstancedMesh(geometry, [this.faces, this.rim], count);
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
      this.dummy.lookAt(this.positions[i].clone().add(velocity));
      // Flutter: roll each spade about its flight line, out of phase, so few are ever seen edge-on
      // (a thin edge-on spade reads as a white "pencil").
      this.dummy.rotateZ(Math.sin(performance.now() * 0.004 + i * 1.3) * 1.1);
      this.dummy.scale.setScalar(0.8 + Math.min(0.45, velocity.length() * 0.035));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.rim.emissiveIntensity = 1.2 + chaos * 2.5;
    this.faces.emissive.setHex(chaos > 0.4 ? 0x5a1c4a : 0x3a2378); // the ink smoulders crimson in chaos
  }
}
