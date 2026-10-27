// Screen overlay pinned to world positions: toast message, "E · PET" prompt, NPC speech bubbles.
// The elements live in game.html (#overlay); styles in styles/main.css.

// Story text (anything with a sentence in it, e.g. 'NERIS · They scatter…') goes to the dialogue box;
// short all-caps notices ('SATCHEL · TIDE HOOK ADDED') stay toasts.
export function toast(text, ms = 2000) {
  if (/[a-z]/.test(text)) {
    const at = text.search(/ · [^·]*[a-z]/); // speaker: the all-caps part before the first sentence
    return say(at > 0 ? text.slice(0, at) : '', at > 0 ? text.slice(at + 3) : text);
  }
  const el = document.querySelector('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// One dialogue box for every speaker. It stays until the player presses Space (or clicks it);
// a new line replaces the old one.
let box = null;
function close() { if (box) box.hidden = true; }
export function say(speaker, text) {
  if (!box) {
    box = document.createElement('aside');
    box.className = 'dialogue-box'; box.hidden = true;
    box.innerHTML = '<strong></strong><p aria-live="polite"></p><small>SPACE · CONTINUE</small>';
    box.addEventListener('click', close);
    document.body.append(box);
    // Capture first, so the Space that closes the box doesn't also jump.
    window.addEventListener('keydown', event => {
      if (box.hidden || event.code !== 'Space' || document.body.classList.contains('story-playing')) return;
      event.preventDefault(); event.stopImmediatePropagation(); close();
    }, true);
  }
  box.querySelector('strong').textContent = speaker;
  box.querySelector('strong').hidden = !speaker;
  box.querySelector('p').textContent = text;
  box.hidden = false;
}
export const closeDialogue = close;

// World position -> pixel position on screen. Returns false if behind camera.
const v = new THREE.Vector3();
function worldToScreen(pos, camera, renderer, out) {
  v.copy(pos).project(camera);
  if (v.z > 1 || v.z < -1) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  out.x = rect.left + ((v.x + 1) / 2) * rect.width;
  out.y = rect.top + ((1 - v.y) / 2) * rect.height;
  return true;
}

const scr = { x: 0, y: 0 };
function place(el, worldPos, camera, renderer) {
  if (!worldToScreen(worldPos, camera, renderer, scr)) { el.style.display = 'none'; return; }
  el.style.left = `${scr.x}px`;
  el.style.top = `${scr.y}px`;
  el.style.display = 'block';
}

export function showPrompt(text, worldPos, camera, renderer) {
  const el = document.querySelector('#worldPrompt');
  if (el.textContent !== text) el.textContent = text;
  place(el, worldPos, camera, renderer);
}
export function hidePrompt() {
  document.querySelector('#worldPrompt').style.display = 'none';
}

// One speech bubble per NPC.
export class Bubble {
  constructor() {
    this.text = '';
    this.el = document.createElement('div');
    this.el.className = 'bubble';
    this.el.setAttribute('aria-live', 'polite');
    document.querySelector('#overlay').appendChild(this.el);
  }
  // Only touch the text when it changes, so screen readers don't repeat it.
  setText(text) {
    if (text === this.text) return;
    this.text = text;
    this.el.textContent = text;
  }
  showAt(worldPos, camera, renderer) { place(this.el, worldPos, camera, renderer); }
  hide() { this.el.style.display = 'none'; }
  dispose() { this.el.remove(); }
}
