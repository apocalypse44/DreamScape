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
  enterButton.addEventListener("click", () => renderer.domElement.requestPointerLock());
  document.addEventListener("pointerlockchange", () => {
    state.locked = document.pointerLockElement === renderer.domElement;
    clearInput();
    if (state.locked) document.activeElement?.blur();
    document.body.classList.toggle("playing", state.locked);
    introEl.classList.toggle("hidden", state.locked);
  });
  document.addEventListener("mousemove", event => {
    if (!state.locked) return;
    state.yaw -= event.movementX * 0.0022;
    state.pitch -= event.movementY * 0.002;
    state.pitch = THREE.MathUtils.clamp(state.pitch, -1.35, 1.35);
  });
  document.addEventListener("keydown", event => {
    if (!state.locked || !document.hasFocus()) return;
    keys.add(event.code);
    if (event.code === 'KeyV' && !event.repeat) {
      state.perspective = state.perspective === 'third' ? 'first' : 'third';
      event.preventDefault();
    }
    if (event.code === 'KeyR' && !event.repeat) onReset();
    if (event.code === 'BracketRight' && !event.repeat) onStress(1);
    if (event.code === 'BracketLeft' && !event.repeat) onStress(-1);
    if (event.code === "Space" && !event.repeat && player.grounded) {
      player.velocity.y = 10.5;
      player.grounded = false;
      state.chaos += 0.08;
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  });
  document.addEventListener("keyup", event => keys.delete(event.code));
  document.addEventListener("mousedown", event => {
    if (state.locked) pointerButtons.add(event.button);
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
