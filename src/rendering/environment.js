export function createEnvironment({ scene, state, player, chunks }) {
  // The motes have velocity, ambient force, drag, and bounded respawning.
  const moteCount = 240;
  const motePositions = new Float32Array(moteCount * 3);
  const moteVelocity = [];
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 120;
    motePositions[i * 3 + 1] = Math.random() * 28;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    moteVelocity.push(new THREE.Vector3());
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xc6ff70,
    size: 0.28,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  function updateMotes(dt) {
    const positions = moteGeo.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);
      const velocity = moteVelocity[i];
      velocity.x += Math.sin(state.elapsed * 0.7 + i) * state.chaos * 0.04 * dt;
      velocity.z += Math.cos(state.elapsed * 0.6 + i * 2) * state.chaos * 0.04 * dt;
      velocity.y += Math.sin(state.elapsed + i) * 0.006 * dt;
      velocity.multiplyScalar(Math.pow(0.94, dt));
      x += velocity.x * dt;
      y += velocity.y * dt;
      z += velocity.z * dt;
      if (Math.abs(x - player.position.x) > 70 || Math.abs(z - player.position.z) > 70 || y < 0 || y > 35) {
        x = player.position.x + (Math.random() - 0.5) * 120;
        z = player.position.z + (Math.random() - 0.5) * 120;
        y = 3 + Math.random() * 25;
        velocity.set(0, 0, 0);
      }
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  }

  function animateEnvironment() {
    const wind = 0.018 + state.chaos * 0.15;
    const speed = 0.65 + state.chaos * 3.2;
    for (const chunk of chunks.values()) {
      for (const item of chunk.userData.animated) {
        const wave = Math.sin(state.elapsed * speed + item.phase);
        if (item.type === "trees" || item.type === "hub" || item.type === "wisps") {
          item.object.rotation.z = wave * wind;
          item.object.rotation.x = Math.cos(state.elapsed * speed * 0.7 + item.phase) * wind * 0.45;
        } else if (item.type === "crystals") {
          item.object.rotation.y = item.baseRotation + wave * state.chaos * 0.08;
        }
      }
    }
    moteMat.opacity = 0.3 + state.chaos * 0.65;
    moteMat.size = 0.2 + state.chaos * 0.42;
  }

  return { moteMat, updateMotes, animateEnvironment };
}
