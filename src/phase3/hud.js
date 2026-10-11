// HTML overlay: toast message, "E · PET" prompt, NPC speech bubbles.
// Everything is created from JS, so index.html does not need editing.
import { THREE } from './deps.js';

const CSS = `
#p3-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 20;
  font-family: system-ui, sans-serif; }
#p3-toast { position: absolute; top: 18%; left: 50%; transform: translate(-50%, -12px);
  opacity: 0; transition: opacity .3s, transform .3s; font-weight: 700; font-size: 26px;
  letter-spacing: .08em; color: #ffe0b0; text-shadow: 0 0 14px #ff6a20, 0 2px 4px #000; }
#p3-toast.show { opacity: 1; transform: translate(-50%, 0); }
#p3-prompt { position: absolute; display: none; transform: translate(-50%, -100%);
  padding: 4px 10px; border-radius: 8px; background: rgba(15,12,25,.8); color: #fff;
  font-size: 14px; font-weight: 600; white-space: nowrap; }
.p3-bubble { position: absolute; display: none; transform: translate(-50%, -100%);
  max-width: 240px; padding: 8px 12px; border-radius: 12px; background: rgba(20,16,30,.88);
  color: #fff; font-size: 14px; line-height: 1.35; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
.p3-bubble::after { content: ''; position: absolute; left: 50%; bottom: -7px;
  transform: translateX(-50%); border: 7px solid transparent; border-bottom: 0;
  border-top-color: rgba(20,16,30,.88); }
`;

let overlay = null;
let toastEl = null;
let promptEl = null;

export function initHud() {
  if (typeof document === 'undefined' || overlay) return;
  const style = document.createElement('style');
  style.id = 'p3-style';
  style.textContent = CSS;
  document.head.appendChild(style);
  overlay = document.createElement('div');
  overlay.id = 'p3-overlay';
  toastEl = document.createElement('div');
  toastEl.id = 'p3-toast';
  toastEl.setAttribute('aria-live', 'polite');
  promptEl = document.createElement('div');
  promptEl.id = 'p3-prompt';
  overlay.append(toastEl, promptEl);
  document.body.appendChild(overlay);
}

export function toast(text, ms = 2000) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// World position -> pixel position on screen. Returns false if behind camera.
const v = new THREE.Vector3();
export function worldToScreen(pos, camera, renderer, out) {
  v.copy(pos).project(camera);
  if (v.z > 1 || v.z < -1) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  out.x = rect.left + ((v.x + 1) / 2) * rect.width;
  out.y = rect.top + ((1 - v.y) / 2) * rect.height;
  return true;
}

const scr = { x: 0, y: 0 };
export function showPrompt(text, worldPos, camera, renderer) {
  if (!promptEl) return;
  if (!worldToScreen(worldPos, camera, renderer, scr)) { hidePrompt(); return; }
  if (promptEl.textContent !== text) promptEl.textContent = text;
  promptEl.style.left = `${scr.x}px`;
  promptEl.style.top = `${scr.y}px`;
  promptEl.style.display = 'block';
}
export function hidePrompt() {
  if (promptEl) promptEl.style.display = 'none';
}

// One speech bubble per NPC.
export class Bubble {
  constructor() {
    this.el = null;
    this.text = '';
    if (!overlay) return;
    this.el = document.createElement('div');
    this.el.className = 'p3-bubble';
    this.el.setAttribute('aria-live', 'polite');
    overlay.appendChild(this.el);
  }
  // Only touch the text when it changes, so screen readers don't repeat it.
  setText(text) {
    if (!this.el || text === this.text) return;
    this.text = text;
    this.el.textContent = text;
  }
  showAt(worldPos, camera, renderer) {
    if (!this.el) return;
    if (!worldToScreen(worldPos, camera, renderer, scr)) { this.hide(); return; }
    this.el.style.left = `${scr.x}px`;
    this.el.style.top = `${scr.y}px`;
    this.el.style.display = 'block';
  }
  hide() {
    if (this.el) this.el.style.display = 'none';
  }
  dispose() {
    this.el?.remove();
    this.el = null;
  }
}
