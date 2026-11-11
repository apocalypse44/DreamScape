// Visual state stays separate from collision/quest state. The same avatar can
// therefore be used in the movement playground or the existing kingdoms.
export const TRAVELER_CLIPS = ['idle','walk','jog','run','jumpStart','fall','land','crouchIdle','crouchWalk','cast','castShoot','interact','combatIdle']; // every clip a weight can name: all are zeroed each update
// Walking off a step or down a stair loses the ground for a frame or two: that is not a jump or a fall.
const GRACE = 0.2;                      // seconds off the ground (without jumping) that still count as walking
const SLIDE_IN = 0.36, SLIDE_OUT = 0.24; // descent per metre travelled on natural ground (the caller passes 0 on stairs and ramps)
export function createTravelerMotion() {
  let grounded = true, airTime = 0, landTime = 0, lastSpeed = 0, jumped = false, sliding = false;
  const weights = Object.fromEntries(TRAVELER_CLIPS.map(name => [name, 0]));
  return {
    // descent: how fast the feet are going down (m/s) while moving, for slopes and stairs.
    update(dt, { speed, grounded: onGround, verticalSpeed = 0, crouching = false, casting = false, inFlight = false, armed = false, descent = 0 }) {
      dt = Math.max(0, Math.min(.1, dt));
      const takeoff = grounded && !onGround && verticalSpeed > 0;
      if (takeoff) { airTime = 0; jumped = true; }
      else if (grounded && !onGround) airTime = 0; // stepped off an edge
      if (!onGround) airTime += dt;
      // A brief drop that was not a jump (stairs, a slope's lip) still counts as on the ground.
      const footed = onGround || (!jumped && !inFlight && airTime < GRACE);
      // Land only after a real jump or a real fall.
      const landed = !grounded && onGround && (jumped || airTime >= GRACE);
      if (onGround) { jumped = false; if (!grounded) airTime = 0; }
      if (landed) landTime = speed > 1 ? .12 : .22;
      landTime = Math.max(0, landTime - dt);
      // Down a slope steeper than stairs: slide (hysteresis keeps it from flickering on the threshold).
      const grade = speed > 1.2 ? descent / speed : 0;
      sliding = footed && !crouching && !inFlight && (sliding ? grade > SLIDE_OUT : grade > SLIDE_IN);
      for (const name of TRAVELER_CLIPS) weights[name] = 0;
      let name;
      if (inFlight) { name = 'gliding'; weights.fall = 1; }
      else if (!footed) { name = verticalSpeed > 0 ? 'jumping' : 'falling'; weights[verticalSpeed > 0 && airTime < .14 ? 'jumpStart' : 'fall'] = 1; }
      else if (sliding) { name = 'sliding'; weights.crouchIdle = 1; } // a low stance; travelerCharacter leans the body back
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
      return { name, weights, takeoff, landed, acceleration, sliding };
    },
    reset() { grounded = true; airTime = landTime = lastSpeed = 0; jumped = sliding = false; },
  };
}
