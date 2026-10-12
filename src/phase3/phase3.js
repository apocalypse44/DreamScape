// ---------------------------------------------------------------------------
// phase3.js: the ONE entry point for all Phase 3 work.
//
//   game.js       : Phase3.init(ctx)  /  Phase3.update(dt, t)  /  Phase3.reset(seed)
//                   Phase3.applyCameraShake(camera, dt)  (after the camera moves)
//   companion.js  : if (Phase3.updateDog(dt, t)) return;
//   quest.js      : Phase3.setEmbers(positions), Phase3.pickupEmber(i, count, total),
//                   Phase3.startOffering(onDone), Phase3.setEmberPosition(i, pos)
//
// ctx (what game.js passes in; adapt each line to your real names):
// {
//   scene, camera, renderer, seed,
//   getPlayer:  () => ({ position: Vector3 at eye height, sprinting: bool, crouching: bool }),
//   getChaos:   () => number,
//   addChaos:   (delta) => void,          // agree with Phase 4 (e.g. state.chaosImpulse)
//   terrainHeight: (x, z) => number,
//   biomeAt:    (x, z) => string,
//   questStage: () => 'dog' | 'cursed' | 'cured',   // map your stage names
//   nextEmberPos: () => Vector3 | null,             // where the cursed dog is heading
//   shrinePos:  Vector3,                            // keeper stands near this
//   shrineTarget: Vector3,                          // crystal the embers fly into
//   shrineLine: () => string,                       // keeper's line for the current stage
//   dog: { object, mixer, clips, play?, onRelease? },
//   character: { playCrouch?: () => void, lockMovement?: (seconds) => void },
// }
// ---------------------------------------------------------------------------
import { THREE, GLTFLoader } from './deps.js';
import { makeRng, subSeed } from './rng.js';
import { events } from './events.js';
import { loadGLTF } from './anim.js';
import { applyCameraShake, unlockAudio } from './fx.js';
import { initHud, showPrompt, hidePrompt, toast } from './hud.js';
import { EmberSystem, makeCrystalTemplate } from './embers.js';
import { DogBrain } from './dog.js';
import { People, findCrossingHomes } from './people.js';
import {
  ASSETS, BIOMES, HINTS, SWARM_BIOME, PET_DISTANCE, PET_TIME, PET_CHAOS_DROP, CHAOS_CALM,
} from './config.js';

let ctx = null;
let seed = 1;
let embers = null;
let dogBrain = null;
let people = null;
let assets = null;          // loaded once, reused on reset
let lastEmberPositions = [];
let ready = false;
let dogControlled = false;
const promptPos = new THREE.Vector3();

