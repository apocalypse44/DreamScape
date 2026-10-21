// The Ember Hound: chaos curses the dog, embers on chaos-only peaks cure it at the shrine.
import { CHAOS_CALM } from './encounterConfig.js';
import { echoContains } from './castleEcho.js';

export const SHRINE = { x: 0, z: -11 }; // straight ahead of the spawn point, inside talk range
// One challenge per ember: the parkour spiral, a chaos-only peak, and the one the hound carries.
const CHALLENGES = ['course', 'chasm', 'hound'];
const EMBERS = CHALLENGES.length;
const TALK_RADIUS = 14;
const OFFER_RADIUS = 8;
const PEAK_CHAOS = 0.88; // a sustained sprint settles near this score
const CALM_CHAOS = 0.06;

const SHRINE_LINES = {
  companion: 'Your companion fears the wild. Walk gently and the world stays soft. Run wild and the hound will be lost to the flames. If that happens, follow it, gather three embers, and bring them to me.',
  cursed: 'The hound burns. It runs to the embers it scattered. They rest on peaks that rise only in chaos. Stay wild to reach them. One burns high above. Climb to it.',
  return: 'You carry the embers. Be still, and offer them here.',
  cured: 'The hound is free. Travel west to Spade and find Neris at the Lantern Refuge, the first house on your right beyond the gate. She shelters those whose memories the Triad stole.'
};
const DROWNED = 'The shrine\'s voice is lost in the noise. Be still to hear it.';

// Embers go where the ground rises most between calm and chaos, so calm leaves them out of reach.
function placeEmbers(world) {
  const candidates = [];
  for (let i = 0; i < 500; i++) {
    const angle = world.hash(i, 911) * Math.PI * 2;
    const radius = 45 + world.hash(913, i) * 70;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (world.isLandmarkArea?.(x, z)) continue;
    const peak = world.heightAt(x, z, PEAK_CHAOS);
    candidates.push({ x, z, peak, gain: peak - world.heightAt(x, z, CALM_CHAOS) });
  }
  candidates.sort((a, b) => b.gain - a.gain);
  const picked = [];
  for (const candidate of candidates) {
    if (picked.length === EMBERS) break;
    if (picked.every(other => Math.hypot(other.x - candidate.x, other.z - candidate.z) > 30)) picked.push(candidate);
  }
  return picked.map(({ x, z, peak, gain }, index) => ({
    x, y: peak + 1.2, z, gain, taken: false,
    challenge: CHALLENGES[index],
  }));
}

// The hound drops its ember for a calm player within 4 m (forgiving: it stands still for them).
function houndDrops(playerPos, houndPos, chaos) {
  return chaos < CHAOS_CALM && Math.hypot(playerPos.x - houndPos.x, playerPos.z - houndPos.z) < 4;
}

