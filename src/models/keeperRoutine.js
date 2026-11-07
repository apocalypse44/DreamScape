// The Shrine Keeper's routine when nothing else needs her (people.js handles talking, cutscenes
// and chaos first). Pure: no Three.js. Modes:
//   home     standing at her post, watching the player when near
//   toSpot   walking to a candle spot around the shrine
//   tend     kneeling there, tending the candle
//   toHome   walking back to her post
//   pet      kneeling to greet the companion dog
export const KEEPER_POSE = {
  home: { clip: 'Idle_Loop', look: 'player', walk: false },
  toSpot: { clip: 'Walk_Loop', look: null, walk: true },
  tend: { clip: 'Fixing_Kneeling', look: null, walk: false, expression: 'smile' },
  toHome: { clip: 'Walk_Loop', look: null, walk: true },
  pet: { clip: 'Fixing_Kneeling', look: 'dog', walk: false, expression: 'joy' },
};

export function createKeeperRoutine({ spots = 0, random = Math.random } = {}) {
  let mode = 'home', timer = 12 + random() * 6, spot = -1, petCooldown = 6;
  const go = (next, seconds = 0) => { mode = next; timer = seconds; };
  return {
    get mode() { return mode; }, get spot() { return spot; },
    /** ctx = { arrived (reached the current walk target), playerDistance, dogDistance } */
    update(dt, { arrived = false, playerDistance = Infinity, dogDistance = Infinity } = {}) {
      timer -= dt; petCooldown -= dt;
      // The dog wins over chores: kneel and greet it when it trots up to her.
      if (dogDistance < 2.6 && petCooldown <= 0 && (mode === 'home' || mode === 'tend')) { petCooldown = 30; go('pet', 3.4); }
      else if (mode === 'home' && timer <= 0) {
        if (spots > 0 && playerDistance > 7) { spot = (spot + 1) % spots; go('toSpot'); }
        else timer = 4; // the player is close: stay and watch, try again shortly
      } else if (mode === 'toSpot' && arrived) go('tend', 2.6 + random());
      else if (mode === 'tend' && timer <= 0) go('toHome');
      else if (mode === 'pet' && timer <= 0) go('toHome'); // already home? she "arrives" on the next step
      else if (mode === 'toHome' && arrived) go('home', 15 + random() * 7);
      return { mode, spot, ...KEEPER_POSE[mode] };
    },
    reset() { go('home', 12 + random() * 6); spot = -1; petCooldown = 6; },
  };
}
