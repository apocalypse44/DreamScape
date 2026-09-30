export function createGameState() {
  const state = { chaos: 0.06, yaw: 0, pitch: -0.08, locked: false, elapsed: 0, lastMoveAngle: 0, hintTimer: 0 };
  const keys = new Set();
  state.perspective = 'third';
  const pointerButtons = new Set();
  const player = {
    position: new THREE.Vector3(0, 20, 0),
    velocity: new THREE.Vector3(),
    grounded: false
  };
  return { state, keys, pointerButtons, player };
}
