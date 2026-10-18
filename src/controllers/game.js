import { createGameState, START } from '../models/state.js';
import { createWorld } from '../models/world.js';
import { DreamSwarm } from '../models/swarm.js';
import { createScene } from '../rendering/scene.js';
import { createEnvironment } from '../rendering/environment.js';
import { createAtmosphere } from '../rendering/atmosphere.js';
import { createGrass } from '../rendering/grass.js';
import { updateHUD, updateQuestHUD } from '../views/hud.js';
import { bindInput } from './input.js';
import { createPlayerController, createSurfaceAt } from './player.js';
import { createCameraController } from './camera.js';
import { createCharacter } from '../rendering/character.js';
import { createQuest, SHRINE } from '../models/quest.js';
import { createShrine } from '../rendering/shrine.js';
import { createCompanion } from '../rendering/companion.js';
import { createProps } from '../rendering/props.js';
import { createNPCs, VILLAGERS } from '../rendering/npc.js';
import { createWaterfall } from '../rendering/waterfall.js';
import { createRidge } from '../rendering/ridge.js';
import { createWayfinding } from '../rendering/wayfinding.js';
import { createPlaza } from '../rendering/plaza.js';
import { createCloverTerrain } from '../rendering/cloverTerrain.js';
import { createSkyIsland } from '../rendering/skyIsland.js';
import { createKingdomBorder } from '../rendering/kingdomBorder.js';
import { createHeavenlyFalls } from '../rendering/heavenlyFalls.js';
import { createKingdomGates } from '../rendering/kingdomGates.js';
import { createSpade } from '../rendering/spade.js';
import { createEncounters } from './encounters.js';
import { createChaosLook } from './chaosLook.js';
import { applyCameraShake, prepareAudio } from '../rendering/fx.js';
import { toast } from '../views/overlay.js';
import { createKamui } from '../rendering/kamui.js';
import { createNavigation } from '../rendering/navigation.js';
import { createResolutionGovernor } from '../rendering/resolution.js';
import { createWorldMap } from '../views/worldMap.js';
import { createDemoSpawns } from '../views/demoSpawns.js';
import { createStartupReadiness, observeStartupLoading } from '../models/startup.js';
import { createHoundCutscene } from './houndScene.js';
import { createMusic } from '../rendering/music.js';
import { SPADE_MAP_LOCATIONS } from '../models/spadeStory.js';