export const Phase3 = {
  events,
  applyCameraShake,

  async init(c) {
    ctx = c;
    seed = c.seed ?? 1;
    initHud();
    window.addEventListener('keydown', onKey);

    // ---- load assets (embers work immediately; NPCs appear once loaded)
    const loader = new GLTFLoader();
    const tryLoad = (url) => (url ? loadGLTF(loader, url).catch((e) => {
      console.warn('[phase3] could not load', url, e);
      return null;
    }) : Promise.resolve(null));

    embers = new EmberSystem({ scene: ctx.scene });
    if (ctx.dog?.object) {
      dogBrain = new DogBrain({
        scene: ctx.scene, dog: ctx.dog, rng: makeRng(subSeed(seed, 101)),
        terrainHeight: ctx.terrainHeight, addChaos: ctx.addChaos,
      });
    }
    ready = true;

    const [mannequin, ual1, ual2, crystal] = await Promise.all([
      tryLoad(ASSETS.mannequin), tryLoad(ASSETS.ual1), tryLoad(ASSETS.ual2), tryLoad(ASSETS.crystal),
    ]);
    assets = { mannequin, ual1, ual2, crystal };

    if (crystal) {
      embers.template = makeCrystalTemplate(crystal.scene);
      if (lastEmberPositions.length) embers.setEmbers(lastEmberPositions); // rebuild with the model
    }
    spawnPeople();
  },

  // Call every frame from game.js, after the player has moved.
  update(dt, t) {
    if (!ready) return;
    const pl = ctx.getPlayer();
    const chaos = ctx.getChaos();
    embers.setWorldVisible(ctx.questStage() === 'cursed');
    embers.update(dt, t, pl.position, chaos);
    people?.update(dt, {
      playerPos: pl.position, sprinting: pl.sprinting, chaos,
      camera: ctx.camera, renderer: ctx.renderer,
    });
    updatePetPrompt(pl, chaos);
  },

  // Call from companion.js at the top of the dog update, AFTER mixer.update(dt).
  // Returns true when Phase 3 is controlling the dog this frame (skip your movement).
  updateDog(dt, t = performance.now() / 1000) {
    if (!ready || !dogBrain) return false;
    const pl = ctx.getPlayer();
    dogControlled = dogBrain.update(dt, t, {
      playerPos: pl.position,
      sprinting: pl.sprinting,
      crouching: pl.crouching,
      onCourse: pl.position.y - 2.05 - ctx.terrainHeight(pl.position.x, pl.position.z) > 1.5,
      stage: ctx.questStage(),
      nextEmberPos: ctx.nextEmberPos?.() ?? null,
    });
    return dogControlled;
  },

  // ---- quest.js hooks
  setEmbers(positions) {
    lastEmberPositions = positions.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    embers?.setEmbers(lastEmberPositions);
  },
  setEmberPosition(i, pos) {
    embers?.setEmberPosition(i, new THREE.Vector3(pos.x, pos.y, pos.z));
  },
  pickupEmber(i, count, total) {
    embers?.pickup(i, count, total);
    events.emit('ember:pickup', { index: i, count, total });
  },
  startOffering(onDone) {
    const target = typeof ctx.shrineTarget === 'function' ? ctx.shrineTarget() : ctx.shrineTarget;
    embers?.startOffering(target, () => {
      events.emit('ember:offered');
      onDone?.();
    });
  },
  get carriedCount() { return embers ? embers.carriedCount : 0; },

  // ---- R reset: rebuild everything from the seed
  reset(newSeed = seed) {
    seed = newSeed;
    hidePrompt();
    embers?.setEmbers(lastEmberPositions);
    dogBrain?.reset(makeRng(subSeed(seed, 101)));
    spawnPeople();
  },

  toast,
};

function spawnPeople() {
  people?.dispose();
  people = new People({ scene: ctx.scene, assets, terrainHeight: ctx.terrainHeight, seed });
  // keeper 3.5 m beside the shrine, facing outward
  const s = ctx.shrinePos;
  const kp = new THREE.Vector3(s.x + 3.5, 0, s.z);
  kp.y = ctx.terrainHeight(kp.x, kp.z);
  people.spawnKeeper(kp, ctx.shrineLine, Math.PI / 2);
  const homes = findCrossingHomes(makeRng(subSeed(seed, 202)), ctx.terrainHeight, BIOMES);
  people.spawnWanderers(homes, HINTS);
}

function canPet(pl, chaos) {
  if (!dogBrain || ctx.questStage() === 'cursed') return false;
  if (chaos >= CHAOS_CALM) return false;
  if (ctx.biomeAt(pl.position.x, pl.position.z) === SWARM_BIOME) return false;
  const dogPos = ctx.dog.object.position;
  return Math.hypot(dogPos.x - pl.position.x, dogPos.z - pl.position.z) < PET_DISTANCE;
}

function updatePetPrompt(pl, chaos) {
  if (ctx.isInputActive?.() && canPet(pl, chaos) && dogBrain.state !== 'pet') {
    promptPos.copy(ctx.dog.object.position);
    promptPos.y += 1.4;
    showPrompt('E · PET', promptPos, ctx.camera, ctx.renderer);
  } else {
    hidePrompt();
  }
}

function onKey(e) {
  unlockAudio();
  if (e.code !== 'KeyE' || !ready || e.repeat || !ctx.isInputActive?.()) return;
  const pl = ctx.getPlayer();
  if (!canPet(pl, ctx.getChaos())) return; // in Violet Mist this falls through to the swarm
  if (dogBrain.tryPet(pl.position)) {
    ctx.character?.playCrouch?.();
    ctx.character?.lockMovement?.(PET_TIME);
    ctx.addChaos?.(PET_CHAOS_DROP);
    events.emit('dog:pet');
  }
}
