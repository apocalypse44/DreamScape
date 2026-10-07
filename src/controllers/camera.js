export function createCameraController({ camera, state, player, chunks, terrainHeight, staticObstacles = [] }) {
  const target = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const candidate = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  return {
    update() {
      camera.rotation.order = 'YXZ';
      camera.rotation.set(state.pitch, state.yaw, 0);
      if (state.perspective === 'first') {
        camera.position.copy(player.position);
        return 0;
      }
      target.copy(player.position);
      target.y -= 0.3;
      direction.set(0, 0, 1).applyEuler(camera.rotation);
      let distance = 4.5;
      raycaster.set(target, direction);
      raycaster.near = 0;
      raycaster.far = distance + 0.25;
      const obstacles = [...chunks.values(), ...staticObstacles];
      obstacles.forEach(chunk => chunk.updateMatrixWorld(true));
      const hit = raycaster.intersectObjects(obstacles, true)[0];
      if (hit) distance = Math.max(0.1, hit.distance - 0.3);
      // Keep the camera boom above the ground even on back-facing slopes.
      for (let step = 0.15; step <= distance; step += 0.15) {
        candidate.copy(target).addScaledVector(direction, step);
        if (candidate.y < terrainHeight(candidate.x, candidate.z) + 0.25) {
          distance = Math.max(0.1, step - 0.15);
          break;
        }
      }
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target);
      return distance;
    }
  };
}
