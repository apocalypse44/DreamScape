import { landmarkHintLines } from '../models/landmarkHints.js';
import { say } from './overlay.js';

export async function mountView() {
  const response = await fetch(new URL('./game.html', import.meta.url));
  if (!response.ok) throw new Error(`Could not load game view (${response.status})`);
  // Keep the title screen visible while the engine and world are prepared.
  document.querySelector('#app').insertAdjacentHTML('beforeend', await response.text());
  const worldEl = document.querySelector("#world");
  const introEl = document.querySelector("#intro");
  const enterButton = document.querySelector("#enterWorld");
  const kingdomEl = document.querySelector("#kingdomName");
  const placeEl = document.querySelector("#placeLine");
  const experienceStateEl = document.querySelector("#experienceState");
  const swarmPanelEl = document.querySelector("#swarmPanel");
  const swarmStatusEl = document.querySelector("#swarmStatus");
  const fpsEl = document.querySelector("#fps");
  const questGoalEl = document.querySelector("#questGoal");
  const localLandmarksEl = document.createElement('div');
  document.querySelector('.compass').appendChild(localLandmarksEl);
  const landmarkRows = [];

  return { localLandmarksEl, landmarkRows, kingdomEl, worldEl, introEl, enterButton, placeEl, experienceStateEl, swarmPanelEl, swarmStatusEl, fpsEl, questGoalEl };
}

// Text is only written when it changes, so the aria-live panel isn't re-announced every frame.
// The tracker's words come from the journal (helpPanel.js); here only its warning tint when the pup grows restless.
export function updateQuestHUD(ui, quest) {
  ui.questGoalEl.classList.toggle("warn", quest.restless);
  // The shrine keeper speaks in the shared dialogue box: on approach, and again whenever the line changes.
  const keeper = quest.nearShrine ? quest.shrineText : '';
  if (keeper !== ui.keeperLine) { ui.keeperLine = keeper; if (keeper) say('SHRINE KEEPER', keeper); }
}

export function updateHUD(ui, state, player, biomeAt) {
  const { worldEl, introEl, enterButton, placeEl, experienceStateEl, swarmPanelEl, swarmStatusEl } = ui;
  const { chaos, yaw, hintTimer } = state;
  const atCrossing = Math.hypot(player.position.x, player.position.z) < 25;
  const experienceState = atCrossing ? "NEUTRAL" : chaos < 0.4 ? "SERENE" : chaos < 0.65 ? "TRANSFORMING" : "CHAOTIC";
  experienceStateEl.textContent = `${experienceState} DREAMSCAPE`;
  const currentWorld = biomeAt(player.position.x, player.position.z);
  if (ui.kingdomEl.textContent !== currentWorld.name) {
    ui.kingdomEl.textContent = currentWorld.name;
    ui.kingdomEl.style.color = currentWorld.banner;
    // Restart the entry flash each time the player crosses into another kingdom.
    ui.kingdomEl.classList.remove("enter");
    void ui.kingdomEl.offsetWidth;
    ui.kingdomEl.classList.add("enter");
  }
  // Area hints (falls, ridge, Clover, Spade landmarks...) are collected in the hidden .compass box; the one the
  // traveller stands in (no distance) or else the nearest goes under the kingdom name, like an RPG's area line.
  for (const hint of document.querySelectorAll('.compass [data-kingdom]')) {
    hint.hidden = hint.dataset.kingdom !== currentWorld.name;
  }
  const lines = landmarkHintLines(currentWorld.name, player.position);
  while (ui.landmarkRows.length < lines.length) {
    const row = document.createElement('small');
    ui.localLandmarksEl.appendChild(row);
    ui.landmarkRows.push(row);
  }
  ui.landmarkRows.forEach((row, i) => {
    row.hidden = i >= lines.length;
    if (i < lines.length && row.textContent !== lines[i]) row.textContent = lines[i];
  });
  let place = '', nearest = Infinity;
  for (const hint of document.querySelectorAll('.compass small')) {
    if (hint.hidden || !hint.textContent) continue;
    const metres = hint.textContent.match(/(\d+) m\b/);
    const d = metres ? +metres[1] : 0;
    if (d < nearest) { nearest = d; place = hint.textContent; }
  }
  const bearing = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
  const directions = ["N · NORTH","NE · NORTH-EAST","E · EAST","SE · SOUTH-EAST","S · SOUTH","SW · SOUTH-WEST","W · WEST","NW · NORTH-WEST"];
  place ||= `FACING ${directions[Math.round(bearing / 45) % 8]}`;
  if (placeEl.textContent !== place) placeEl.textContent = place;
  document.documentElement.style.setProperty("--acid", chaos > 0.62 ? "#ff705d" : "#c6ff65");
  if (hintTimer > 5) document.querySelector("#movementHint").classList.add("fade");
}