export function startGame(ui) {
  const startup = createStartupReadiness();
  const stopObservingLoads = observeStartupLoading(THREE.DefaultLoadingManager, startup);
  const startupStatus = document.querySelector('#startupStatus');
  const enterLabel = ui.enterButton.querySelector('span');
  ui.enterButton.disabled = true;
  startup.begin(performance.now());
  prepareAudio().finally(() => startup.end(performance.now()));
  const { state, keys, pointerButtons, player } = createGameState();
  const music = createMusic({ state });
  const { scene, renderer, camera, sun, hemi } = createScene(ui.worldEl);
  let atmosphere = null;
  let props = null;
  const world = createWorld({ scene, state, player, onChunk: chunk => { props?.decorate(chunk); atmosphere?.prepare?.(chunk); } });
  const { chunks, hash, biomeAt, terrainHeight, updateChunks } = world;
  ui.seedEl.textContent = `DS-${world.seed}`;
  const { moteMat, updateMotes, animateEnvironment } = createEnvironment({ scene, state, player, chunks });
  const swarm = new DreamSwarm(scene, terrainHeight);
  const { swarmPanelEl, swarmStatusEl } = ui;
  let encounters = null; // created below; the quest only calls these during play
  const quest = createQuest({
    world,
    state,
    player,
    onEmberPickup: (index, count, total) => encounters.pickupEmber(index, count, total),
    onEmberPosition: (index, position) => encounters.setEmberPosition(index, position),
    onOfferEmbers: onDone => encounters.startOffering(onDone),
    onHoundDrop: () => toast('THE HOUND DROPS ITS EMBER — PICK IT UP', 3000),
  });
  const shrine = createShrine({ scene, terrainHeight, quest });
  const waterfall = createWaterfall({ scene, world, onReady: root => atmosphere?.prepare?.(root) });
  const ridge = createRidge({ scene, world, onReady: root => atmosphere?.prepare?.(root) });
  const wayfinding = createWayfinding({ scene, world });
  const plaza = createPlaza({ scene, world, onReady: root => atmosphere?.prepare?.(root) });
  const clover = createCloverTerrain({ scene, world, onReady: root => atmosphere?.prepare?.(root) });
  const skyIsland = createSkyIsland({ scene, world, onReady: root => atmosphere?.prepare?.(root) });
  shrine.colliders.push(...waterfall.colliders, ...wayfinding.colliders, ...ridge.colliders, ...plaza.colliders, ...clover.colliders);
  const heavenly = createHeavenlyFalls({ scene, world, onReady: root => atmosphere?.prepare?.(root) });
  const gates = createKingdomGates({ scene, world, onReady: root => atmosphere?.prepare?.(root) });
  const spade = createSpade({ scene, world, onReady: root => atmosphere?.prepare?.(root), notify: toast });
  shrine.colliders.push(...skyIsland.colliders, ...heavenly.colliders, ...gates.colliders, ...spade.colliders);
  const platforms = [...quest.platforms, ...waterfall.platforms, ...clover.platforms, ...skyIsland.platforms, ...heavenly.platforms, ...spade.platforms];
  const kingdomBorder = createKingdomBorder({ scene, world, player });
  const surfaceAt = createSurfaceAt(platforms, terrainHeight);
  // Ground-level obstacles the hound's A* routes around: landmark and prop colliders that still stand.
  const groundObstacles = () => [shrine.colliders, ...Array.from(chunks.values(), chunk => chunk.userData.colliders)]
    .flatMap(colliders => colliders.filter(c => !c.off && c.minY === undefined));
  const companion = createCompanion({ scene, camera, renderer, state, player, quest, surfaceAt, navigation: {
    height: terrainHeight, obstacles: groundObstacles, version: () => world.terrainVersion,
  } });
  const navigation = createNavigation({ scene, camera, player, quest, companion, terrainHeight,
    obstacles: groundObstacles, version: () => world.terrainVersion, shrine: SHRINE });
  const worldMap = createWorldMap({ world, player, state, quest, spade, companion, navigation, gates: gates.gates, canvas: renderer.domElement });
  const houndScene = createHoundCutscene({ camera, state, player, companion, keys, pointerButtons, terrainHeight, onReset: reset, canvas: renderer.domElement,
    getKeeper: () => encounters?.keeper,
    onCureComplete() {
      const refuge = SPADE_MAP_LOCATIONS.find(location => location.id === 'spade-refuge');
      navigation.setDestination({ ...refuge.destination, id: refuge.id });
      toast('NEXT · FIND NERIS AT THE LANTERN REFUGE · SPADE KINGDOM', 6000);
    },
    obstacles: () => [...chunks.values(), waterfall.obstacles, wayfinding.root, ridge.root, plaza.root,
      clover.root, skyIsland.root, spade.obstacles, shrine.root].filter(Boolean) });
  props = createProps({ scene, world, blockers: () => [...quest.platforms, ...quest.embers, ...wayfinding.colliders, ...gates.gates, ...VILLAGERS.map(({ home: [x, z] }) => ({ x, z }))], onReady: root => atmosphere?.prepare?.(root) });
  const npcs = createNPCs({ scene, state, player, terrainHeight, hash, colliders: shrine.colliders, onReady: root => atmosphere?.prepare?.(root) });
  // NPC fetching/parsing uses fetch rather than the Three.js loading manager.
  startup.begin(performance.now());
  npcs.ready.finally(() => startup.end(performance.now()));
  const movement = createPlayerController({ state, keys, player, chunks, terrainHeight, staticColliders: shrine.colliders,
    platforms,
    isMovementBlocked: () => skyIsland.journey.blocked || houndScene.active,
    colliderFilter: collider => !skyIsland.journey.visiting || collider.minY !== undefined,
    allowFallRecovery: player => !spade.isInsideCastle(player.position),
    courseRecovery: player => skyIsland.journey.visiting ? skyIsland.journey.recovery(player)
      : waterfall.courseRecovery(player) || clover.courseRecovery(player) });

  // Same seed + same starting state + rebuilt chunks = identical conditions for comparing play styles.
  function reset() {
    houndScene.reset();
    music.reset();
    Object.assign(state, START);
    keys.clear();
    pointerButtons.clear();
    state.crouching = false;
    state.hintTimer = 0;
    ui.worldEl.ownerDocument.querySelector('#movementHint').classList.remove('fade');
    world.reset();
    player.position.set(0, terrainHeight(0, 0) + 2.05, 0);
    movement.reset();
    updateChunks();
    quest.reset();
    encounters.reset();
    chaosLook.reset();
    atmosphere.reset();
    companion.reset();
    navigation.reset();
    npcs.reset();
    waterfall.reset();
    ridge.reset();
    wayfinding.reset();
    plaza.reset();
    clover.reset();
    skyIsland.reset();
    spade.reset();
  }
  // Stress test: [ and ] change how many chunks are loaded and reshaped each frame.
  function stress(step) {
    world.viewRadius += step;
    const side = 2 * world.viewRadius + 1;
    toast(`VIEW RADIUS ${world.viewRadius} · ${side * side} CHUNKS`, 1800);
  }
  bindInput({ state, keys, pointerButtons, player, renderer, camera, ui, onReset: reset, onStress: stress });
  atmosphere = createAtmosphere({ scene, renderer, sun, hemi, moteMat, chunks, materialProfiles: world.materialProfiles });
  atmosphere.prepare?.(wayfinding.root);
  atmosphere.prepare?.(plaza.root);
  atmosphere.prepare?.(clover.root);
  atmosphere.prepare?.(skyIsland.root);
  atmosphere.prepare?.(spade.root);
  const grass = createGrass({ hash, chunks });
  const viewCamera = createCameraController({ camera, state, player, chunks, terrainHeight, staticObstacles: [waterfall.obstacles, wayfinding.root, ridge.root, plaza.root, clover.root, skyIsland.root, spade.obstacles] });
  const character = createCharacter({ scene, state, player, surfaceAt });
  encounters = createEncounters({ scene, camera, renderer, world, state, keys, player, quest, shrine, companion,
    // E at a Sky Garden gateway travels instead of petting.
    isInputActive: () => state.locked && !houndScene.active && !skyIsland.journey.atDoor(player.position),
    // NPCs keep out of landmarks and anything the player collides with (shrine tower, trees, rocks).
    blocked: (x, z) => world.isLandmarkArea(x, z) ||
      [shrine.colliders, ...Array.from(chunks.values(), chunk => chunk.userData.colliders)]
        .some(colliders => colliders.some(c => !c.off && c.minY === undefined && Math.hypot(x - c.x, z - c.z) < c.radius + 0.5)),
  });
  const chaosLook = createChaosLook();
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

  // Screen warp is reserved for demo spawns (keys 1–5 and their buttons).
  const kamui = createKamui(renderer);
  const pressed = new Set(); // edge detection for one-shot keys
  const tapped = code => { const down = keys.has(code), fresh = down && !pressed.has(code); if (down) pressed.add(code); else pressed.delete(code); return fresh; };
  function updateShortcuts() {
    if (tapped('KeyG')) toast(navigation.toggle() ? 'ROUTE ON' : 'ROUTE HIDDEN · ARROW STAYS', 2000);
  }

  // Console handles for demos and report screenshots, e.g. dreamscape.kamui.pulse(), dreamscape.navigation.toggle().
  window.dreamscape = { kamui, navigation, state, quest, clock: atmosphere.clock, spade, startup, music };

  // Demo travel (keys 1-5): the tower, or 8 m in front of a kingdom gate facing in.
  const demoSpawns = createDemoSpawns({
    isAvailable: () => !houndScene.active,
    spawn(index) {
      let x = 0, z = 0, yaw = 0;
      const gate = gates.gates[index - 1];
      if (gate) {
        const d = Math.hypot(gate.x, gate.z), ox = gate.x / d, oz = gate.z / d; // outward
        x = gate.x - ox * 8;
        z = gate.z - oz * 8;
        yaw = Math.atan2(-ox, -oz); // forward is (-sin yaw, -cos yaw)
      }
      if (skyIsland.journey.visiting || skyIsland.journey.blocked) skyIsland.reset();
      movement.teleport({ x, z, top: terrainHeight(x, z), yaw });
      companion.reset();
      kamui.pulse(null, 1.4, { full: true });
      toast(`DEMO · ${gate ? `${gate.name} GATE` : 'GRIMOIRE TOWER'}`, 2200);
    },
  });
  // Stress-test radius below the default (0 or 1): hide landmarks outside the loaded square of chunks,
  // so islands and arches don't float over the void. At radius 2+ they stay visible from afar as
  // destinations, as designed. Footprints (XZ boxes) are measured when the radius changes.
  const landmarks = [waterfall.root, wayfinding.root, ridge.root, plaza.root, clover.root, clover.lake,
    skyIsland.root, skyIsland.water, heavenly.root, heavenly.jet, ...gates.root.children].filter(Boolean);
  const footprints = new Map();
  let cullRadius = null;
  function cullLandmarks() {
    const radius = world.viewRadius;
    if (radius >= 2) {
      if (cullRadius !== null) { landmarks.forEach(object => { object.visible = true; }); cullRadius = null; }
      return;
    }
    if (cullRadius !== radius) { footprints.clear(); cullRadius = radius; }
    const reach = (radius + 0.5) * 64; // half-width of the loaded square, in metres
    for (const object of landmarks) {
      let box = footprints.get(object);
      if (!box) footprints.set(object, box = new THREE.Box3().setFromObject(object));
      const dx = Math.max(box.min.x - player.position.x, 0, player.position.x - box.max.x);
      const dz = Math.max(box.min.z - player.position.z, 0, player.position.z - box.max.z);
      object.visible = Math.max(dx, dz) < reach; // square, like the chunk grid
    }
  }
  const resolution = createResolutionGovernor(renderer);
  const clock = new THREE.Clock();
  let fpsFrames = 0;
  let fpsTime = 0;
  function frame() {
    requestAnimationFrame(frame);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.04);
    // Startup work is not a useful measurement of sustained rendering speed.
    if (startup.ready || (!startup.pending && props.prepared && !world.pendingChunks)) resolution.update(rawDt);
    fpsFrames++;
    fpsTime += rawDt;
    if (fpsTime >= 0.5) {
      ui.fpsEl.textContent = `${Math.round(fpsFrames / fpsTime)} · ${(fpsTime / fpsFrames * 1000).toFixed(1)} MS · ${resolution.ratio.toFixed(2)}×`;
      ui.loadEl.textContent = `R${world.viewRadius} · ${chunks.size} CHUNKS`;
      fpsFrames = fpsTime = 0;
    }
    const playDt = houndScene.active ? 0 : dt;
    if (startup.ready) state.elapsed += playDt;
    updateChunks();
    world.updateTerrain(playDt);
    if (!houndScene.active) skyIsland.update(dt, player, keys, state, target => movement.teleport(target));
    if (!skyIsland.journey.blocked && !houndScene.active) movement.update(startup.ready ? dt : 0);
    props.update(player.position, world.terrainVersion);
    if (!houndScene.active) quest.update();
    houndScene.observe(quest.stage, startup.ready && state.locked && !state.mapOpen &&
      !skyIsland.journey.blocked && player.grounded);
    companion.update(dt, dt => encounters.updateDog(dt, state.elapsed), houndScene.presentation);
    if (!houndScene.active) quest.updateHoundEmber(companion.position);
    kingdomBorder.update(playDt);
    gates.update(playDt);
    if (!houndScene.active) spade.update(dt, player, state);
    heavenly.update(dt, player.position);
    npcs.update(dt);
    shrine.update(dt, state.elapsed);
    waterfall.update(dt, player.position);
    ridge.update(player.position);
    wayfinding.update();
    plaza.update();
    clover.update(player.position, dt);
    let cameraDistance;
    if (houndScene.active) cameraDistance = houndScene.update(dt);
    else if (skyIsland.journey.blocked) cameraDistance = skyIsland.updateTravelCamera(camera, player);
    else { skyIsland.restoreTravelCamera(camera); cameraDistance = viewCamera.update(); }
    character.update(dt, cameraDistance);
    navigation.update(dt, houndScene.active); // after the camera, so the arrow matches this frame's view
    worldMap.update();
    demoSpawns.update();
    cullLandmarks();
    updateHUD(ui, state, player, biomeAt);
    updateQuestHUD(ui, quest);
    encounters.update(dt, state.elapsed);
    ui.chunksEl.textContent = String(world.formed).padStart(2, "0");
    if (!houndScene.active) updateSwarm(dt);
    updateMotes(dt);
    animateEnvironment();
    const currentBiome = biomeAt(player.position.x, player.position.z);
    atmosphere.advance(dt);
    const visualScore = state.chaos;
    scene.fog.color.set(currentBiome.fog).lerp(chaosFog, visualScore * 0.25);
    scene.background = scene.fog.color;
    scene.fog.density = 0.009 + visualScore * 0.012;
    hemi.color.set(currentBiome.sky).lerp(new THREE.Color(0xff705d), visualScore * 0.35);
    sun.color.set(0xdfffc0).lerp(new THREE.Color(0xff4d35), visualScore);
    moteMat.color.set(0xc6ff70).lerp(new THREE.Color(0xff3c28), visualScore);
    moteMat.opacity = 0.3 + visualScore * 0.65;
    moteMat.size = 0.2 + visualScore * 0.42;
    atmosphere.update(visualScore, currentBiome);
    // Lift the veil at the summit and above the clouds so the destination and
    // views remain visible even when running has increased the world's chaos.
    if (skyIsland.journey.visiting || skyIsland.journey.blocked) {
      scene.fog.density = Math.min(scene.fog.density, 0.0035);
      scene.fog.color.set(0xa9cbd3);
      if (!scene.background?.isTexture) scene.background = scene.fog.color;
      sun.intensity = Math.max(sun.intensity, 1.8);
      hemi.intensity = Math.max(hemi.intensity, 1.5);
    } else if (player.position.y > 24 && Math.hypot(player.position.x-2,player.position.z+510)<45) {
      scene.fog.density = Math.min(scene.fog.density, 0.006);
    }
    grass.update();
    if (!houndScene.active) applyCameraShake(camera, dt);
    const chaosScore = chaosLook.update(houndScene.active ? 0 : dt, state);
    atmosphere.finish(dt, chaosScore, camera);
    updateShortcuts();
    music.update(dt);
    kamui.render(scene, camera, dt);
    if (!startup.ready) {
      const phase = startup.update({ now: performance.now(), frameMs: rawDt * 1000,
        prepared: !world.pendingChunks && props.prepared });
      if (phase === 'warmup') {
        // All startup assets are now installed; compile their final lighting
        // variants behind the intro, then wait for real render/upload frames.
        renderer.compile(scene, camera);
      }
      if (ui.introEl.dataset.loadPhase !== phase) ui.introEl.dataset.loadPhase = phase;
      const text = phase === 'loading' ? 'Gathering the world…'
        : phase === 'preparing' ? 'Dreaming the landscape…'
        : phase === 'ready' ? 'Your dream is ready.' : 'Lighting the way…';
      if (startupStatus.textContent !== text) startupStatus.textContent = text;
      if (phase === 'ready') {
        stopObservingLoads();
        enterLabel.textContent = 'ENTER THE DREAM';
        ui.enterButton.disabled = false;
        fpsFrames = fpsTime = 0;
      }
    }
  }

  reset();
  frame();
}
