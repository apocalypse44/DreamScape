// The Ember Hound: chaos curses the dog, embers on chaos-only peaks cure it at the shrine.
import { EMBER_DEFS, houndEmberRule } from '../phase3/challenges.js';

export const SHRINE = { x: 0, z: -11 }; // straight ahead of the spawn point, inside talk range
const EMBERS = 3;
const TALK_RADIUS = 14;
const OFFER_RADIUS = 8;
const PEAK_CHAOS = 0.88; // a sustained sprint settles near this score
const CALM_CHAOS = 0.06;

const SHRINE_LINES = {
  companion: 'Your companion fears the wild. Walk gently and the world stays soft. Run wild and the hound will be lost to the flames. If that happens, follow it, gather three embers, and bring them to me.',
  cursed: 'The hound burns. It runs to the embers it scattered. They rest on peaks that rise only in chaos. Stay wild to reach them. One burns high above. Climb to it.',
  return: 'You carry the embers. Be still, and offer them here.',
  cured: 'The hound is free. The flames will not take it again. The four kingdoms wait beyond the tower.'
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
    challenge: EMBER_DEFS[index].type,
  }));
}

// Parkour: the strongest ember is lifted onto a spiral of floating slabs around its peak.
// Each slab sits STEP_RISE above the last (jump apex is ~2.2 m), so the climb is always possible.
const STEPS = 9;
const STEP_RISE = 1.6;
const SPIRAL_RADIUS = 6;
export const SLAB_SIZE = 3;
function raiseEmber(world, ember) {
  const platforms = [];
  let top = -Infinity;
  for (let i = 0; i < STEPS; i++) {
    const angle = i * 1.2;
    const x = ember.x + Math.cos(angle) * SPIRAL_RADIUS;
    const z = ember.z + Math.sin(angle) * SPIRAL_RADIUS;
    top = Math.max(world.heightAt(x, z, PEAK_CHAOS), top) + STEP_RISE;
    platforms.push({ x, z, top });
  }
  const last = platforms[STEPS - 1];
  Object.assign(ember, { x: last.x, z: last.z, y: last.top + 1.2 });
  return platforms;
}

export function createQuest({ world, state, player, onEmberPickup, onEmberPosition, onOfferEmbers }) {
  const embers = placeEmbers(world);
  const platforms = raiseEmber(world, embers[0]);
  const emberStartPositions = embers.map(({ x, y, z }) => ({ x, y, z }));
  let stage = 'companion';
  let offering = false;
  let houndCarrying = false;
  const quest = {
    embers,
    platforms,
    get stage() { return stage; },
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

      if (stage === 'companion' && !calm) {
        stage = 'cursed';
        houndCarrying = true;
      }
      if (stage === 'cursed') {
        for (const [i, ember] of embers.entries()) {
          if (ember.taken) continue;
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
        cursed: `EMBERS ${taken}/${EMBERS} · FOLLOW THE HOUND · STAY WILD`,
        return: 'RETURN TO THE SHRINE · BE STILL',
        cured: 'THE HOUND IS SAVED'
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
      ember.y = houndPosition.y + 1.3;
      ember.z = houndPosition.z;
      onEmberPosition?.(index, ember);
      const rule = houndEmberRule(player.position, houndPosition, state.chaos);
      if (rule === 'drop') houndCarrying = false;
    },

    // The shrine beam shows which mode the current step needs.
    wantsChaos() { return stage === 'cursed'; },

    reset() {
      stage = 'companion';
      offering = false;
      houndCarrying = false;
      embers.forEach((ember, index) => {
        Object.assign(ember, emberStartPositions[index], { taken: false });
      });
      quest.update();
    }
  };
  return quest;
}
