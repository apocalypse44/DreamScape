import { createGameState, START } from '../models/state.js';
import { createWorld } from '../models/world.js';
import { DreamSwarm } from '../models/swarm.js';
import { createScene } from '../rendering/scene.js';
import { createLightPool } from '../rendering/lightPool.js';
import { warmEverything } from '../rendering/warmup.js';
import { createEnvironment } from '../rendering/environment.js';
import { createAtmosphere } from '../rendering/atmosphere.js';
import { createGrass } from '../rendering/grass.js';
import { updateHUD, updateQuestHUD, updateSeal } from '../views/hud.js';
import { createMana, MANA } from '../models/mana.js';
import { createMoteField, createMilestones } from '../models/manaMotes.js';
import { createManaMoteView } from '../rendering/manaMotes.js';
import { bindInput } from './input.js';
import { createPlayerController, createSurfaceAt } from './player.js';
import { createCameraController } from './camera.js';
import { createTravelerCharacter } from '../rendering/travelerCharacter.js';
import { createQuest, SHRINE } from '../models/quest.js';
import { createShrine } from '../rendering/shrine.js';
import { createCompanion } from '../rendering/companion.js';
import { createProps } from '../rendering/props.js';
import { createNPCs, VILLAGERS } from '../rendering/npc.js';
import { createWaterfall } from '../rendering/waterfall.js';
import { createRidge } from '../rendering/ridge.js';
import { createWayfinding } from '../rendering/wayfinding.js';
import { createTowerPlaza } from '../rendering/towerPlaza.js';
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
import { createHelpPanel } from '../views/helpPanel.js';
import { createDemoSpawns } from '../views/demoSpawns.js';
import { createStartupReadiness, observeStartupLoading } from '../models/startup.js';
import { createHoundCutscene } from './houndScene.js';
import { createDoorScene } from './doorScene.js';
import { createCloverScenes } from './cloverScenes.js';
import { heartVisionShot } from './heartScenes.js';
import { createHeartPastFlashback } from './heartFlashback.js'; // Heart: "The Quiet Springs"
import { HEART_SHOTS, heartShotKeys } from '../models/heartStory.js';
import { createSeveringFlashback } from './cloverFlashback.js';
import { createEmberFlashback } from './emberFlashback.js';
import { createMemoryLook } from '../rendering/memoryLook.js';
import { createInventory } from '../models/inventory.js';
import { riftOpenness } from '../models/rift.js';
import { createMusic } from '../rendering/music.js';
import { buildDiamondCampaign } from '../rendering/diamondCampaign.js'; // Diamond chapter
import { buildDiamondQuarry } from '../rendering/diamondQuarry.js'; // Diamond kingdom: the quarry around the relay
import { buildDiamondKingdom } from '../rendering/diamondKingdom.js'; // Diamond kingdom: the Prism Citadel
import { buildDiamondRoyal } from '../rendering/diamondRoyal.js'; // Diamond kingdom: the royal enclave and Great Prism
import { buildDiamondDustward } from '../rendering/diamondDustward.js'; // Diamond kingdom: the workers' slum and Tithe Yard
import { buildDiamondStockade } from '../rendering/diamondStockade.js'; // Diamond kingdom: the Workers' Stockade, freed by the relay
import { buildDiamondRow } from '../rendering/diamondRow.js'; // Diamond kingdom: Artificers' Row and Orin's Hall
import { buildDiamondSiege } from '../rendering/diamondSiege.js'; // Diamond kingdom: Siege Yard and Barracks
import { buildDiamondSigns } from '../rendering/diamondSigns.js'; // Diamond kingdom: fingerposts
import { createChainOrderFlashback } from './diamondFlashback.js'; // Diamond kingdom: "The Chain Order"
import { diamondMapLocations, DIAMOND_SHOTS, shotKeys } from '../models/diamondStory.js'; // Diamond kingdom: Atlas places and shots
import { buildCloverCampaign } from '../rendering/cloverCampaign.js';
import { buildHeartCampaign } from '../rendering/heartCampaign.js';
import { buildHeartTown } from '../rendering/heartTown.js';
import { createHeartPetals } from '../rendering/heartPetals.js';
import { applyTestStart, getTestStart } from '../models/testStarts.js';
import { createGrimoirePages, PAGE_FOR_SIGIL } from './grimoirePages.js';
import { createBossFights } from './bossFights.js';

