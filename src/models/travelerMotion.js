// Visual state stays separate from collision/quest state. The same avatar can
// therefore be used in the movement playground or the existing kingdoms.
export const TRAVELER_CLIPS = ['idle','walk','jog','run','jumpStart','fall','land','crouchIdle','crouchWalk','cast','castShoot','interact','combatIdle']; // every clip a weight can name: all are zeroed each update
export function createTravelerMotion() {
  let grounded = true, airTime = 0, landTime = 0, lastSpeed = 0;
  const weights = Object.fromEntries(TRAVELER_CLIPS.map(name => [name, 0]));
  return {
    update(dt, { speed, grounded: onGround, verticalSpeed = 0, crouching = false, casting = false, inFlight = false, armed = false }) {
      dt = Math.max(0, Math.min(.1, dt));
      const takeoff = grounded && !onGround && verticalSpeed > 0;
      const landed = !grounded && onGround;
      if (landed) landTime = speed > 1 ? .12 : .22;
      if (takeoff) airTime = 0;
      if (!onGround) airTime += dt;
      landTime = Math.max(0, landTime - dt);
      for (const name of TRAVELER_CLIPS) weights[name] = 0;
      let name;
      if (inFlight) { name = 'gliding'; weights.fall = 1; }
      else if (!onGround) { name = verticalSpeed > 0 ? 'jumping' : 'falling'; weights[verticalSpeed > 0 && airTime < .14 ? 'jumpStart' : 'fall'] = 1; }
      else if (landTime > 0) { name = 'landing'; weights.land = 1; }
      else if (crouching) { name = speed > .15 ? 'crouching walk' : 'crouching'; weights[speed > .15 ? 'crouchWalk' : 'crouchIdle'] = 1; }
      else if (casting && speed < .3) {
        // Q, F and chest grabs: arms posed in code (travelerCharacter castArms). E: the one-hand cast clip.
        name = { push: 'pushing', recall: 'recalling', grab: 'reaching' }[casting] ?? 'casting'; weights[name === 'casting' ? 'cast' : 'idle'] = 1; }
      else if (speed < .15) { name = armed ? 'on guard' : 'idle'; weights[armed ? 'combatIdle' : 'idle'] = 1; }
      else if (speed < 2.2) { name = 'walking'; weights.walk = 1; }
      else if (speed < 5.4) {
        name = 'jogging'; const blend = Math.max(0, Math.min(1, (speed - 2.2) / 1.4)); weights.walk = 1 - blend; weights.jog = blend;
      } else { name = 'running'; weights.run = 1; }
      const acceleration = dt > 0 ? (speed - lastSpeed) / dt : 0;
      grounded = onGround; lastSpeed = speed;
      return { name, weights, takeoff, landed, acceleration };
    },
    reset() { grounded = true; airTime = landTime = lastSpeed = 0; },
  };
}