// The grimoire seal (bottom right): outer ring the chaos score with ticks at the 0.4 / 0.65 switches, inner ring
// three mana crystals (one per surge), a white arc for the surge's 5 s hold. Written only when something changes.
const SEAL_START = -135, SEAL_SWEEP = 270;
const sealPolar = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return `${(44 + r * Math.cos(a)).toFixed(2)} ${(44 + r * Math.sin(a)).toFixed(2)}`; };
const sealArc = (r, from, to) => to - from < .05 ? '' : `M${sealPolar(r, from)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${sealPolar(r, to)}`;
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const chaosColor = v => `rgb(${v < .5 ? mix([198, 255, 101], [255, 196, 92], v / .5) : mix([255, 196, 92], [255, 112, 93], (v - .5) / .5)})`;
let sealShown = '';
/** mana 0..1; hold: seconds left of a surge's hold (of holdMax); ready: G would surge now. */
export function updateSeal({ chaos, mode, mana, hold, holdMax, ready }) {
  const word = mode === 'chaos' ? 'CHAOS' : chaos > .4 ? 'STIRRING' : 'CALM';
  const sub = hold > 0 ? `SURGE ${hold.toFixed(1)}s` : mode === 'chaos' ? 'IN CHAOS' : ready ? 'SURGE READY' : `MANA ${Math.round(mana * 100)}%`;
  const key = `${chaos.toFixed(2)}|${word}|${mana.toFixed(3)}|${sub}|${ready}`;
  if (key === sealShown) return;
  sealShown = key;
  const seal = document.querySelector('#chaosReadout');
  const fill = seal.querySelector('.seal-chaos');
  fill.setAttribute('d', sealArc(38, SEAL_START, SEAL_START + SEAL_SWEEP * chaos));
  fill.style.stroke = chaosColor(chaos);
  const paths = seal.querySelectorAll('.seal-mana path');
  for (let i = 0; i < 3; i++) {
    const from = -112 + i * 120, part = Math.max(0, Math.min(1, mana * 3 - i));
    paths[i * 2].setAttribute('d', sealArc(26, from, from + 104));
    paths[i * 2 + 1].setAttribute('d', sealArc(26, from, from + 104 * part));
    paths[i * 2 + 1].classList.toggle('full', part >= 1);
  }
  seal.querySelector('.seal-hold').setAttribute('d', hold > 0 ? sealArc(44, SEAL_START, SEAL_START + SEAL_SWEEP * hold / holdMax) : '');
  const modeEl = seal.querySelector('.seal-mode');
  modeEl.textContent = `${word} ${chaos.toFixed(2)}`;
  modeEl.dataset.mode = word.toLowerCase();
  seal.querySelector('.seal-sub > span').textContent = sub;
  seal.classList.toggle('ready', ready);
  seal.classList.toggle('surging', hold > 0);
  seal.setAttribute('aria-label', `${word}, chaos ${chaos.toFixed(2)}, mana ${Math.round(mana * 100)} percent, ${sub.toLowerCase()}`);
}
