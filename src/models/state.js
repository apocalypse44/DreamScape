// Starting conditions restored by reset.
export const START = { chaos: 0.06, mode: 'calm', yaw: 0, pitch: -0.08, lastMoveAngle: 0, interactionLock: 0, cinematic: false };

export function createGameState() {
  const state = { ...START, locked: false, elapsed: 0, hintTimer: 0 };
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
