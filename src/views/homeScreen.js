// The home screen in front of the loading screen: Start Game, Tutorial Lab, Settings, and a loading bar that follows
// the world loading behind it. Also the Tutorial Lab overlay and the practice prompt shown before a boss fight.
import { settings } from '../models/settings.js';

const PHASE_WIDTH = { loading: 25, preparing: 55, warmup: 85, ready: 100 };

export function applySettings() { document.body.classList.toggle('no-subtitles', !settings.get('subtitles')); }

/** The lab in a full-screen frame; resolves when the player leaves it (its Leave button or Esc posts a close message). */
export function openLab() {
  return new Promise(resolve => {
    const back = document.activeElement; // focus returns here when the lab closes (keyboard players)
    const overlay = document.createElement('div'); overlay.className = 'lab-overlay';
    const frame = document.createElement('iframe'); frame.src = 'tutorial-lab.html'; frame.title = 'Tutorial Lab';
    overlay.append(frame); document.body.append(overlay); frame.focus();
    const close = e => { if (e.origin !== location.origin || e.data?.type !== 'tutorial-lab:close') return; removeEventListener('message', close); overlay.remove(); back?.focus?.(); resolve(); };
    addEventListener('message', close);
  });
}

/** "Practice in the Tutorial Lab first?" Resolves true for Practice, false for Fight now. */
export function askPractice(bossName) {
  return new Promise(resolve => {
    const prompt = document.createElement('div'); prompt.className = 'practice-prompt'; prompt.setAttribute('role', 'dialog'); prompt.setAttribute('aria-label', 'Practice first?');
    prompt.innerHTML = `<div><p>${bossName} awaits. Practice in the Tutorial Lab first?</p><button type="button" data-answer="1">Practice</button><button type="button" data-answer="0">Fight now</button></div>`;
    prompt.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; prompt.remove(); resolve(b.dataset.answer === '1'); });
    document.body.append(prompt); prompt.querySelector('button').focus();
  });
}

/** Shows the home screen unless the URL jumps straight in (?scene, ?unlock, ?start): tests and the lab's links. */
export function mountHome({ params = new URLSearchParams(location.search) } = {}) {
  applySettings();
  const home = document.getElementById('home');
  if (!home) return;
  if (params.has('scene') || params.has('unlock') || params.has('start')) { home.hidden = true; return; }
  const intro = document.getElementById('intro'), enter = document.getElementById('enterWorld');
  const bar = document.getElementById('homeBar'), label = document.getElementById('homeLoad'), status = document.getElementById('startupStatus');
  const follow = () => { bar.style.width = `${PHASE_WIDTH[intro.dataset.loadPhase] ?? 10}%`; label.textContent = status.textContent; };
  new MutationObserver(follow).observe(intro, { attributes: true, attributeFilter: ['data-load-phase'] });
  new MutationObserver(follow).observe(status, { childList: true, characterData: true, subtree: true }); follow();
  // Start Game: enter at once if the world is ready, else the grimoire loading screen takes over until it is.
  document.getElementById('homeStart').onclick = () => { home.hidden = true; if (!enter.disabled) enter.click(); };
  document.getElementById('homeLab').onclick = () => openLab();
  const panel = document.getElementById('homeSettingsPanel'), toggle = document.getElementById('homeSettings');
  toggle.onclick = () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); };
  for (const input of panel.querySelectorAll('[data-setting]')) {
    const key = input.dataset.setting;
    if (input.type === 'checkbox') { input.checked = settings.get(key); input.onchange = () => { settings.set(key, input.checked); applySettings(); }; }
    else { input.value = String(Math.round(settings.get(key) * 100)); input.oninput = () => settings.set(key, Number(input.value) / 100); }
  }
  document.getElementById('homeStart').focus();
}