export function startGame(ui, { testStartId = null } = {}) {
  const unlockAll = new URLSearchParams(location.search).get('unlock') === 'all';
  const testStart = unlockAll && testStartId ? getTestStart(testStartId) : null;
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
  const lamps = createLightPool(scene); // before anything builds a PointLight
  let atmosphere = null;
  let props = null;
  const world = createWorld({ scene, state, player, onChunk: chunk => { props?.decorate(chunk); atmosphere?.prepare?.(chunk); } });
  const { chunks, hash, biomeAt, terrainHeight, updateChunks } = world;
  const { moteMat, updateMotes, animateEnvironment } = createEnvironment({ scene, state, player, chunks });
  const swarm = new DreamSwarm(scene, terrainHeight);
  const { swarmPanelEl, swarmStatusEl } = ui;
  let encounters = null; // created below; the quest only calls these during play
  const quest = createQuest({
    world,
    state,
    player,
    demoCured: unlockAll && testStart?.id !== 'ember-hound',
    onEmberPickup: (index, count, total) => { encounters.pickupEmber(index, count, total); questStep('embers', count); },
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
  let doorScene = null, cloverScenes = null; // created below, with the camera controls
  let pages = null; // the grimoire page reveals, made once the scene and camera exist
  let bosses = null; // Morcant and Sile (bossFights.js), made once the traveller exists
  const mana = createMana(); // G surges into Chaos (MANA_PLAN.md)
  const motes = createMoteField({ groundAt: (x, z) => world.surfaceHeight(x, z), canSpawnAt: (x, z) => !world.isLandmarkArea(x, z) });
  const moteView = createManaMoteView(scene);
  // Quest progress refills the bar: a step (ember, lantern, fragment, arch) +10%, a new inventory item +25%.
  const milestones = createMilestones();
  const earn = (amount, label) => { mana.add(amount); toast(`MANA +${Math.round(amount * 100)}% · ${label}`, 2000); };
  const questStep = (key, count) => { const n = milestones.reach(key, count); if (n) earn(n * 0.1, 'QUEST PROGRESS'); };
  // Each sigil returns a page; Heart's Tide Sigil (page IV) and Diamond's Prism Sigil (page V) then open a boss fight.
  const inventory = createInventory({ onAdd: (id, item) => { toast(`INVENTORY · ${item.name.toUpperCase()} ADDED`, 3500); if (milestones.reach(`item:${id}`, 1)) mana.add(0.25); if (id in PAGE_FOR_SIGIL) pages?.queue(PAGE_FOR_SIGIL[id]);
    if (id === 'tide-sigil') bosses?.queue('morcant'); if (id === 'prism-sigil') bosses?.queue('sile'); } });
  // Nim, Sera's scout, waits beside the Clover gate on the way out (shown once the Tide Hook is carried).
  const cloverGate = gates.gates.find(g => /clover/i.test(g.name));
  const scout = cloverGate ? { x: cloverGate.x + 7, z: cloverGate.z + 6 } : null;
  const nim = VILLAGERS.find(v => v.name === 'Nim');
  if (nim && scout) nim.home = [scout.x, scout.z];
  const heart = buildHeartCampaign({ scene, world, keys, notify: toast, scout,
    // Everyone else you must talk to gets the same bottom prompt as Nim and Sera.
    talkHint: p => spade.campaign.hint(p, state.chaos) ?? diamond.model.hint(p, state.chaos)
      ?? (quest.stage === 'return' && quest.nearShrine ? (quest.drowned ? 'CALM DOWN TO TALK TO THE SHRINE KEEPER' : 'WALK UP TO THE SHRINE KEEPER') : null),
    onVision: from => cloverScenes?.queue(from === 'nim' ? 'heart-quake' : 'heart-quake-gate'),
    onMeet: () => { cloverScenes?.queue('heart-past'); cloverScenes?.queue('heart-sera'); }, // the spring's memory, then Sera's instructions
    ready: () => inventory.has('root-sigil') && inventory.has('tide-hook'),
    onSigil: () => inventory.add('tide-sigil'),
    onReady: root => atmosphere?.prepare?.(root) });
  const sera = VILLAGERS.find(v => v.name === 'Sera');
  if (sera) sera.home = [heart.model.layout.sera.x, heart.model.layout.sera.z];
  // Tidewell, Heart's town of stopped mills, and the palace; its townsfolk stand where the layout says.
  const heartAir = createHeartPetals({ scene }); // rose petals in Heart; fireflies once it is restored
  const tidewell = buildHeartTown({ scene, model: heart.model, onReady: root => atmosphere?.prepare?.(root) });
  const { folk: townsfolk, returning: homecomers } = heart.model.layout.town;
  for (const f of [...townsfolk, ...homecomers]) { const v = VILLAGERS.find(n => n.name === f.name); if (v) { v.home = [f.x, f.z]; if (f.y !== undefined) v.y = f.y; } }
  const spade = createSpade({ scene, world, onReady: root => atmosphere?.prepare?.(root), notify: toast,
    chapterReady: () => quest.stage === 'cured', // Spade's chapter waits for the Ember Hound's cure
    onChapterComplete: () => doorScene.queue(9), // the castle doors open; the sigil waits in the archive chest
    keys, hasSigil: () => inventory.has('lantern-sigil'), onSigil: () => inventory.add('lantern-sigil') });
  // --- Clover chapter: The Living Road ---
  const livingRoad = buildCloverCampaign({ scene, world, keys, notify: toast,
    ready: () => inventory.has('lantern-sigil') && spade.castle.discovery.complete,
    onSigil: () => inventory.add('root-sigil'), onHook: () => inventory.add('tide-hook'),
    onScene: kind => cloverScenes?.queue(kind),
    onReady: root => atmosphere?.prepare?.(root) });
  shrine.colliders.push(...livingRoad.colliders);
  // --- end Clover chapter ---
  shrine.colliders.push(...heart.colliders, ...tidewell.colliders, ...skyIsland.colliders, ...heavenly.colliders, ...gates.colliders, ...spade.colliders);
  const towerPlaza = createTowerPlaza({ scene, ground: terrainHeight, spadeFree: () => ['report', 'complete'].includes(spade.campaign.stage),
    occupied: (x, z) => shrine.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.radius + 1.5) });
  shrine.colliders.push(...towerPlaza.colliders);
  // --- Diamond chapter: the Shatterglass Relay beyond the Diamond gate ---
  const diamond = buildDiamondCampaign({ scene, gate: gates.gates.find(g => /diamond/i.test(g.name)) ?? gates.gates[3],
    surfaceHeight: world.surfaceHeight, keys, notify: toast,
    ready: () => inventory.has('tide-sigil'),            // Heart's Tide Sigil opens the chapter
    // Orin's Hall remembers "The Chain Order", then Orin points the way back to Spade.
    onChapterComplete: () => { inventory.add('prism-sigil'); cloverScenes?.queue('diamond-chain-order'); cloverScenes?.queue('diamond-lead'); } });
  // Orin stands beside the relay, wherever the Diamond gate really is.
  const orin = VILLAGERS.find(v => v.name === 'Orin');
  if (orin) orin.home = [diamond.model.layout.orin.x, diamond.model.layout.orin.z];
  const diamondQuarry = buildDiamondQuarry({ scene, quarry: world.quarry, layout: diamond.model.layout, surfaceHeight: world.surfaceHeight });
  // The Triad holds the citadel until the relay's pulse reaches the inversion core.
  const diamondKingdom = buildDiamondKingdom({ scene, kingdom: world.diamond, surfaceHeight: world.surfaceHeight, held: () => !['report', 'complete'].includes(diamond.model.stage) });
  // The kingdom's divide: the royals' enclave on the mesa, the workers' Dustward below.
  const diamondRoyal = buildDiamondRoyal({ scene, kingdom: world.diamond, surfaceHeight: world.surfaceHeight });
  const diamondDustward = buildDiamondDustward({ scene, kingdom: world.diamond, surfaceHeight: world.surfaceHeight });
  // Workers are villager mannequins; npcs is created below and only called once the game runs.
  const diamondStockade = buildDiamondStockade({ scene, kingdom: world.diamond, surfaceHeight: world.surfaceHeight, actor: def => npcs.actor(def) });
  const diamondRow = buildDiamondRow({ scene, kingdom: world.diamond, keys, notify: toast });
  const diamondSiege = buildDiamondSiege({ scene, kingdom: world.diamond });
  const diamondSigns = buildDiamondSigns({ scene, kingdom: world.diamond, surfaceHeight: world.surfaceHeight });
  shrine.colliders.push(...diamondQuarry.colliders, ...diamondKingdom.colliders, ...diamondRoyal.colliders, ...diamondDustward.colliders, ...diamondStockade.colliders, ...diamondRow.colliders, ...diamondSiege.colliders, ...diamondSigns.colliders, ...world.diamond.bridge.rails);
  // --- end Diamond chapter ---
  const platforms = [...quest.platforms, ...waterfall.platforms, ...clover.platforms, ...heart.platforms, ...tidewell.platforms, ...skyIsland.platforms, ...heavenly.platforms, ...spade.platforms, ...livingRoad.platforms, world.diamond.bridge.platform];
  const kingdomBorder = createKingdomBorder({ scene, world, player });
  // Standing and feet use the ground as drawn (flat mesh triangles), not the smooth height between vertices.
  const surfaceAt = createSurfaceAt(platforms, world.surfaceHeight);
  // Ground-level obstacles the hound's A* routes around: landmark and prop colliders that still stand.
  const groundObstacles = () => [shrine.colliders, ...Array.from(chunks.values(), chunk => chunk.userData.colliders)]
    .flatMap(colliders => colliders.filter(c => !c.off && c.minY === undefined));
  const companion = createCompanion({ scene, camera, renderer, state, player, quest, surfaceAt, navigation: {
    height: terrainHeight, obstacles: groundObstacles, version: () => world.terrainVersion,
  } });
  const navigation = createNavigation({ scene, camera, player, quest, companion, terrainHeight,
    obstacles: groundObstacles, version: () => world.terrainVersion, shrine: SHRINE });
  const worldMap = createWorldMap({ world, player, state, quest, spade, clover: livingRoad.model, heart: heart.model, diamond: diamond.model, inventory, companion, navigation, gates: gates.gates, canvas: renderer.domElement,
    diamondLocations: diamondMapLocations(world.diamond), hasBlade: () => !!bosses?.won.has('morcant') }); // the sigil-blade, forged when Morcant falls
  const help = createHelpPanel({ quest, spade, clover: livingRoad.model, heart: heart.model, diamond: diamond.model, state });
  const houndScene = createHoundCutscene({ camera, state, player, companion, keys, pointerButtons, terrainHeight, onReset: reset, canvas: renderer.domElement,
    getKeeper: () => encounters?.keeper,
    onCureComplete() {
      cloverScenes.queue('mark'); // the shrine remembers how the curse was planted, then the keeper points to Spade
      pages.queue(0); // then the grimoire's first page (Gale), once the keeper has finished
      cloverScenes.observe(true); // start it this frame, under the cure's black, so gameplay never flashes between
    },
    obstacles: () => [...chunks.values(), waterfall.obstacles, wayfinding.root, ridge.root, plaza.root,
      clover.root, livingRoad.obstacles, skyIsland.root, spade.obstacles, shrine.root].filter(Boolean) });
  doorScene = createDoorScene({ camera, state, keys, onOpen: () => spade.openGate() });
  const heartGate = gates.gates.find(g => /heart/i.test(g.name)); // the chest cutscene swoops to it
  // Story flashbacks replay as memories (memoryLook); their actors borrow the villagers' mannequins.
  const memory = createMemoryLook(renderer);
  const cast = { actor: def => npcs.actor(def), setHidden: (name, hidden) => npcs.setHidden(name, hidden) }; // npcs is created below
  const severing = createSeveringFlashback({ scene, campaign: livingRoad, look: memory.look, state, npcs: cast });
  const mark = createEmberFlashback({ scene, look: memory.look, state, npcs: cast, groundAt: terrainHeight });
  const chainOrder = createChainOrderFlashback({ scene, kingdom: world.diamond, look: memory.look, state, npcs: cast });
  const heartPast = createHeartPastFlashback({ scene, layout: heart.model.layout, look: memory.look, state, npcs: cast, groundAt: terrainHeight, heart, tidewell });
  cloverScenes = createCloverScenes({ camera, state, keys, campaign: livingRoad, canvas: renderer.domElement, flashbacks: { severing, mark, chainOrder, heartPast }, groundAt: terrainHeight,
    heart: heartGate && { x: heartGate.x, y: terrainHeight(heartGate.x, heartGate.z), z: heartGate.z } }); // gates expose only name, x, z
  pages = createGrimoirePages({ scene, camera, state, keys, player, canvas: renderer.domElement });
  for (const from of ['nim', 'gate']) cloverScenes.define(from === 'nim' ? 'heart-quake' : 'heart-quake-gate', heartVisionShot({ model: heart.model, terrainHeight, from }));
  props = createProps({ scene, world, blockers: () => [...quest.platforms, ...quest.embers, ...wayfinding.colliders, ...gates.gates, ...VILLAGERS.map(({ home: [x, z] }) => ({ x, z })), ...towerPlaza.colliders, ...diamond.blockers], onReady: root => atmosphere?.prepare?.(root) });
  // Where an NPC must not stand: ground obstacles (not other NPCs) and solid structures at ground level.
  let npcObstacles = [], npcObstaclesAt = -Infinity;
  const npcBlocked = (x, z) => {
    // ponytail: the obstacle list is rebuilt at most once a second; a spatial grid if NPC counts grow.
    if (performance.now() - npcObstaclesAt > 1000) { npcObstacles = groundObstacles(); npcObstaclesAt = performance.now(); }
    const ground = terrainHeight(x, z);
    return npcObstacles.some(c => !c.npc && Math.hypot(c.x - x, c.z - z) < c.radius + 0.5) ||
      platforms.some(p => p.solid && p.bottom < ground + 1.8 && (p.top ?? Infinity) > ground + 0.3 &&
        (p.contains ? p.contains(x, z, 0.5) : Math.abs(x - p.x) < (p.width ?? 0) / 2 + 0.5 && Math.abs(z - p.z) < (p.depth ?? 0) / 2 + 0.5));
  };
  const npcs = createNPCs({ scene, state, player, terrainHeight, hash, colliders: shrine.colliders, blocked: npcBlocked, onReady: root => atmosphere?.prepare?.(root), hour: () => atmosphere?.clock.hour ?? 12 });
  // NPC fetching/parsing uses fetch rather than the Three.js loading manager.
  startup.begin(performance.now());
  npcs.ready.finally(() => startup.end(performance.now()));
  const movement = createPlayerController({ state, keys, player, chunks, terrainHeight: world.surfaceHeight, staticColliders: shrine.colliders,
    platforms,
    // After a Tide Hook swing, the controller keeps its momentum; in a boss arena the lab's pace and combat drive apply.
    locomotion: { drive: () => bosses?.drive ?? heart.grapple.drive,
      get walkSpeed() { return bosses?.pace?.walkSpeed; }, get sprintSpeed() { return bosses?.pace?.sprintSpeed; },
      get crouchSpeed() { return bosses?.pace?.crouchSpeed; }, get smooth() { return bosses?.pace?.smooth; }, get variableJump() { return bosses?.pace?.variableJump; } },
    isMovementBlocked: () => skyIsland.journey.blocked || houndScene.active || doorScene.active || cloverScenes.active,
    colliderFilter: collider => !skyIsland.journey.visiting || collider.minY !== undefined,
    // Long falls are fine in the castle and over Heart's crater (coming down off the islands is allowed).
    allowFallRecovery: player => !spade.isInsideCastle(player.position) && !world.heart.ownsArea(player.position, 8),
    courseRecovery: player => bosses?.recovery(player) ?? (skyIsland.journey.visiting ? skyIsland.journey.recovery(player)
      : livingRoad.model.ownsArea(player.position) ? livingRoad.recovery(player)
      : waterfall.courseRecovery(player) || clover.courseRecovery(player)) });

  // Stick and look in world space for the Tide Hook (as in the movement lab).
  function hookInput() {
    const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const sd = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const len = Math.hypot(f, sd) || 1, sin = Math.sin(state.yaw), cos = Math.cos(state.yaw), live = state.locked && !state.cinematic && !state.mapOpen;
    return { hold: live && keys.has('KeyQ'), jump: player.jumpBuffer > 0,
      moveX: live ? (-sin * f + cos * sd) / len : 0, moveZ: live ? (-cos * f - sin * sd) / len : 0, look: { x: -sin, z: -cos } };
  }

  // Same seed + same starting state + rebuilt chunks = identical conditions for comparing play styles.
  function reset() {
    houndScene.reset();
    doorScene.reset();
    cloverScenes.reset();
    pages.reset();
    bosses?.reset();
    inventory.reset();
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
    quest.reset();
    encounters.reset();
    chaosLook.reset();
    mana.reset();
    motes.reset();
    milestones.reset();
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
    heart.reset();
    diamond.reset(); // Diamond chapter
    livingRoad.reset(); // Clover chapter: R clears growth, discoveries and both earned items.
    if (testStart) {
      const target = applyTestStart(testStart.id, { spade, clover: livingRoad.model, heart: heart.model, diamond: diamond.model, inventory });
      movement.teleport({ ...target, top: target.top ?? world.surfaceHeight(target.x, target.z) });
      companion.reset();
    }
    character.reset?.();
    updateChunks();
    diamondArrived = Boolean(testStart && testStart.chapter >= 5);
    diamondStage = diamond.model.stage;
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
  atmosphere.prepare?.(heart.root);
  atmosphere.prepare?.(diamond.root); // Diamond chapter
  atmosphere.prepare?.(diamondQuarry.root);
  atmosphere.prepare?.(diamondKingdom.root);
  atmosphere.prepare?.(diamondRoyal.root);
  atmosphere.prepare?.(diamondDustward.root);
  atmosphere.prepare?.(diamondStockade.root);
  atmosphere.prepare?.(diamondRow.root);
  atmosphere.prepare?.(diamondSiege.root);
  atmosphere.prepare?.(livingRoad.root); // Clover chapter
  const grass = createGrass({ hash, chunks });
  const arenaObstacles = new THREE.Group(); scene.add(arenaObstacles); // the boss arenas' walls and spires, for the camera
  const viewCamera = createCameraController({ camera, state, player, chunks, terrainHeight, staticObstacles: [arenaObstacles, waterfall.obstacles, wayfinding.root, ridge.root, plaza.root, clover.root, livingRoad.obstacles, skyIsland.root, spade.obstacles, diamondRow.obstacles, tidewell.obstacles] });
  const character = createTravelerCharacter({ scene, state, player, surfaceAt, terrainAt: world.surfaceHeight, // the sigil-blade wanderer (src/assets/traveler.glb)
    walkSpeed: () => bosses?.pace?.walkSpeed ?? 9 });
  bosses = createBossFights({ scene, camera, state, keys, pointerButtons, player, movement, character, viewCamera,
    kamui: { pulse: (...args) => kamui.pulse(...args) }, // the warp in and out (kamui is made further down)
    platforms, colliders: shrine.colliders, obstacles: arenaObstacles, surfaceAt, toast, mana });
  encounters = createEncounters({ scene, camera, renderer, world, state, keys, player, quest, shrine, companion,
    // E at a Sky Garden gateway travels instead of petting.
    isInputActive: () => state.locked && !state.cinematic && !houndScene.active && !bosses.busy && !skyIsland.journey.atDoor(player.position) &&
      !world.heart.ownsArea(player.position) && !livingRoad.model.ownsArea(player.position) && !livingRoad.atInteraction(player.position),
    // NPCs keep out of landmarks and anything the player collides with (shrine tower, trees, rocks).
    blocked: (x, z) => world.isLandmarkArea(x, z) ||
      [shrine.colliders, ...Array.from(chunks.values(), chunk => chunk.userData.colliders)]
        .some(colliders => colliders.some(c => !c.off && c.minY === undefined && Math.hypot(x - c.x, z - c.z) < c.radius + 0.5)),
  });
  const chaosLook = createChaosLook();
  const chaosFog = new THREE.Color(0x2a0809);
  let swarmCast = null;
  function updateSwarm(dt) {
    const insideSwarmWorld = biomeAt(player.position.x, player.position.z).kind === "wisps";
    let mode = "roaming";
    // Near the exposed border-anchor ward, scattering becomes a directed strike through it.
    const strike = spade.campaign.strikeTarget(player.position, state.chaos);
    if (keys.has("KeyF")) mode = "recall";
    else if (keys.has("KeyQ") || pointerButtons.has(2)) mode = strike ? "strike" : "repel";
    else if (keys.has("KeyE") || pointerButtons.has(0)) mode = "attract";
    // Gathering the swarm calms the world; scattering it stirs chaos.
    if (insideSwarmWorld && mode === "attract") state.chaos -= 0.12 * dt;
    if (insideSwarmWorld && (mode === "repel" || mode === "strike")) state.chaos += 0.2 * dt;
    swarm.setEnabled(insideSwarmWorld, player.position);
    swarm.remembered = spade.campaign.lit; // one wisp remembers its name per lit memory lantern
    swarm.update(dt, player.position, camera, mode, state.chaos, strike);
    swarmCast = swarm.enabled && mode !== "roaming" ? swarm.target : null; // the character raises its arms at it
    state.swarmGesture = swarmCast ? (mode === 'attract' ? 'attract' : mode === 'recall' ? 'recall' : 'push') : null;
    swarmPanelEl.classList.toggle("active", insideSwarmWorld);
    swarmStatusEl.textContent = mode.toUpperCase();
  }

  // Screen warp is reserved for demo spawns (keys 1–5 and their buttons).
  const kamui = createKamui(renderer);
  // ?rift=0.6 previews the sky rift at a fixed openness (0–1) without playing the story to that point.
  const riftParam = new URLSearchParams(location.search).get('rift');
  const riftPreview = riftParam === null || !Number.isFinite(+riftParam) ? null : Math.min(1, Math.max(0, +riftParam));
  const pressed = new Set(); // edge detection for one-shot keys
  const tapped = code => { const down = keys.has(code), fresh = down && !pressed.has(code); if (down) pressed.add(code); else pressed.delete(code); return fresh; };
  function updateShortcuts() {
    if (tapped('KeyT')) toast(navigation.toggle() ? 'ROUTE ON' : 'ROUTE HIDDEN · ARROW STAYS', 2000);
    // In an arena G is the fight's own Chaos key (bossFights.js); out here it spends mana on a surge.
    if (tapped('KeyG') && state.locked && !state.cinematic && !state.interactionLock && !bosses.busy && !houndScene.active) {
      const why = mana.blocked(state.mode);
      if (why) toast(why, 1500);
      else { mana.surge(state.mode); state.chaos = MANA.surgeLevel; chaosLook.snap(); toast('CHAOS SURGE', 1500); }
    }
  }

  // Console handles for demos and report screenshots, e.g. dreamscape.kamui.pulse(), dreamscape.navigation.toggle().
  // player/movement allow e.g. dreamscape.movement.teleport({ x: -480, z: 0, top: 16.12 }) for screenshots.
  window.dreamscape = { camera, mana, motes, kamui, navigation, state, quest, clock: atmosphere.clock, spade, clover: livingRoad, startup, music, player, movement, inventory, character, companion, encounters, npcs };
  window.dreamscape.diamond = diamond; // Diamond chapter: e.g. dreamscape.diamond.model.relay.snapshotView()
  // Diamond's shots are laid out from its gate. The flyover and the power-up stream terrain along the camera.
  for (const [name, shot] of Object.entries(DIAMOND_SHOTS)) {
    const keys = shotKeys(world.diamond, shot).map(([t, a, b]) => [t, new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]);
    const along = t => { const i = Math.max(0, keys.findLastIndex(k => k[0] <= t)), a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
      return a[1].clone().lerp(b[1], b[0] > a[0] ? Math.min(1, (t - a[0]) / (b[0] - a[0])) : 0); };
    cloverScenes.define(`diamond-${name.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`, { ...shot, keys, focus: ['arrival', 'power'].includes(name) ? along : undefined });
  }
  let diamondArrived = false, diamondStage = diamond.model.stage;
  window.dreamscape.chainOrder = chainOrder; window.dreamscape.heartPast = heartPast; // e.g. dreamscape.scenes.queue('heart-past')
  // Heart's shots are laid out from its gate. The memory streams terrain between the town and the reef.
  for (const [name, shot] of Object.entries(HEART_SHOTS)) {
    const keys = heartShotKeys(heart.model.layout, shot).map(([t, a, b]) => [t, new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]);
    const middle = heart.model.layout.at(110, 0);
    cloverScenes.define(`heart-${name}`, { ...shot, keys, focus: name === 'past' ? () => middle : undefined });
  }
  window.dreamscape.scenes = cloverScenes; window.dreamscape.severing = severing; window.dreamscape.mark = mark; // e.g. dreamscape.scenes.queue('severing')
  window.dreamscape.pages = pages; // e.g. dreamscape.pages.queue(2) plays the Stone Wall page
  window.dreamscape.bosses = bosses; // e.g. dreamscape.bosses.queue('morcant')

  // Demo travel (keys 1-5): the tower, or 8 m in front of a kingdom gate facing in.
  createDemoSpawns({
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
    skyIsland.root, skyIsland.water, heavenly.root, heavenly.jet, heart.root, tidewell.root, ...gates.root.children].filter(Boolean);
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
  // Inside Spade castle: dim daylight, cold violet ambient and a dark haze, eased in at the doorway
  // (`indoors`, updated each frame before the atmosphere pass, which also dims sky reflections with it).
  // Runs after the atmosphere has set this frame's lights, so it never compounds.
  const CASTLE_GLOOM = { sun: 0.15, hemi: 0.4, exposure: 0.82, fog: 0.03 };
  const gloomFog = new THREE.Color(0x0b0816), gloomSky = new THREE.Color(0x3b2c66);
  let indoors = 0;
  function darkenCastle() {
    if (indoors < 0.01) return;
    sun.intensity *= THREE.MathUtils.lerp(1, CASTLE_GLOOM.sun, indoors);
    hemi.intensity *= THREE.MathUtils.lerp(1, CASTLE_GLOOM.hemi, indoors);
    hemi.color.lerp(gloomSky, indoors);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, CASTLE_GLOOM.exposure, indoors);
    scene.fog.color.lerp(gloomFog, indoors);
    scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, CASTLE_GLOOM.fog, indoors);
  }
  const resolution = createResolutionGovernor(renderer);
  // The opaque intro hides the world while it loads: draw those frames at half resolution so the GPU
  // spends its time on uploads, not pixels nobody sees. Full resolution returns at warmup.
  renderer.setPixelRatio(0.5);
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
      const fps = Math.round(fpsFrames / fpsTime); // top bar, Valorant style: green, amber under 50, red under 30
      ui.fpsEl.textContent = `${fps} FPS · ${(fpsTime / fpsFrames * 1000).toFixed(1)} MS`;
      ui.fpsEl.className = `perf${fps < 30 ? ' bad' : fps < 50 ? ' slow' : ''}`;
      fpsFrames = fpsTime = 0;
    }
    const playDt = houndScene.active ? 0 : dt;
    if (startup.ready) state.elapsed += playDt;
    // Terrain and props stream around the player, or around a cutscene's destination while it is away.
    const streamFocus = bosses.focus ?? cloverScenes.focus ?? player.position;
    updateChunks(streamFocus);
    world.updateTerrain(playDt);
    const inHeart = biomeAt(player.position.x, player.position.z).kind === 'crystals';
    heart.update(dt, player, state, inHeart, streamFocus);
    tidewell.update(dt, streamFocus);
    heartAir.update(dt, player.position, { chaos: state.chaos, restored: heart.model.sigil });
    if (!houndScene.active) skyIsland.update(dt, player, keys, state, target => movement.teleport(target));
    const moveBlocked = skyIsland.journey.blocked || houndScene.active;
    const moveDt = startup.ready ? dt : 0;
    // Heart's Tide Hook (hold Q at a floating crystal): while the rope holds the body, it replaces the controller.
    const hook = bosses.busy ? { owns: true } : !moveBlocked && moveDt && (inHeart || heart.grapple.phase !== 'idle')
      ? heart.step(moveDt, hookInput(), player, surfaceAt) : { owns: false };
    if (!moveBlocked && !hook.owns) movement.update(moveDt);
    if (bosses.busy) bosses.update(moveDt); // a boss arena runs the traveller's movement and combat itself
    mana.tick(state.cinematic || houndScene.active ? 0 : moveDt); // a cutscene (e.g. the Hound waking at the surge) pauses the hold
    // Motes appear only while the world is calm and nothing else owns play; touching one is always allowed.
    const roaming = state.locked && !state.cinematic && !bosses.busy && !houndScene.active && !doorScene.active && !cloverScenes.active &&
      !skyIsland.journey.blocked && !spade.isInsideCastle(player.position) && !diamondRow.isInsideHall(player.position);
    const moteMana = motes.update(moveDt, player.position, roaming && state.mode === 'calm');
    if (moteMana) { mana.add(moteMana); toast(`MANA +${Math.round(moteMana * 100)}%`, 1200); }
    moteView.update(dt, state.elapsed, motes.motes, player, moteMana > 0);
    questStep('lanterns', spade.campaign.lit);
    questStep('fragments', diamond.model.fitted);
    questStep('arches', spade.echo.progress);
    if (mana.holding && !bosses.busy) state.chaos = Math.max(state.chaos, MANA.surgeLevel); // the surge's hold; then movement decides
    props.update(streamFocus, world.terrainVersion);
    if (!houndScene.active) quest.update();
    if (!unlockAll || testStart?.id === 'ember-hound') houndScene.observe(quest.stage, startup.ready && state.locked && !state.mapOpen &&
      !skyIsland.journey.blocked && player.grounded);
    if (!bosses.busy) companion.update(dt, dt => encounters.updateDog(dt, state.elapsed), houndScene.presentation); // the dog never follows into an arena
    if (!houndScene.active) quest.updateHoundEmber(companion.position);
    kingdomBorder.update(playDt);
    gates.update(playDt);
    if (!houndScene.active) spade.update(dt, player, state, swarm);
    if (!houndScene.active) diamond.update(dt, player, state); // Diamond chapter
    diamondQuarry.update(dt, state.chaos);
    diamondKingdom.update(dt, state.chaos);
    diamondRoyal.update(dt, state.chaos);
    diamondDustward.update(dt, state.chaos, player);
    diamondStockade.update(dt, state.chaos, ['report', 'complete'].includes(diamond.model.stage), player);
    if (!houndScene.active) diamondRow.update(dt, player);
    diamondSiege.update(dt, state.chaos, player);
    // Diamond's story shots: the flyover the first time past the gate, the power-up when the relay runs.
    if (!diamondArrived && world.diamond.area(player.position.x, player.position.z) && world.diamond.local(player.position.x, player.position.z).u > 4) {
      diamondArrived = true; cloverScenes.queue('diamond-arrival');
    }
    if (diamond.model.stage !== diamondStage) { diamondStage = diamond.model.stage; if (diamondStage === 'report') cloverScenes.queue('diamond-power'); }
    livingRoad.update(dt, player, state, startup.ready && !houndScene.active && !doorScene.active && !skyIsland.journey.blocked); // Clover chapter (cutscenes pause its input via state.cinematic)
    heavenly.update(dt, player.position);
    if (!state.cinematic) { // flashbacks stage their own cast
      npcs.setHidden('Nim', !heart.model.available);
      for (const f of homecomers) npcs.setHidden(f.name, !heart.model.sigil); // they come home with the water
    }
    world.setHeartCrater(heart.model.craterOpen && !heartPast.playing); // opens at the quake's dust burst; closed in the past (the memory) and on reset
    npcs.update(dt);
    shrine.update(dt, state.elapsed);
    waterfall.update(dt, player.position);
    ridge.update(player.position);
    wayfinding.update();
    plaza.update();
    towerPlaza.update(dt, state.chaos, world.terrainVersion, player.position);
    clover.update(player.position, dt);
    doorScene.observe(!houndScene.active && state.locked && !state.mapOpen && !skyIsland.journey.blocked && player.grounded);
    cloverScenes.observe(!houndScene.active && !doorScene.active && state.locked && !state.mapOpen && !skyIsland.journey.blocked && player.grounded);
    // A page reveal waits for every story scene (and any queued after it) and any chest reveal to finish.
    pages.observe(!spade.reachAt && !livingRoad.reachAt && !houndScene.active && !doorScene.active && !cloverScenes.active && !cloverScenes.pending && state.locked && !state.mapOpen && !skyIsland.journey.blocked && player.grounded);
    pages.update(dt);
    // A boss fight opens once its page has been read and nothing else owns the camera.
    bosses.observe(!pages.active && !pages.pending && !houndScene.active && !doorScene.active && !cloverScenes.active && !cloverScenes.pending && state.locked && !state.mapOpen && !skyIsland.journey.blocked && player.grounded);
    let cameraDistance;
    if (pages.active) cameraDistance = camera.position.distanceTo(player.position); // as in the movement lab: the traveller stays drawn until the book's camera passes through him
    else if (houndScene.active) cameraDistance = houndScene.update(dt);
    else if (doorScene.active) cameraDistance = doorScene.update(dt);
    else if (cloverScenes.active) cameraDistance = cloverScenes.update(dt);
    else if (skyIsland.journey.blocked) cameraDistance = skyIsland.updateTravelCamera(camera, player);
    else if (bosses.focus) cameraDistance = bosses.camera(dt); // in a boss arena
    else { skyIsland.restoreTravelCamera(camera); cameraDistance = viewCamera.update(dt); }
    // A chest reveal (Spade's archive, Clover's sky chest): both hands reach for the rising item.
    const reach = spade.reachAt ?? livingRoad.reachAt;
    if (reach) state.swarmGesture = 'grab';
    const rope = heart.grapple;
    character.update(dt, cameraDistance, houndScene.active ? null : bosses.castAt ?? reach ?? swarmCast, bosses.shown,
      bosses.rope ?? { anchor: rope.anchor, reach: rope.reach, phase: rope.phase, flip: rope.flip });
    navigation.update(dt, houndScene.active); // after the camera, so the arrow matches this frame's view
    worldMap.update();
    if (startup.ready) help.update(dt);
    cullLandmarks();
    updateHUD(ui, state, player, biomeAt);
    updateQuestHUD(ui, quest);
    encounters.update(dt, state.elapsed);
    if (!houndScene.active && !bosses.busy) updateSwarm(dt);
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
    indoors += ((!doorScene.active && (spade.isInsideCastle(player.position) || diamondRow.isInsideHall(player.position)) ? 1 : 0) - indoors) * (1 - Math.exp(-3 * dt));
    atmosphere.finish(dt, chaosScore, camera, { rift: riftPreview ?? riftOpenness(quest, spade), indoors, heartRestored: heart.model.sigil });
    bosses.render(dt, performance.now()); // after the atmosphere: an arena paints its own void, fog and light
    darkenCastle();
    updateShortcuts();
    updateSeal({ chaos: state.chaos, mode: state.mode, mana: mana.value, hold: mana.holdLeft, holdMax: MANA.hold, ready: !mana.blocked(state.mode) });
    music.update(dt);
    lamps.update(camera.position);
    kamui.render(scene, camera, dt);
    memory.apply(dt); // flashback memory look over the rendered frame (off unless a flashback plays)
    if (!startup.ready) {
      const phase = startup.update({ now: performance.now(), frameMs: rawDt * 1000,
        prepared: !world.pendingChunks && props.prepared });
      if (phase === 'warmup') {
        // All startup assets are now installed: at full resolution, draw every object once (hidden ones
        // too) and run the Kamui warp once, behind the intro, then wait for real render/upload frames.
        renderer.setPixelRatio(resolution.ratio);
        warmEverything(renderer, scene, camera);
        kamui.warm();
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
  // Developer only: ?scene=<id> plays one cutscene or flashback once the world is ready (the movement lab's showcase
  // links here). Queued after the first reset(), which clears the scene queue.
  const sceneParam = new URLSearchParams(location.search).get('scene');
  if (sceneParam === 'hound-wake') quest.debugStage('cursed');      // the curse wakes the hound
  else if (sceneParam === 'hound-cure') quest.debugStage('cured');  // the cure, then the memory, the keeper's lead and page I
  else if (sceneParam === 'door') doorScene.queue(0);               // Spade's castle doors
  else if (/^page-[0-4]$/.test(sceneParam ?? '')) pages.queue(Number(sceneParam.slice(5)));
  else if (sceneParam === 'morcant' || sceneParam === 'sile') bosses.queue(sceneParam); // a boss fight, straight away
  else if (sceneParam) {
    cloverScenes.queue(sceneParam);
    const page = { mark: 0, sigil: 2, 'diamond-lead': 4 }[sceneParam]; // the page each of these scenes leads into in the campaign
    if (page !== undefined) pages.queue(page);
  }
  // Not frame(): the first render compiles the world's shaders (~5 s), so give the model queue its frame first
  // to get downloads going underneath that.
  requestAnimationFrame(frame);
}
