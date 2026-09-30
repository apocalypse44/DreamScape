import { createGameState } from '../models/state.js';
import { createWorld } from '../models/world.js';
import { DreamSwarm } from '../models/swarm.js';
import { createScene } from '../rendering/scene.js';
import { createEnvironment } from '../rendering/environment.js';
import { createAtmosphereDemo } from '../rendering/atmosphere.js';
import { createGrass } from '../rendering/grass.js';
import { updateHUD } from '../views/hud.js';
import { bindInput } from './input.js';
import { createPlayerController } from './player.js';
import { createCameraController } from './camera.js';
import { createCharacter } from '../rendering/character.js';

export function startGame(ui) {
  const { state, keys, pointerButtons, player } = createGameState();
  const { scene, renderer, camera, sun, hemi } = createScene(ui.worldEl);
  let atmosphere = null;
  const world = createWorld({ scene, state, player, onChunk: chunk => atmosphere?.prepare?.(chunk) });
  const { chunks, hash, biomeAt, terrainHeight, scoreAt, updateChunks } = world;
  ui.seedEl.textContent = `DS-${world.seed}`;
  const { moteMat, updateMotes, animateEnvironment } = createEnvironment({ scene, state, player, chunks });
  const swarm = new DreamSwarm(scene, terrainHeight);
  const { swarmPanelEl, swarmStatusEl } = ui;
  const movement = createPlayerController({ state, keys, player, camera, chunks, terrainHeight, scoreAt });
  bindInput({ state, keys, pointerButtons, player, renderer, camera, ui });
  atmosphere = createAtmosphereDemo({ scene, renderer, sun, hemi, moteMat, materialProfiles: world.materialProfiles });
  const grass = createGrass({ scene, terrainHeight, hash, chunks });
  const viewCamera = createCameraController({ camera, state, player, chunks, terrainHeight });
  const character = createCharacter({ scene, state, player });
  const chaosFog = new THREE.Color(0x2a0809);
  function updateSwarm(dt) {
    const insideSwarmWorld = biomeAt(player.position.x, player.position.z).kind === "wisps";
    let mode = "roaming";
    if (keys.has("KeyR")) mode = "recall";
    else if (keys.has("KeyQ") || pointerButtons.has(2)) mode = "repel";
    else if (keys.has("KeyE") || pointerButtons.has(0)) mode = "attract";
    swarm.setEnabled(insideSwarmWorld, player.position);
    swarm.update(dt, player.position, camera, mode, state.chaos);
    swarmPanelEl.classList.toggle("active", insideSwarmWorld);
    swarmStatusEl.textContent = mode.toUpperCase();
  }

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.04);
    state.elapsed += dt;
    updateChunks();
    movement.update(dt);
    const cameraDistance = viewCamera.update();
    character.update(dt, cameraDistance);
    updateHUD(ui, state, player, biomeAt);
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
    grass.update(Boolean(atmosphere.isEnabled?.()), player.position, visualScore);
    renderer.render(scene, camera);
  }

  updateChunks();
  player.position.y = terrainHeight(0, 0, scoreAt(0, 0)) + 2.05;
  frame();
}
