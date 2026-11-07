// Which face the traveller makes, from what is happening. Pure: no Three.js, no canvas.
// Expressions are drawn by rendering/travelerFace.js; this only decides name, blinking and talking.
export const EXPRESSIONS = ['neutral', 'smile', 'joy', 'determined', 'shout', 'surprised', 'effort', 'hurt', 'focus', 'sad'];
// ^^ and >< eyes are already closed, so they never blink.
const NO_BLINK = new Set(['joy', 'hurt', 'effort']);

// Gameplay keeps a calm, normal face; reactive: true turns on the automatic reactions below.
// Cutscenes and dialogue set expressions explicitly through `override`.
export function pickExpression(s = {}) {
  if (s.override) return s.override;
  if (!s.reactive) return (s.speed ?? 0) < .2 && (s.chaos ?? 0) < .4 ? 'smile' : 'neutral';
  if (s.combat === 'hit' || s.combat === 'knockback' || s.combat === 'death') return 'hurt';
  if (/^slash|dash/.test(s.combat || '')) return 'shout';
  if (s.combat === 'block' || s.combat === 'roll') return 'determined';
  if (s.casting) return 'focus';
  if (!s.grounded && (s.verticalSpeed ?? 0) < -12) return 'surprised';   // a long drop
  if (!s.grounded && (s.verticalSpeed ?? 0) > 0) return 'joy';           // the lift of a jump
  if (s.sprinting && (s.speed ?? 0) > 6) return 'effort';
  if ((s.chaos ?? 0) >= .65) return 'determined';
  if (s.petting) return 'joy';
  if ((s.speed ?? 0) < .2 && (s.chaos ?? 0) < .4) return 'smile';
  return 'neutral';
}

// Blinks every 2.5-5.5 s for 0.12 s, sometimes twice; returns 0 (open) .. 1 (closed).
export function createBlinker(random = Math.random) {
  const CLOSE = .12, CYCLE = .2; // one blink lasts CLOSE; a double blink repeats after CYCLE
  let wait = 1.5 + random() * 3, since = -1, blinks = 0;
  return {
    update(dt, expression) {
      if (NO_BLINK.has(expression)) { since = -1; return 0; }
      if (since < 0) {
        if ((wait -= dt) > 0) return 0;
        since = 0; blinks = random() < .2 ? 2 : 1;
      } else since += dt;
      const round = Math.floor(since / CYCLE), local = since - round * CYCLE;
      if (round >= blinks) { since = -1; wait = 2.5 + random() * 3; return 0; }
      return local < CLOSE ? Math.sin(local / CLOSE * Math.PI) : 0;
    },
  };
}

// Mouth opening for speech: a few syllables per second, 0..1. Silent when not talking.
export function talkOpen(time, talking) {
  if (!talking) return 0;
  const v = Math.sin(time * 13) * .5 + Math.sin(time * 7.3 + 1) * .35 + .15;
  return Math.max(0, Math.min(1, v));
}
