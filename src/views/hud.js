import { landmarkHintLines } from '../models/landmarkHints.js';

export async function mountView() {
  const response = await fetch(new URL('./game.html', import.meta.url));
  if (!response.ok) throw new Error(`Could not load game view (${response.status})`);
  // Keep the title screen visible while the engine and world are prepared.
  document.querySelector('#app').insertAdjacentHTML('beforeend', await response.text());
  const worldEl = document.querySelector("#world");
  const introEl = document.querySelector("#intro");
  const enterButton = document.querySelector("#enterWorld");
  const meterEl = document.querySelector("#meterFill");
  const notchEl = document.querySelector("#meterNotch");
  const signalEl = document.querySelector("#signalLabel");
  const velocityEl = document.querySelector("#velocity");
  const chunksEl = document.querySelector("#chunks");
  const seedEl = document.querySelector("#seed");
  const realmEl = document.querySelector("#realm");
  const kingdomEl = document.querySelector("#kingdomName");
  const facingEl = document.querySelector("#facingDirection");
  const experienceStateEl = document.querySelector("#experienceState");
  const compassDirectionEl = document.querySelector("#compassDirection");
  const compassWorldEl = document.querySelector("#compassWorld");
  const compassCoordinatesEl = document.querySelector("#compassCoordinates");
  const swarmPanelEl = document.querySelector("#swarmPanel");
  const swarmStatusEl = document.querySelector("#swarmStatus");
  const fpsEl = document.querySelector("#fps");
  const loadEl = document.querySelector("#load");
  const questGoalEl = document.querySelector("#questGoal");
  const shrinePanelEl = document.querySelector("#shrinePanel");
  const shrineTextEl = document.querySelector("#shrineText");
  const localLandmarksEl = document.createElement('div');
  document.querySelector('.compass').appendChild(localLandmarksEl);
  const landmarkRows = [];

  return { localLandmarksEl, landmarkRows, kingdomEl, worldEl, introEl, enterButton, meterEl, notchEl, signalEl, velocityEl, chunksEl, seedEl, realmEl, facingEl, experienceStateEl, compassDirectionEl, compassWorldEl, compassCoordinatesEl, swarmPanelEl, swarmStatusEl, fpsEl, loadEl, questGoalEl, shrinePanelEl, shrineTextEl };
}

// Text is only written when it changes, so the aria-live panel isn't re-announced every frame.
// goal: after the cure, the Spade chapter's objective replaces the hound quest's.
export function updateQuestHUD(ui, quest, goal = quest.goal) {
  if (ui.questGoalEl.textContent !== goal) ui.questGoalEl.textContent = goal;
  ui.questGoalEl.classList.toggle("warn", quest.restless);
  ui.shrinePanelEl.classList.toggle("active", quest.nearShrine);
  ui.shrinePanelEl.classList.toggle("drowned", quest.drowned);
  if (ui.shrineTextEl.textContent !== quest.shrineText) ui.shrineTextEl.textContent = quest.shrineText;
}

export function updateHUD(ui, state, player, biomeAt) {
  const { worldEl, introEl, enterButton, meterEl, notchEl, signalEl, velocityEl, chunksEl, seedEl, realmEl, facingEl, experienceStateEl, compassDirectionEl, compassWorldEl, compassCoordinatesEl, swarmPanelEl, swarmStatusEl } = ui;
  const { chaos, yaw, hintTimer } = state;
  velocityEl.textContent = Math.hypot(player.velocity.x, player.velocity.z).toFixed(1);
  const percent = Math.round(chaos * 100);
  meterEl.style.width = `${percent}%`;
  notchEl.style.left = `${percent}%`;
  const atCrossing = Math.hypot(player.position.x, player.position.z) < 25;
  const experienceState = atCrossing ? "NEUTRAL" : chaos < 0.4 ? "SERENE" : chaos < 0.65 ? "TRANSFORMING" : "CHAOTIC";
  signalEl.textContent = experienceState;
  experienceStateEl.textContent = `${experienceState} DREAMSCAPE`;
  const currentWorld = biomeAt(player.position.x, player.position.z);
  realmEl.textContent = currentWorld.name;
  if (ui.kingdomEl.textContent !== currentWorld.name) {
    ui.kingdomEl.textContent = currentWorld.name;
    ui.kingdomEl.style.color = currentWorld.banner;
    // Restart the entry flash each time the player crosses into another kingdom.
    ui.kingdomEl.classList.remove("enter");
    void ui.kingdomEl.offsetWidth;
    ui.kingdomEl.classList.add("enter");
  }
  compassDirectionEl.textContent = currentWorld.route;
  compassWorldEl.textContent = currentWorld.name;
  // Keep renderer-owned discovery/progress messages, but only in their own kingdom.
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
  compassCoordinatesEl.textContent = `X ${Math.round(player.position.x)} · Z ${Math.round(player.position.z)}`;
  const bearing = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
  const directions = ["N · NORTH","NE · NORTH-EAST","E · EAST","SE · SOUTH-EAST","S · SOUTH","SW · SOUTH-WEST","W · WEST","NW · NORTH-WEST"];
  facingEl.textContent = directions[Math.round(bearing / 45) % 8];
  document.documentElement.style.setProperty("--acid", chaos > 0.62 ? "#ff705d" : "#c6ff65");
  if (hintTimer > 5) document.querySelector("#movementHint").classList.add("fade");
}

// Bottom-left score readout, e.g. "CHAOS 0.42 ▲".
export function updateChaosReadout(label, score, trend) {
  const arrow = trend > 0 ? '▲' : trend < 0 ? '▼' : '–';
  document.querySelector('#chaosReadout').textContent = `${label} ${score.toFixed(2)} ${arrow}`;
}
