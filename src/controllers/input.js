export function bindInput({ state, keys, pointerButtons, player, renderer, camera, ui, onReset, onStress }) {
  const { enterButton, introEl } = ui;
  function clearInput() {
    keys.clear();
    pointerButtons.clear();
    player.velocity.x = 0;
    player.velocity.z = 0;
  }

  window.addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInput();
  });
  enterButton.addEventListener("click", () => {
    if (!enterButton.disabled) renderer.domElement.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", () => {
    state.locked = document.pointerLockElement === renderer.domElement;
    clearInput();
    if (state.locked) document.activeElement?.blur();
    // The map frees the mouse on purpose: stay in play mode (no intro screen) while it is open or
    // while waiting for the click that resumes after it closed.
    const inPlay = state.locked || state.mapOpen || state.awaitResume || state.cinematic;
    document.body.classList.toggle("playing", inPlay);
    introEl.classList.toggle("hidden", inPlay);
    if (state.locked) state.awaitResume = false;
  });
  document.addEventListener("mousemove", event => {
    if (!state.locked || state.cinematic) return;
    state.yaw -= event.movementX * 0.0022;
    state.pitch -= event.movementY * 0.002;
    state.pitch = THREE.MathUtils.clamp(state.pitch, -1.35, 1.35);
  });
  document.body.classList.toggle("tpp", state.perspective === 'third'); // crosshair is FPP-only
  document.addEventListener("keydown", event => {
    if (!state.locked || state.cinematic || !document.hasFocus()) return;
    keys.add(event.code);
    if (event.code === 'KeyI' && !event.repeat) {
      document.body.classList.toggle('right-panels-hidden');
      event.preventDefault();
    }
    if (event.code === 'KeyV' && !event.repeat) {
      state.perspective = state.perspective === 'third' ? 'first' : 'third';
      document.body.classList.toggle("tpp", state.perspective === 'third');
      event.preventDefault();
    }
    if (event.code === 'KeyR' && !event.repeat) onReset();
    if (event.code === 'BracketRight' && !event.repeat) onStress(1);
    if (event.code === 'BracketLeft' && !event.repeat) onStress(-1);
    if (event.code === "Space" && !event.repeat) player.jumpBuffer = 0.15; // player.js decides if it can jump
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  document.addEventListener("keyup", event => keys.delete(event.code));
  document.addEventListener("mousedown", event => {
    if (state.locked && !state.cinematic) pointerButtons.add(event.button);
  });
  document.addEventListener("mouseup", event => pointerButtons.delete(event.button));
  document.addEventListener("contextmenu", event => {
    if (state.locked) event.preventDefault();
  });
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

}
