export const HOUND_LINES = [
  { text: 'Wait—what’s happening to you?', seconds: 3.2, shot: 'hound' },
  { text: 'Those flames… you’re still in there. I know you are.', seconds: 4.2, shot: 'player' },
  { text: 'Three embers. Back to the shrine. Hold on—I’m bringing you back.', seconds: 4.8, shot: 'hound' },
];

export const HOUND_CURE_LINES = [
  { speaker: 'YOU', text: 'Easy… it’s over. You’re safe now.', seconds: 3.2, shot: 'hound' },
  { speaker: 'SHRINE KEEPER', text: 'Three embers returned, and a bond restored. Your companion is free of the flame.', seconds: 5.2, shot: 'keeper' },
  { speaker: 'YOU', text: 'How did this even happen to him?', seconds: 3.2, shot: 'player' },
  { speaker: 'SHRINE KEEPER', text: 'It was no accident. The Triad marked him long ago, and the shrine remembers. Look into its flame.', seconds: 6, shot: 'keeper' },
];
// The memory ("The Mark in the Flame", cloverScenes.js) follows, then the keeper's lead to Spade.

// Slow, deliberate pacing: fade up from black, a long transformation the camera circles, unhurried fades out.
export const PHASE_SECONDS = Object.freeze({ enter: 1.2, exit: .9, return: 1 });
export const TRANSFORM_SECONDS = 8;
export function houndTransformation(seconds) {
  const smooth = (a, b, t) => { const p = Math.max(0, Math.min(1, (t - a) / (b - a))); return p * p * (3 - 2 * p); };
  return { fire: smooth(1.6, 4.4, seconds), wolf: smooth(4.6, 7.2, seconds) };
}

// Camera moves: ease in and out with zero velocity and acceleration at both ends (no lurch when a move starts).
export const smoother = v => { const t = Math.max(0, Math.min(1, v)); return t * t * t * (t * (6 * t - 15) + 10); };
// Blend two camera poses { x, y, z (look point), az, pitch, dist, fov, roll }. The azimuth takes the shorter way
// round, so a change of shot arcs around the subject instead of sliding through it.
export function blendShot(a, b, t) {
  const turn = Math.atan2(Math.sin(b.az - a.az), Math.cos(b.az - a.az));
  const mix = key => a[key] + (b[key] - a[key]) * t;
  return { x: mix('x'), y: mix('y'), z: mix('z'), az: a.az + turn * t, pitch: mix('pitch'), dist: mix('dist'), fov: mix('fov'), roll: mix('roll') };
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
      if (phase === 'enter' && time >= PHASE_SECONDS.enter) { phase = 'transform'; time = 0; }
      else if (phase === 'transform' && time >= TRANSFORM_SECONDS) scene.next();
      else if (phase === 'dialogue' && time >= scene.line.seconds) scene.next();
      else if (phase === 'exit' && time >= PHASE_SECONDS.exit) { phase = 'return'; time = 0; }
      else if (phase === 'return' && time >= PHASE_SECONDS.return) { phase = 'idle'; time = 0; }
    },
    reset() { seen.clear(); pending = false; kind = 'curse'; phase = 'idle'; time = index = 0; },
  };
  return scene;
}
