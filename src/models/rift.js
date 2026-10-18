// The Hollow Gate rift: a vortex in the sky above Spade castle that tears wider as the story uncovers the Triad.
// Openness comes only from milestones the player actually reached (the same state the grimoire journal reads),
// so it can never run ahead of the story. Later chapters (Heart's awakening, the finale that seals it) extend this.
export const RIFT = Object.freeze({ x: -520, y: 420, z: 0 }); // high above the Hollow Gate

export function riftOpenness(quest, spade) {
  const stage = quest.stage;
  let open = stage === 'companion' ? 0 : stage === 'cured' ? .4 : .25;   // the curse tears the first scar
  open += (spade?.castle.discovery.count ?? 0) / 3 * .2;                // each stolen testimony restored
  if (spade?.echo.recovered) open += .15;                               // the erased witness
  if (spade?.castle.discovery.complete) open += .25;                    // the Hollow Crown understood
  return Math.min(1, open);
}

// How strongly it shows right now: an opened rift lingers faintly in calm and roars in evil mode.
export const riftStrength = (open, evil) => open * (.3 + .7 * evil);
