// The "i" help panel (top right): what to do next for the current quest step, with its keys, plus the
// basic controls. Reads the same live state as the grimoire journal. Click the icon or press H; when
// the step changes it opens by itself for a few seconds, as a tip.
import { grimoireQuests } from '../models/grimoireJournal.js';

const PEEK = 9; // seconds a new step's tip stays open
const KEY = /\b(Shift|Space|[EQFMGV])\b/g; // single capitals the hints use for keys
const escape = text => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const withKeys = text => escape(text).replace(KEY, '<kbd>$1</kbd>');
const CONTROLS = [
  ['W A S D', 'Move'], ['Shift', 'Run (stirs chaos)'], ['Space', 'Jump'],
  ['E', 'Call the wisps · talk · use'], ['Q', 'Push the wisps away (stirs chaos)'], ['F', 'Call the wisps back'],
  ['M', 'Map and journal'], ['G', 'Show or hide the route'], ['V', 'Switch camera'], ['I', 'Hide side panels'],
];

export function createHelpPanel({ quest, spade, clover, state }) {
  const button = document.createElement('button');
  button.id = 'helpButton'; button.type = 'button';
  button.setAttribute('aria-label', 'What to do next (H)'); button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<span aria-hidden="true">i</span><kbd>H</kbd>';
  const panel = document.createElement('aside');
  panel.id = 'helpPanel'; panel.hidden = true; panel.setAttribute('aria-label', 'What to do next');
  panel.innerHTML = `<small class="help-chapter"></small><h3></h3><p class="help-progress"></p><p class="help-hint" aria-live="polite"></p>
    <details><summary>CONTROLS</summary><dl>${CONTROLS.map(([k, v]) => `<dt><kbd>${k}</kbd></dt><dd>${v}</dd>`).join('')}</dl></details>
    <small class="help-foot">CALM: walk gently · CHAOS: run or push the wisps · H closes</small>`;
  document.body.append(button, panel);

  let pinned = false, peek = 0, last = null, poll = 0;
  const show = () => {
    panel.hidden = !(pinned || peek > 0);
    button.setAttribute('aria-expanded', String(!panel.hidden));
  };
  const toggle = () => { pinned = !(pinned || peek > 0); peek = 0; show(); };
  button.addEventListener('click', toggle);
  addEventListener('keydown', event => {
    if (event.code !== 'KeyH' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || state.cinematic) return;
    event.preventDefault(); toggle();
  });

  function current() {
    const tasks = grimoireQuests(quest, spade, clover);
    return tasks.find(t => !t.done && !t.locked) ?? tasks.at(-1);
  }
  function render(task) {
    panel.querySelector('.help-chapter').textContent = task.chapter;
    panel.querySelector('h3').textContent = task.title;
    panel.querySelector('.help-progress').textContent = task.done ? 'Done' : task.progress;
    panel.querySelector('.help-hint').innerHTML = withKeys(task.hint);
  }

  return {
    update(dt) {
      if (peek > 0 && (peek -= dt) <= 0) show();
      if ((poll -= dt) > 0) return;
      poll = 0.5;
      const task = current(), step = `${task.id}:${task.hint}`;
      if (step === last) return;
      const first = last === null;
      last = step; render(task);
      if (!first && !pinned) { peek = PEEK; show(); } // a new step: show it once as a tip
    },
  };
}
