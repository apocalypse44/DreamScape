import { createGameState, START } from '../models/state.js';
import { createWorld } from '../models/world.js';
import { DreamSwarm } from '../models/swarm.js';
import { createScene } from '../rendering/scene.js';
import { createEnvironment } from '../rendering/environment.js';
import { createAtmosphereDemo } from '../rendering/atmosphere.js';
import { createGrass } from '../rendering/grass.js';
import { updateHUD, updateQuestHUD } from '../views/hud.js';
import { bindInput } from './input.js';
import { createPlayerController } from './player.js';
import { createCameraController } from './camera.js';
import { createCharacter } from '../rendering/character.js';
import { createQuest } from '../models/quest.js';
import { createShrine } from '../rendering/shrine.js';
import { createCompanion } from '../rendering/companion.js';

export function startGame(ui) {
  const { state, keys, pointerButtons, player } = createGameState();
  const { scene, renderer, camera, sun, hemi } = createScene(ui.worldEl);
  let atmosphere = null;
  const world = createWorld({ scene, state, player, onChunk: chunk => atmosphere?.prepare?.(chunk) });
  const { chunks, hash, biomeAt, terrainHeight, updateChunks } = world;
  ui.seedEl.textContent = `DS-${world.seed}`;
  const { moteMat, updateMotes, animateEnvironment } = createEnvironment({ scene, state, player, chunks });
  const swarm = new DreamSwarm(scene, terrainHeight);
  const { swarmPanelEl, swarmStatusEl } = ui;
  const quest = createQuest({ world, state, player });
  const shrine = createShrine({ scene, terrainHeight, quest });
  const companion = createCompanion({ scene, state, player, terrainHeight, quest });
  const movement = createPlayerController({ state, keys, player, chunks, terrainHeight, staticColliders: shrine.colliders });

  // Same seed + same starting state + rebuilt chunks = identical conditions for comparing play styles.
  function reset() {
    Object.assign(state, START);
    player.velocity.set(0, 0, 0);
    world.reset();
    updateChunks();
    player.position.set(0, terrainHeight(0, 0) + 2.05, 0);
    quest.reset();
    companion.reset();
  }
  // Stress test: [ and ] change how many chunks are loaded and reshaped each frame.
  function stress(step) {
    world.viewRadius += step;
  }
  bindInput({ state, keys, pointerButtons, player, renderer, camera, ui, onReset: reset, onStress: stress });
  atmosphere = createAtmosphereDemo({ scene, renderer, sun, hemi, moteMat, materialProfiles: world.materialProfiles });
  const grass = createGrass({ scene, terrainHeight, hash, chunks });
  const viewCamera = createCameraController({ camera, state, player, chunks, terrainHeight });
  const character = createCharacter({ scene, state, player });
  const chaosFog = new THREE.Color(0x2a0809);
  function updateSwarm(dt) {
    const insideSwarmWorld = biomeAt(player.position.x, player.position.z).kind === "wisps";
    let mode = "roaming";
    if (keys.has("KeyF")) mode = "recall";
    else if (keys.has("KeyQ") || pointerButtons.has(2)) mode = "repel";
    else if (keys.has("KeyE") || pointerButtons.has(0)) mode = "attract";
    // Gathering the swarm calms the world; scattering it stirs chaos.
    if (insideSwarmWorld && mode === "attract") state.chaos -= 0.12 * dt;
    if (insideSwarmWorld && mode === "repel") state.chaos += 0.2 * dt;
    swarm.setEnabled(insideSwarmWorld, player.position);
    swarm.update(dt, player.position, camera, mode, state.chaos);
    swarmPanelEl.classList.toggle("active", insideSwarmWorld);
    swarmStatusEl.textContent = mode.toUpperCase();
  }

  const clock = new THREE.Clock();
  let fpsFrames = 0;
  let fpsTime = 0;
  function frame() {
    requestAnimationFrame(frame);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.04);
    fpsFrames++;
    fpsTime += rawDt;
    if (fpsTime >= 0.5) {
      ui.fpsEl.textContent = `${Math.round(fpsFrames / fpsTime)} · ${(fpsTime / fpsFrames * 1000).toFixed(1)} MS`;
      ui.loadEl.textContent = `R${world.viewRadius} · ${chunks.size} CHUNKS`;
      fpsFrames = fpsTime = 0;
    }
    state.elapsed += dt;
    updateChunks();
    world.updateTerrain(dt);
    movement.update(dt);
    quest.update();
    companion.update(dt);
    shrine.update(dt, state.elapsed);
    const cameraDistance = viewCamera.update();
    character.update(dt, cameraDistance);
    updateHUD(ui, state, player, biomeAt);
    updateQuestHUD(ui, quest);
    ui.chunksEl.textContent = String(world.formed).padStart(2, "0");
    updateSwarm(dt);
    updateMotes(dt);
    animateEnvironment();
    const currentBiome = biomeAt(player.position.x, player.position.z);
    const visualScore = atmosphere.score ? atmosphere.score(dt, state.chaos) : state.chaos;
    scene.fog.color.set(currentBiome.fog).lerp(chaosFog, visualScore * 0.25);
    scene.background = scene.fog.color;
    scene.fog.density = 0.009 + visualScore * 0.012;
    hemi.color.set(currentBiome.sky).lerp(new THREE.Color(0xff705d), visualScore * 0.35);
    sun.color.set(0xdfffc0).lerp(new THREE.Color(0xff4d35), visualScore);
    moteMat.color.set(0xc6ff70).lerp(new THREE.Color(0xff3c28), visualScore);
    moteMat.opacity = 0.3 + visualScore * 0.65;
    moteMat.size = 0.2 + visualScore * 0.42;
    atmosphere.update(visualScore, currentBiome);
    grass.update(Boolean(atmosphere.isEnabled?.()), player.position, visualScore, world.terrainVersion);
    renderer.render(scene, camera);
  }

  reset();
  frame();
}
