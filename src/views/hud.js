export async function mountView() {
  const response = await fetch(new URL('./game.html', import.meta.url));
  if (!response.ok) throw new Error(`Could not load game view (${response.status})`);
  document.querySelector('#app').innerHTML = await response.text();
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
  const facingEl = document.querySelector("#facingDirection");
  const experienceStateEl = document.querySelector("#experienceState");
  const compassDirectionEl = document.querySelector("#compassDirection");
  const compassWorldEl = document.querySelector("#compassWorld");
  const compassCoordinatesEl = document.querySelector("#compassCoordinates");
  const swarmPanelEl = document.querySelector("#swarmPanel");
  const swarmStatusEl = document.querySelector("#swarmStatus");

  return { worldEl, introEl, enterButton, meterEl, notchEl, signalEl, velocityEl, chunksEl, seedEl, realmEl, facingEl, experienceStateEl, compassDirectionEl, compassWorldEl, compassCoordinatesEl, swarmPanelEl, swarmStatusEl };
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
  compassDirectionEl.textContent = currentWorld.route;
  compassWorldEl.textContent = currentWorld.name;
  compassCoordinatesEl.textContent = `X ${Math.round(player.position.x)} · Z ${Math.round(player.position.z)}`;
  const bearing = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
  const directions = ["N · NORTH","NE · NORTH-EAST","E · EAST","SE · SOUTH-EAST","S · SOUTH","SW · SOUTH-WEST","W · WEST","NW · NORTH-WEST"];
  facingEl.textContent = directions[Math.round(bearing / 45) % 8];
  document.documentElement.style.setProperty("--acid", chaos > 0.62 ? "#ff705d" : "#c6ff65");
  if (hintTimer > 5) document.querySelector("#movementHint").classList.add("fade");
}
