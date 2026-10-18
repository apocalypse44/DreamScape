// Encounters: ember shards, the dog's moods (pet / sit / bark / howl / fetch) and the lore NPCs.
// game.js calls update() each frame; companion.js calls updateDog(); the quest calls the ember hooks.
import { makeRng, subSeed } from '../models/rng.js';
import { SHRINE } from '../models/quest.js';
import { NPC_ASSETS, NPC_HEIGHT, HINTS, PET_DISTANCE, PET_TIME, PET_CHAOS_DROP, CHAOS_CALM } from '../models/encounterConfig.js';
import { loadModel } from '../rendering/models.js';
import { unlockAudio } from '../rendering/fx.js';
import { EmberSystem } from '../rendering/embers.js';
import { DogBrain } from '../rendering/dog.js';
import { People, findCrossingHomes } from '../rendering/people.js';
import { showPrompt, hidePrompt, toast } from '../views/overlay.js';

// blocked(x, z): true where NPCs must not stand or walk (landmarks, shrine, props).
// isInputActive(): the game has the pointer and E is not taken by something else (Sky Garden gateway).
export function createEncounters({ scene, camera, renderer, world, state, keys, player, quest, shrine, companion, blocked, isInputActive }) {
  const addChaos = (d) => { state.chaos = THREE.MathUtils.clamp(state.chaos + d, 0.025, 0.98); };
  const embers = new EmberSystem(scene);
  const dog = companion.dogHandle;
  const dogBrain = new DogBrain({ scene, dog, rng: makeRng(subSeed(world.seed, 101)), terrainHeight: world.terrainHeight, addChaos });
  let people = null;
  let assets = null; // loaded once, reused on reset
  const promptPos = new THREE.Vector3();

  // The dog's moods only tell apart before, during (cursed + return) and after the curse.
  const stage = () => (quest.stage === 'cursed' || quest.stage === 'return' ? 'cursed'
    : quest.stage === 'cured' ? 'cured' : 'dog');
  const feetAboveGround = () => player.position.y - 2.05 - world.terrainHeight(player.position.x, player.position.z);

  function spawnPeople() {
    people?.dispose();
    people = new People({ scene, assets, terrainHeight: world.terrainHeight, seed: world.seed, blocked });
    // Keeper just outside the shrine tower (east side), facing outward.
    let offset = 3.5;
    while (offset < 12 && blocked(SHRINE.x + offset, SHRINE.z)) offset += 0.5;
    const x = SHRINE.x + offset;
    people.spawnKeeper(new THREE.Vector3(x, world.terrainHeight(x, SHRINE.z), SHRINE.z), () => quest.shrineText, Math.PI / 2);
    people.spawnWanderers(findCrossingHomes(makeRng(subSeed(world.seed, 202)), world.terrainHeight, Object.keys(HINTS), blocked), HINTS);
  }

  // NPCs appear once their models load; a missing file falls back to procedural bodies.
  const tryLoad = (url) => loadModel(url, NPC_HEIGHT).catch((error) => {
    console.warn('Could not load NPC asset', url, error);
    return null;
  });
  Promise.all([tryLoad(NPC_ASSETS.mannequin), tryLoad(NPC_ASSETS.ual1), tryLoad(NPC_ASSETS.ual2)])
    .then(([mannequin, ual1, ual2]) => { assets = { mannequin, ual1, ual2 }; spawnPeople(); });

  function canPet() {
    if (stage() === 'cursed' || state.chaos >= CHAOS_CALM) return false;
    if (world.biomeAt(player.position.x, player.position.z).kind === 'wisps') return false; // E belongs to the swarm there
    const at = dog.object.position;
    return Math.hypot(at.x - player.position.x, at.z - player.position.z) < PET_DISTANCE;
  }

  window.addEventListener('keydown', (event) => {
    unlockAudio(); // browsers only allow audio after a key press
    if (event.code !== 'KeyE' || event.repeat || !isInputActive() || !canPet()) return;
    if (dogBrain.tryPet(player.position)) {
      state.interactionLock = PET_TIME;
      addChaos(PET_CHAOS_DROP);
    }
  });

  return {
    get keeper() { return people?.keeper ?? null; },
    update(dt, t) {
      embers.setWorldVisible(stage() === 'cursed');
      embers.update(dt, t, player.position, state.chaos);
      people?.update(dt, { playerPos: player.position, sprinting: keys.has('ShiftLeft') || keys.has('ShiftRight'), chaos: state.chaos, camera, renderer,
        cinematic: state.cinematic, speaker: state.cinematicSpeaker });
      if (isInputActive() && canPet() && dogBrain.state !== 'pet') {
        promptPos.copy(dog.object.position);
        promptPos.y += 1.4;
        showPrompt('E · PET', promptPos, camera, renderer);
      } else {
        hidePrompt();
      }
    },

    // Called by companion.js after it moves the dog. True when a mood controls the dog this frame.
    updateDog(dt, t) {
      const elevated = feetAboveGround() > 1.5;
      return dogBrain.update(dt, t, {
        playerPos: player.position,
        sprinting: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        crouching: state.crouching,
        elevated,
        // Only the ember slab climb is a course; Clover terraces and the Sky Garden are also elevated.
        onCourse: elevated && quest.platforms.some(slab => Math.hypot(player.position.x - slab.x, player.position.z - slab.z) < 4),
        stage: stage(),
        nextEmberPos: quest.nextEmber(),
      });
    },

    pickupEmber(i, count, total) {
      embers.pickup(i);
      toast(`EMBER ${count}/${total}`);
    },
    setEmberPosition(i, pos) { embers.setEmberPosition(i, new THREE.Vector3(pos.x, pos.y, pos.z)); },
    startOffering(onDone) { embers.startOffering(shrine.crystalWorldPosition, onDone); },

    // R: rebuild everything from the seed. Call after quest.reset() so embers are back at their start.
    reset() {
      hidePrompt();
      embers.setEmbers(quest.embers.map(({ x, y, z }) => new THREE.Vector3(x, y, z)));
      dogBrain.reset(makeRng(subSeed(world.seed, 101)));
      if (assets) spawnPeople(); // before assets load, loading spawns them once
    },
  };
}
