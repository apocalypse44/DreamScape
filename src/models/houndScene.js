export const HOUND_LINES = [
  { text: 'Wait—what’s happening to you?', seconds: 3.2, shot: 'hound' },
  { text: 'Those flames… you’re still in there. I know you are.', seconds: 4.2, shot: 'player' },
  { text: 'Three embers. Back to the shrine. Hold on—I’m bringing you back.', seconds: 4.8, shot: 'hound' },
];

export const HOUND_CURE_LINES = [
  { speaker: 'YOU', text: 'Easy… it’s over. You’re safe now.', seconds: 3.2, shot: 'hound' },
  { speaker: 'SHRINE KEEPER', text: 'Three embers returned, and a bond restored. Your companion is free of the flame.', seconds: 5.2, shot: 'keeper' },
  { speaker: 'YOU', text: 'But this wasn’t the only bond that was broken, was it?', seconds: 3.8, shot: 'player' },
  { speaker: 'SHRINE KEEPER', text: 'West, in Spade, the Triad binds people by stealing their memories. Neris shelters those they tried to erase.', seconds: 6.2, shot: 'keeper' },
  { speaker: 'SHRINE KEEPER', text: 'Find her at the Lantern Refuge—the first house on your right as you enter Spade. Hear her story, then seek the stolen testimonies in the castle archive.', seconds: 8, shot: 'keeper' },
  { speaker: 'YOU', text: 'Then we head west. Stay close, friend. We’ll find Neris together.', seconds: 4.4, shot: 'player' },
];

export const TRANSFORM_SECONDS = 5.2;
export function houndTransformation(seconds) {
  const smooth = (a, b, t) => { const p = Math.max(0, Math.min(1, (t - a) / (b - a))); return p * p * (3 - 2 * p); };
  return { fire: smooth(1, 2.8, seconds), wolf: smooth(3, 4.6, seconds) };
}

// Each real quest milestone gets one scene per run. Offering alone is not a cure.
export function createHoundScene() {
  const seen = new Set();
  let kind = 'curse', pending = false, phase = 'idle', time = 0, index = 0;
  const scene = {
    get kind() { return kind; },
    get active() { return phase !== 'idle'; },
    get pending() { return pending; },
    get transformation() {
      const pose = phase === 'enter' || pending ? houndTransformation(0)
        : phase === 'transform' ? houndTransformation(time) : { fire: 1, wolf: 1 };
      return kind === 'cure' ? { fire: 1 - pose.fire, wolf: 1 - pose.wolf } : pose;
    },
    get phase() { return phase; },
    get time() { return time; },
    get index() { return index; },
    get line() { return (kind === 'cure' ? HOUND_CURE_LINES : HOUND_LINES)[index]; },
    observe(stage, ready) {
      if (scene.active) return false;
      const milestone = stage === 'cursed' ? 'curse' : stage === 'cured' ? 'cure' : null;
      pending = Boolean(milestone && !seen.has(milestone));
      if (!pending) return false;
      kind = milestone;
      if (!ready) return false;
      seen.add(kind); pending = false; phase = 'enter'; time = 0; index = 0;
      return true;
    },
    next() {
      if (phase === 'enter') { phase = 'transform'; time = 0; }
      else if (phase === 'transform') { phase = 'dialogue'; index = 1; time = 0; }
      else if (phase === 'dialogue') {
        if (index < (kind === 'cure' ? HOUND_CURE_LINES : HOUND_LINES).length - 1) { index++; time = 0; }
        else scene.skip();
      }
    },
    skip() {
      if (phase === 'enter' || phase === 'transform' || phase === 'dialogue') { phase = 'exit'; time = 0; }
    },
    update(dt) {
      if (!scene.active) return;
      time += Math.max(0, dt);
      if (phase === 'enter' && time >= .45) { phase = 'transform'; time = 0; }
      else if (phase === 'transform' && time >= TRANSFORM_SECONDS) scene.next();
      else if (phase === 'dialogue' && time >= scene.line.seconds) scene.next();
      else if (phase === 'exit' && time >= .25) { phase = 'return'; time = 0; }
      else if (phase === 'return' && time >= .3) { phase = 'idle'; time = 0; }
    },
    reset() { seen.clear(); pending = false; kind = 'curse'; phase = 'idle'; time = index = 0; },
  };
  return scene;
}
