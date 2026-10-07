const SHOULDER = 0.85; // metres right of the head

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
      // Over-the-shoulder: the boom pivots right of the head, so the character sits left of
      // centre and the crosshair (screen centre) points at the world ahead, not the player.
      direction.set(1, 0, 0).applyEuler(camera.rotation);
      const obstacles = [...chunks.values(), ...staticObstacles];
      obstacles.forEach(chunk => chunk.updateMatrixWorld(true));
      raycaster.set(player.position, direction);
      raycaster.near = 0;
      raycaster.far = SHOULDER + 0.3;
      const wall = raycaster.intersectObjects(obstacles, true)[0];
      const shoulder = wall ? Math.max(0, wall.distance - 0.3) : SHOULDER;
      target.copy(player.position).addScaledVector(direction, shoulder);
      target.y += 0.1;
      direction.set(0, 0, 1).applyEuler(camera.rotation);
      let distance = 3.8;
      raycaster.set(target, direction);
      raycaster.near = 0;
      raycaster.far = distance + 0.25;
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
      return distance;
    }
  };
}
