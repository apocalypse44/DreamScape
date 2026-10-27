import { createPace } from './scenePace.js';

// Chapter II's castle reveal: once Neris's quest is done, a short letterboxed shot of Spade castle's doors
// swinging open, introducing the next quest inside. Plays once, when the player is free to watch.
const DOOR = { x: -467, y: 21.5, z: 0 };
// The doors swing outward toward the camera, so the shot stays well back until they have opened.
const SHOT = {
  from: new THREE.Vector3(-430, 25, 12), to: new THREE.Vector3(-447, 20.5, 2.5),
  lookFrom: new THREE.Vector3(DOOR.x, DOOR.y, DOOR.z), lookTo: new THREE.Vector3(-482, 20, 0),
};
const OPEN_AT = 1.8;   // seconds in: the doors start to swing
const DURATION = 9.5;
const LINES = [
  { at: 0.6, speaker: 'NERIS', text: 'The anchor is broken. The castle doors are open now.' },
  { at: 4.2, speaker: 'NEXT · THE STOLEN TESTIMONIES', text: 'Go into the castle. Take the stairs on the left up to the archive, and read the three records while calm.' },
];
const ease = k => k * k * (3 - 2 * k);

export function createDoorScene({ camera, state, keys, onOpen }) {
  const overlay = document.createElement('section');
  overlay.id = 'doorScene';
  overlay.hidden = true;
  overlay.setAttribute('aria-label', 'The castle doors open');
  overlay.innerHTML = `<div class="scene-veil"></div><div class="scene-top"><span>THE SWARM REMEMBERS</span><span>SPACE · FASTER &nbsp; X · SKIP</span></div>
    <div class="scene-dialogue"><p class="scene-chapter">II · THE SPADE KINGDOM</p><p class="scene-speaker"></p><p class="scene-line" aria-live="polite" aria-atomic="true"></p></div>`;
  document.body.appendChild(overlay);
  const veil = overlay.querySelector('.scene-veil'), speaker = overlay.querySelector('.scene-speaker'), line = overlay.querySelector('.scene-line');
  const savedPosition = new THREE.Vector3(), savedRotation = new THREE.Quaternion(), look = new THREE.Vector3();
  let time = -1, queued = false, startAt = 0, opened = false, shown = -1;
  const pace = createPace();

  function finish() {
    camera.position.copy(savedPosition); camera.quaternion.copy(savedRotation);
    if (!opened) { opened = true; onOpen?.(); } // skipped early: the doors still open
    time = -1; state.cinematic = false; overlay.hidden = true; document.body.classList.remove('story-playing');
    keys.clear();
  }
  // input.js ignores keys during cinematics, so the scene listens for its own (capture first, so
  // Space cannot buffer a jump).
  window.addEventListener?.('keydown', event => {
    if (time < 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'KeyX' || event.code === 'Escape') finish();
    else if (event.code === 'Space') pace.rush();
  }, true);

  return {
    get active() { return time >= 0; },
    // delay (s): lets the message that triggered it be read first (the scene hides the HUD).
    queue(delay = 0) { queued = true; startAt = performance.now() + delay * 1000; },
    // ready: nothing else owns the camera and the player is free (no map, no other scene).
    observe(ready) {
      if (!queued || !ready || time >= 0 || performance.now() < startAt) return;
      queued = false; opened = false; shown = -1; time = 0; pace.show();
      savedPosition.copy(camera.position); savedRotation.copy(camera.quaternion);
      state.cinematic = true; keys.clear();
      overlay.hidden = false; document.body.classList.add('story-playing');
    },
    // Returns a camera distance for the character's visibility check (the player is off screen anyway).
    update(dt) {
      time += pace.step(dt, time, LINES[shown + 1]?.at ?? DURATION - 0.6); // waits on a line still being read
      const k = ease(Math.min(1, time / DURATION));
      camera.position.lerpVectors(SHOT.from, SHOT.to, k);
      camera.lookAt(look.lerpVectors(SHOT.lookFrom, SHOT.lookTo, ease(Math.max(0, (time - OPEN_AT) / (DURATION - OPEN_AT)))));
      veil.style.opacity = String(Math.max(0, 1 - time / 0.8, (time - (DURATION - 0.6)) / 0.6));
      if (!opened && time >= OPEN_AT) { opened = true; onOpen?.(); }
      const index = LINES.findLastIndex(l => time >= l.at);
      if (index !== shown && index >= 0) {
        shown = index; speaker.textContent = LINES[index].speaker; line.textContent = LINES[index].text; pace.show(LINES[index].text);
        line.classList.remove('in'); void line.offsetWidth; line.classList.add('in');
      }
      if (time >= DURATION) finish();
      return 10;
    },
    reset() { if (time >= 0) finish(); queued = false; },
  };
}
