// The grimoire page reveal in the game: each sigil earned returns a page (models/grimoireSpells.js PAGES), and the
// book opens in front of the traveller once the scene that granted it has finished. Plays each page once per run.
// The reveal itself (book, camera, captions) is views/grimoireReveal.js, shared with the movement lab.
import { createGrimoireReveal } from '../views/grimoireReveal.js';

export const PAGE_FOR_SIGIL = { 'lantern-sigil': 1, 'root-sigil': 2, 'tide-sigil': 3, 'prism-sigil': 4 }; // page 0 comes from the cure

export function createGrimoirePages({ scene, camera, state, keys, player, canvas }) {
  const reveal = createGrimoireReveal({ scene });
  const queue = [], played = new Set(), savedPosition = new THREE.Vector3(), savedRotation = new THREE.Quaternion();
  let playing = false;

  function finish() {
    reveal.stop(); playing = false;
    camera.position.copy(savedPosition); camera.quaternion.copy(savedRotation);
    state.cinematic = false; document.body.classList.remove('story-playing'); keys.clear();
    if (canvas && document.pointerLockElement !== canvas) try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* resumes on the next click */ }
  }
  // input.js ignores keys during cinematics, so listen here (capture first, as the story scenes do):
  // Enter jumps to the written page, X closes the book, Escape leaves at once.
  window.addEventListener('keydown', event => {
    if (!playing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return; // typing in a form
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'Enter') reveal.skip();
    else if (event.code === 'KeyX') reveal.close();
    else if (event.code === 'Escape') finish();
  }, true);

  return {
    get active() { return playing; },
    get pending() { return queue.length > 0; }, // pages still to play (a boss fight waits for them)
    /** i: PAGES index. Ignored if that page already played this run. */
    queue(i) { if (!played.has(i) && !queue.includes(i)) queue.push(i); },
    /** ready: nothing else owns the camera and the player is free. */
    observe(ready) {
      if (!queue.length || !ready || playing) return;
      const i = queue.shift(); played.add(i); playing = true;
      savedPosition.copy(camera.position); savedRotation.copy(camera.quaternion);
      state.cinematic = true; keys.clear(); document.body.classList.add('story-playing');
      reveal.play(i, player.position, state.yaw); // player.position is eye height, as in the movement lab
    },
    update(dt) {
      reveal.update(dt);
      if (!playing) return;
      if (!reveal.active) { finish(); return; }
      reveal.shot(camera, dt);
    },
    reset() { if (playing) finish(); queue.length = 0; played.clear(); },
  };
}