// Parkour: the strongest ember is lifted onto a spiral of floating slabs around its peak.
// Each slab sits STEP_RISE above the last (jump apex is ~2.2 m), so the climb is always possible.
// The slabs are basalt shards torn up by the curse: chaos-only, like the castle echo's fragments.
const STEPS = 9;
const STEP_RISE = 1.6;
const SPIRAL_RADIUS = 6;
export const SLAB_SIZE = 3;
// Seven-sided outline, 1.55–1.85 m to each corner: always convex (each corner clears the chord between its
// neighbours), every edge ≥ 1.39 m from the centre (a 2.75 m landing, close to the old 3 m square), and gaps
// between shards stay ≥ 3 m. The same outline drives rock and collision.
function shardOutline(world, i) {
  const turn = world.hash(i, 401) * .6;
  return Array.from({ length: 7 }, (_, k) => {
    const a = k / 7 * Math.PI * 2 + turn, r = 1.55 + world.hash(i * 7 + k, 557) * .3;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}
function raiseEmber(world, ember, isActive) {
  const platforms = [];
  let top = -Infinity;
  for (let i = 0; i < STEPS; i++) {
    const angle = i * 1.2;
    const x = ember.x + Math.cos(angle) * SPIRAL_RADIUS;
    const z = ember.z + Math.sin(angle) * SPIRAL_RADIUS;
    top = Math.max(world.heightAt(x, z, PEAK_CHAOS), top) + STEP_RISE;
    const slab = { x, z, top, outline: shardOutline(world, i) };
    slab.contains = (px, pz, pad = 0) => isActive() && echoContains(slab, px, pz, pad);
    platforms.push(slab);
  }
  const last = platforms[STEPS - 1];
  Object.assign(ember, { x: last.x, z: last.z, y: last.top + 1.2 });
  return platforms;
}

export function createQuest({ world, state, player, onEmberPickup, onEmberPosition, onOfferEmbers, onHoundDrop }) {
  const embers = placeEmbers(world);
  let courseActive = false, courseEngaged = false;
  const courseCentre = { x: embers[0].x, z: embers[0].z };
  const platforms = raiseEmber(world, embers[0], () => courseActive);
  const emberStartPositions = embers.map(({ x, y, z }) => ({ x, y, z }));
  let stage = 'companion';
  let offering = false;
  let houndCarrying = false;
  let houndDistance = Infinity; // player to hound, for the HUD hint
  const quest = {
    embers,
    platforms,
    get stage() { return stage; },
    get courseActive() { return courseActive; },
    restless: false,
    nearShrine: false,
    drowned: false,
    shrineText: '',
    goal: '',

    update() {
      // Two thresholds, so hovering around one value never flips the mode back and forth.
      if (state.mode !== 'chaos' && state.chaos > 0.65) state.mode = 'chaos';
      else if (state.mode === 'chaos' && state.chaos < 0.4) state.mode = 'calm';
      const calm = state.mode === 'calm';
      quest.restless = stage === 'companion' && calm && state.chaos > 0.5;

      // The parkour course exists only in chaos. Once the player is on it (or jumping between shards) it stays
      // until they are back on solid ground, so calming mid-climb never drops them (as with the castle echo).
      const feet = player.position.y - 2.05;
      const onShard = platforms.some(s => Math.abs(feet - s.top) < .3 && echoContains(s, player.position.x, player.position.z, .55));
      const nearCourse = Math.hypot(player.position.x - courseCentre.x, player.position.z - courseCentre.z) < SPIRAL_RADIUS + SLAB_SIZE;
      if (courseActive && (onShard || (!player.grounded && nearCourse))) courseEngaged = true;
      if (courseEngaged && player.grounded && !onShard) courseEngaged = false;
      courseActive = !calm || courseEngaged;

      if (stage === 'companion' && !calm) {
        stage = 'cursed';
        houndCarrying = true;
      }
      if (stage === 'cursed') {
        for (const [i, ember] of embers.entries()) {
          // The hound's ember is only takeable once it is dropped for a calm approach.
          if (ember.taken || (ember.challenge === 'hound' && houndCarrying)) continue;
          // Player position is eye height (feet + 2.05); embers float 1.2 above the chaos peak.
          const reach = Math.hypot(player.position.x - ember.x, player.position.z - ember.z) < 2.2 &&
            Math.abs(player.position.y - 1 - ember.y) < 2.5;
          if (reach) {
            ember.taken = true;
            onEmberPickup?.(i, embers.filter(item => item.taken).length, EMBERS);
          }
        }
        if (embers.every(ember => ember.taken)) stage = 'return';
      }
      const shrineDistance = Math.hypot(player.position.x - SHRINE.x, player.position.z - SHRINE.z);
      if (stage === 'return' && calm && shrineDistance < OFFER_RADIUS && !offering) {
        if (onOfferEmbers) {
          offering = true;
          onOfferEmbers(() => {
            if (stage !== 'return') return;
            offering = false;
            stage = 'cured';
            quest.update();
          });
        } else {
          stage = 'cured';
        }
      }

      quest.nearShrine = shrineDistance < TALK_RADIUS;
      quest.drowned = !calm; // the shrine only speaks to a calm player
      quest.shrineText = calm ? SHRINE_LINES[stage] : DROWNED;
      const taken = embers.filter(ember => ember.taken).length;
      quest.goal = {
        companion: quest.restless ? 'THE HOUND GROWS RESTLESS…' : 'EXPLORE WITH YOUR COMPANION',
        // The hound only drops its ember for a calm approach, so say so when the player is near it.
        cursed: houndCarrying && (houndDistance < 25 || embers.every(e => e.taken || e.challenge === 'hound'))
          ? `EMBERS ${taken}/${EMBERS} · THE HOUND HOLDS ONE · CALM DOWN AND WALK UP TO IT`
          : `EMBERS ${taken}/${EMBERS} · FOLLOW THE HOUND · STAY WILD`,
        return: 'RETURN TO THE SHRINE · BE STILL',
        cured: 'NEXT · SPADE KINGDOM · FIND NERIS AT LANTERN REFUGE'
      }[stage];
    },

    // Where the cursed hound runs: the nearest ember still waiting.
    nextEmber() {
      let best = null;
      for (const ember of embers) {
        if (ember.taken || (ember.challenge === 'hound' && houndCarrying)) continue;
        if (!best || Math.hypot(ember.x - player.position.x, ember.z - player.position.z) <
            Math.hypot(best.x - player.position.x, best.z - player.position.z)) best = ember;
      }
      return best;
    },

    get houndCarrying() { return houndCarrying; },

    updateHoundEmber(houndPosition) {
      if (!houndCarrying || stage !== 'cursed') return;
      const index = embers.findIndex(ember => ember.challenge === 'hound');
      const ember = embers[index];
      if (!ember || ember.taken) {
        houndCarrying = false;
        return;
      }
      ember.x = houndPosition.x;
      ember.y = houndPosition.y + 1.8; // just above the wolf's back, not inside its body
      ember.z = houndPosition.z;
      onEmberPosition?.(index, ember);
      houndDistance = Math.hypot(player.position.x - houndPosition.x, player.position.z - houndPosition.z);
      if (houndDrops(player.position, houndPosition, state.chaos)) {
        houndCarrying = false;
        onHoundDrop?.();
      }
    },

    // The shrine beam shows which mode the current step needs.
    wantsChaos() { return stage === 'cursed'; },

    reset() {
      stage = 'companion';
      offering = false;
      courseActive = courseEngaged = false;
      houndCarrying = false;
      houndDistance = Infinity;
      embers.forEach((ember, index) => {
        Object.assign(ember, emberStartPositions[index], { taken: false });
      });
      quest.update();
    }
  };
  return quest;
}
