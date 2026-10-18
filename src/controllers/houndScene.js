import { createHoundScene } from '../models/houndScene.js';

export function createHoundCutscene({ camera, state, player, companion, keys, pointerButtons, terrainHeight, obstacles, onReset, canvas, getKeeper, onCureComplete }) {
  const story = createHoundScene();
  const overlay = document.createElement('section');
  overlay.id = 'houndScene';
  overlay.hidden = true;
  overlay.setAttribute('aria-label', 'The Ember Hound story scene');
  overlay.innerHTML = `<div class="scene-veil"></div><div class="scene-top"><span>THE EMBER HOUND</span><button type="button" data-scene-skip>SKIP · X</button></div>
    <div class="scene-dialogue"><p class="scene-chapter">I · THE FIRST FLAME</p><p class="scene-speaker">YOU</p><p class="scene-line" aria-live="polite" aria-atomic="true"></p><button type="button" data-scene-next>CONTINUE · SPACE <span aria-hidden="true">→</span></button></div>`;
  document.body.appendChild(overlay);
  const line = overlay.querySelector('.scene-line'), veil = overlay.querySelector('.scene-veil');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const savedPosition = new THREE.Vector3(), savedRotation = new THREE.Quaternion();
  const target = new THREE.Vector3(), desired = new THREE.Vector3(), direction = new THREE.Vector3();
  const look = new THREE.Vector3(), ray = new THREE.Raycaster();
  let savedFov = null, lastLine = -1;

  function keepPointerLock() {
    if (document.pointerLockElement === canvas) return;
    const paused = () => {
      if (!state.cinematic && document.pointerLockElement !== canvas) {
        document.querySelector('#resumeHint')?.classList.add('on');
      }
    };
    try { canvas.requestPointerLock()?.catch(paused); } catch { paused(); }
  }

  function clearInput() {
    keys.clear(); pointerButtons.clear(); player.velocity.set(0, 0, 0); player.jumpBuffer = 0;
    state.crouching = false;
  }
  function restoreCamera() {
    if (savedFov === null) return;
    camera.position.copy(savedPosition); camera.quaternion.copy(savedRotation);
    camera.fov = savedFov; camera.updateProjectionMatrix();
  }
  function finish(completed = true) {
    restoreCamera(); savedFov = null; state.cinematic = false;
    overlay.hidden = true; document.body.classList.remove('story-playing'); clearInput();
    state.locked = document.pointerLockElement === canvas;
    state.awaitResume = !state.locked;
    document.querySelector('#resumeHint')?.classList.remove('on');
    if (!state.locked) {
      keepPointerLock();
    }
    if (overlay.contains(document.activeElement)) document.activeElement.blur();
    state.cinematicSpeaker = ''; state.cinematicMood = null;
    if (completed && story.kind === 'cure') onCureComplete?.();
  }
  function updateCamera(dt) {
    if (story.phase === 'return') { restoreCamera(); return; }
    const hound = companion.position;
    direction.set(player.position.x - hound.x, 0, player.position.z - hound.z);
    if (story.kind === 'cure' && story.line.shot === 'player' && getKeeper?.()) {
      direction.subVectors(player.position, getKeeper().root.position); direction.y = 0;
    }
    if (direction.lengthSq() < .01) direction.set(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    direction.normalize();
    if (story.line.shot === 'keeper' && getKeeper?.()) {
      const keeper = getKeeper().root.position;
      target.copy(keeper); target.y += 1.35;
      direction.set(player.position.x - keeper.x, 0, player.position.z - keeper.z);
      if (direction.lengthSq() < .01) direction.set(1, 0, 0);
      direction.normalize();
      desired.copy(target).addScaledVector(direction, 4);
      desired.x += direction.z * 2; desired.z -= direction.x * 2;
      desired.y += .3;
    } else if (story.line.shot === 'player') {
      target.copy(player.position); target.y -= .45;
      desired.copy(target).addScaledVector(direction, -3.2);
      desired.x += direction.z * 2.5; desired.z -= direction.x * 2.5;
      desired.y += .35;
    } else {
      target.copy(hound); target.y += .85;
      desired.copy(target).addScaledVector(direction, .8);
      desired.x += direction.z * 4.8; desired.z -= direction.x * 4.8;
      desired.y += 1.2;
    }
    // Fit the growing hound in narrow viewports without changing its world scale.
    desired.sub(target).multiplyScalar(Math.max(1, .9 / camera.aspect)).add(target);
    desired.y = Math.max(desired.y, terrainHeight(desired.x, desired.z) + .65);
    // Reuse the gameplay camera's obstruction rule for walls, props and slopes.
    direction.subVectors(desired, target);
    const distance = direction.length(); direction.normalize();
    const objects = obstacles(); objects.forEach(object => object.updateMatrixWorld(true));
    ray.set(target, direction); ray.near = .15; ray.far = distance;
    const hit = ray.intersectObjects(objects, true)[0];
    if (hit) desired.copy(target).addScaledVector(direction, Math.max(.25, hit.distance - .35));
    const ease = reducedMotion.matches || story.phase === 'enter' ? 1 : 1 - Math.exp(-4 * dt);
    camera.position.lerp(desired, ease); look.lerp(target, ease); camera.lookAt(look);
    camera.fov = Math.min(savedFov, 54); camera.updateProjectionMatrix();
  }
  overlay.querySelector('[data-scene-next]').addEventListener('click', () => { keepPointerLock(); story.next(); });
  overlay.querySelector('[data-scene-skip]').addEventListener('click', () => { keepPointerLock(); story.skip(); });
  // Capture before gameplay shortcuts so Space cannot buffer a jump or M open the atlas.
  window.addEventListener('keydown', event => {
    if (!story.active || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Tab' && !state.locked) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') { keepPointerLock(); story.next(); }
    else if (event.code === 'KeyX') { keepPointerLock(); story.skip(); }
    else if (event.code === 'Escape') story.skip();
    else if (event.code === 'KeyR') onReset();
  }, true);

  return {
    get active() { return story.active; },
    get presentation() {
      return story.active || story.pending ? { ...story.transformation, hold: story.active } : null;
    },
    observe(stage, ready) {
      story.observe(stage, false);
      if (story.kind === 'cure' && !getKeeper?.()) return;
      if (!story.pending || !ready || !companion.prepareScene()) return;
      if (!story.observe(stage, true)) return;
      savedPosition.copy(camera.position); savedRotation.copy(camera.quaternion); savedFov = camera.fov;
      look.copy(companion.position); look.y += .85;
      lastLine = -1; state.cinematic = true; clearInput();
      state.cinematicMood = story.kind === 'cure' ? 'calm' : 'danger';
      overlay.dataset.scene = story.kind;
      overlay.querySelector('.scene-chapter').textContent = story.kind === 'cure' ? 'I · A BOND RESTORED' : 'I · THE FIRST FLAME';
      state.awaitResume = false;
      document.querySelector('#resumeHint')?.classList.remove('on');
      const facing = story.kind === 'cure' ? getKeeper().root.position : companion.position;
      state.cinematicYaw = Math.atan2(facing.x - player.position.x, facing.z - player.position.z);
      document.body.classList.add('story-playing'); overlay.hidden = false;
      veil.style.opacity = '1';
    },
    update(dt) {
      if (!story.active) return 0;
      const step = document.hidden || !document.hasFocus() ? 0 : dt;
      story.update(step);
      if (!story.active) { finish(); return camera.position.distanceTo(player.position); }
      updateCamera(step);
      if (lastLine !== story.index) {
        line.textContent = story.line.text;
        state.cinematicSpeaker = story.line.speaker ?? 'YOU';
        overlay.querySelector('.scene-speaker').textContent = state.cinematicSpeaker;
        lastLine = story.index;
      }
      overlay.dataset.phase = story.phase;
      overlay.dataset.fire = String(story.transformation.fire);
      overlay.dataset.wolf = String(story.transformation.wolf);
      veil.style.opacity = String(story.phase === 'enter' ? 1 - story.time / .45
        : story.phase === 'exit' ? story.time / .25 : story.phase === 'return' ? 1 - story.time / .3 : 0);
      return camera.position.distanceTo(player.position);
    },
    reset() { if (story.active) finish(false); story.reset(); },
  };
}
