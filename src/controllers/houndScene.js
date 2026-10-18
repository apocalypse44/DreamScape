import { createHoundScene, PHASE_SECONDS, TRANSFORM_SECONDS, blendShot, smoother } from '../models/houndScene.js';

// Shots orbit a subject. yaw is the angle (radians) from the subject's line toward the other character:
// 0 sits between them, ~1 is a three-quarter view. The subject of each conversation takes +yaw and the
// player −yaw, so every shot stays on the same side of the line between them (no left/right flips).
// pitch looks down from above. Each shot drifts from a to b over its line, so the frame always moves with
// intent; the transformation is one long descending orbit, from high and wide to low and close.
const SHOTS = {
  transform: { subject: 'hound', lift: .9, a: { yaw: 1.35, pitch: .46, dist: 8.2, fov: 50 }, b: { yaw: .5, pitch: .12, dist: 4.3, fov: 40 } },
  hound: { subject: 'hound', lift: .9, a: { yaw: 1.05, pitch: .32, dist: 5.4, fov: 44 }, b: { yaw: 1.22, pitch: .27, dist: 4.6, fov: 42 } },
  player: { subject: 'player', lift: -.45, a: { yaw: -.8, pitch: .24, dist: 3.9, fov: 44 }, b: { yaw: -.62, pitch: .2, dist: 3.3, fov: 42 } },
  keeper: { subject: 'keeper', lift: 1.35, a: { yaw: .62, pitch: .2, dist: 4.8, fov: 44 }, b: { yaw: .74, pitch: .17, dist: 4, fov: 42 } },
};
const CUT_SECONDS = 1.8; // a change of shot is a slow arc, not a slide
const CURSE_ROLL = .06;  // a slight Dutch angle (~3.5°) for the curse; the cure stays level

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
  let shotKey = null, shotClock = 0, cutClock = 0, cutFrom = null, pose = null, clearance = Infinity;

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
  // Where a shot puts the camera at progress k (0 → 1 through its drift).
  function shotPose(name, k) {
    const shot = SHOTS[name] && (name !== 'keeper' || getKeeper?.()) ? SHOTS[name] : SHOTS.hound;
    const keeper = getKeeper?.()?.root.position;
    const at = shot.subject === 'keeper' ? keeper : shot.subject === 'player' ? player.position : companion.position;
    const other = shot.subject === 'player' ? (story.kind === 'cure' && keeper ? keeper : companion.position) : player.position;
    direction.set(other.x - at.x, 0, other.z - at.z);
    if (direction.lengthSq() < .01) direction.set(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    const drift = key => shot.a[key] + (shot.b[key] - shot.a[key]) * k;
    return { x: at.x, y: at.y + shot.lift, z: at.z, az: Math.atan2(direction.x, direction.z) + drift('yaw'),
      pitch: drift('pitch'), dist: drift('dist'), fov: drift('fov'), roll: story.kind === 'curse' ? CURSE_ROLL : 0 };
  }
  function updateCamera(dt) {
    if (story.phase === 'return') { restoreCamera(); return; }
    // One shot for the fade-in and transformation, then one per line. A new shot starts an arc from wherever
    // the camera is now; reduced motion cuts straight to it and holds still.
    const dialogue = story.phase === 'dialogue' || (story.phase === 'exit' && shotKey !== 'transform');
    const key = dialogue ? `line${story.index}` : shotKey ?? 'transform';
    const name = key === 'transform' ? 'transform' : story.line.shot;
    const length = key === 'transform' ? PHASE_SECONDS.enter + TRANSFORM_SECONDS : story.line.seconds;
    if (key !== shotKey) { cutFrom = pose; cutClock = 0; shotClock = 0; shotKey = key; }
    shotClock += dt; cutClock += dt;
    const still = reducedMotion.matches;
    pose = shotPose(name, still ? 0 : smoother(shotClock / length));
    if (cutFrom && !still && cutClock < CUT_SECONDS) pose = blendShot(cutFrom, pose, smoother(cutClock / CUT_SECONDS));
    target.set(pose.x, pose.y, pose.z);
    // Fit the growing hound in narrow viewports without changing its world scale.
    const dist = pose.dist * Math.max(1, .9 / camera.aspect), flat = Math.cos(pose.pitch) * dist;
    desired.set(target.x + Math.sin(pose.az) * flat, target.y + Math.sin(pose.pitch) * dist, target.z + Math.cos(pose.az) * flat);
    desired.y = Math.max(desired.y, terrainHeight(desired.x, desired.z) + .65);
    // Reuse the gameplay camera's obstruction rule for walls, props and slopes.
    direction.subVectors(desired, target);
    const distance = direction.length(); direction.normalize();
    const objects = obstacles(); objects.forEach(object => object.updateMatrixWorld(true));
    ray.set(target, direction); ray.near = .15; ray.far = distance;
    const hit = ray.intersectObjects(objects, true)[0];
    // Pull in at once when something blocks the view (never clip through it), ease back out once it clears.
    const reach = hit ? Math.max(.25, hit.distance - .35) : distance;
    clearance = reach < clearance ? reach : clearance + (reach - clearance) * (1 - Math.exp(-2.5 * dt));
    desired.copy(target).addScaledVector(direction, Math.min(clearance, distance));
    camera.position.copy(desired); look.copy(target); camera.lookAt(look);
    camera.rotateZ(pose.roll);
    camera.fov = Math.min(savedFov, pose.fov); camera.updateProjectionMatrix();
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
      shotKey = null; pose = cutFrom = null; clearance = Infinity; // open on the transformation shot, under the fade from black
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
        line.classList.remove('in'); void line.offsetWidth; line.classList.add('in'); // each line fades up
        state.cinematicSpeaker = story.line.speaker ?? 'YOU';
        overlay.querySelector('.scene-speaker').textContent = state.cinematicSpeaker;
        lastLine = story.index;
      }
      overlay.dataset.phase = story.phase;
      overlay.dataset.fire = String(story.transformation.fire);
      overlay.dataset.wolf = String(story.transformation.wolf);
      const fade = smoother(story.time / PHASE_SECONDS[story.phase]);
      veil.style.opacity = String(story.phase === 'enter' ? 1 - fade : story.phase === 'exit' ? fade : story.phase === 'return' ? 1 - fade : 0);
      return camera.position.distanceTo(player.position);
    },
    reset() { if (story.active) finish(false); story.reset(); },
  };
}
