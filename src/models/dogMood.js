// Pure mood -> body-language mapping for the companion and the Ember Hound.
// Inputs are 0-1 levels; outputs are radians, Hz and levels the renderer layers on the clip.
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const HEAD_OWNED = new Set(['howl', 'Gallop', 'Gallop_Jump', 'shake', 'playBow', 'Death', 'Eating']);
const RESTFUL = new Set(['sit', 'pet', 'lie', 'Idle', 'Idle_2', 'playBow', 'bark']);

export function dogMood({ happy = .6, chaos = 0, alert = 0, scar = 0, speed = 0 } = {}, clip = 'Idle') {
  const fear = smooth(.45, .9, chaos);
  // A relaxed wag, not a propeller: about 0.06-0.26 rad shared down the tail, near-still when running.
  const wagBase = RESTFUL.has(clip) || speed < 3 ? .06 + .2 * happy : .03;
  return {
    fear,
    tailRaise: .35 * happy - 1.0 * fear,              // + curls up over the back, - tucks between the legs
    wagAmplitude: wagBase * (1 - .85 * fear),
    wagFrequency: 2.2 + 2.8 * happy * (1 - fear),
    ears: alert > .5 ? .18 : .05 * happy - .9 * fear,  // + perked forward, - flattened back
    lookWeight: HEAD_OWNED.has(clip) ? 0 : speed > 6 ? .3 : 1,
    scarGlow: .25 + .75 * Math.max(scar, fear),
  };
}
