// Heart · "The Quiet Springs": the Listening Spring's memory of how the Dark Triad stole Heart's current,
// played when you first speak to Sera. Pure logic, no Three.js: the timeline, cast blocking, the Triad's
// places and the camera shots, all in Heart's (along, side) frame from its gate (layout.at). The renderer
// is src/controllers/heartFlashback.js; cloverScenes.js flies the camera and shows the captions.
//
// One season ago Tidewell was alive. The Triad came to the reef: Sile hung a Diamond-made siphon over it
// and drained the three springs (the town dries as you watch); Sera hid the water spirit in the Listening
// isle; Queen Elowen walked out to stop them and Morcant's rift took her down with the siphon; Veyr chained
// the buried reef so that it would tear itself into the sky if anyone came for the siphon. That is the
// earthquake Nim's vision showed, and why the islands float.
const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const pulse = (t, at, width) => Math.max(0, 1 - Math.abs(t - at) / width);

export const HEART_PAST = {
  duration: 40,      // the shot's length (its last key + 1)
  drain: [12, 19],   // Sile's siphon drinks the springs; Tidewell dries over the same seconds
  hide: [19.6, 22.6],// Sera sends the water spirit down into the Listening isle
  rift: [24.5, 28],  // Morcant's rift opens under the siphon
  taken: [28.4, 30.4],// the queen is pulled into the rift
  sink: [27.6, 31],  // the siphon sinks into the rift
  chains: [31, 35],  // Veyr's chains close round each buried island, one after another
};
export function heartPastStage(t) {
  const H = HEART_PAST;
  return {
    amount: ramp(t, 0, 1.2) * (1 - ramp(t, 38, 39.6)),
    shimmer: Math.max(pulse(t, .5, .6), pulse(t, 39, .8)),
    storm: ramp(t, 7.5, 10) * (1 - .8 * ramp(t, 35.5, 37.5)),
    triad: t >= 8 && t < 36.6 ? ramp(t, 8, 9.6) * (1 - ramp(t, 35.6, 36.6)) : 0,
    smoke: Math.max(ramp(t, 7.6, 8.4) * (1 - ramp(t, 9.6, 11)), ramp(t, 35.4, 36) * (1 - ramp(t, 36.6, 38))),
    siphon: ramp(t, 10.6, 12),                         // it appears under Sile
    drain: ramp(t, ...H.drain),                         // 0 = springs full, 1 = dry
    life: 1 - ramp(t, H.drain[0] + 1, H.drain[1]),      // Tidewell: 1 alive, 0 dry
    harvest: ramp(t, 11.6, 12.2) * (1 - ramp(t, 18.8, 19.4)), // Sile's beams
    hide: ramp(t, ...H.hide),
    rift: ramp(t, ...H.rift) * (1 - ramp(t, 35.8, 37.4)),
    gate: ramp(t, 24, 24.6) * (1 - ramp(t, 30.6, 31.2)), // Morcant's beam into the rift
    taken: ramp(t, ...H.taken),
    sink: ramp(t, ...H.sink),
    chains: ramp(t, ...H.chains),
    binding: ramp(t, 30.6, 31) * (1 - ramp(t, 35, 35.4)),
  };
}

// Blocking in Heart's frame: [time, along, side, clip from this time on]. The director sets each actor on
// the ground under it. face: [along, side] to look at while standing.
export const HEART_PAST_CAST = {
  sera: { person: 'sera', tint: 0x8c354c, face: [155, 0], keys: [
    [0, 124, 3, 'Idle_Loop'], [9, 124, 3, 'Idle_FoldArms_Loop'], [19.4, 124, 3, 'Spell_Simple_Shoot'], [22.8, 124, 3, 'Idle_Loop']] },
  queen: { body: 'F', tint: 0xb02a40, crown: true, face: [155, 0], keys: [
    [0, 64, -6, 'Idle_Loop'], [21.6, 64, -6, 'Idle_Loop'], [22, 70, -6, 'Walk_Loop'], [24, 93, -12, 'Walk_Loop'],
    [26.6, 132, -10, 'Spell_Simple_Shoot'], [28.4, 132, -10, 'Hit_Chest'], [30.4, 152, -2, 'Hit_Chest']] },
  miller: { body: 'M', tint: 0x7a3a3a, face: [47, 0], keys: [
    [0, 47, 8.5, 'Idle_Loop'], [14, 47, 8.5, 'Idle_No_Loop'], [19, 47, 8.5, 'Idle_Loop']] },
  fisher: { body: 'M', tint: 0x2f6f7a, face: [40, 0], keys: [
    [0, 38, 5.4, 'Farm_Watering'], [14.5, 38, 5.4, 'Idle_No_Loop'], [19, 38, 5.4, 'Idle_Loop']] },
};
// The Triad over the reef's centre, facing back toward the town (−along). up: metres above the ground there.
export const HEART_PAST_TRIAD = {
  sile: { along: 155, side: 0, up: 19 },
  veyr: { along: 162, side: -9, up: 22 },
  morcant: { along: 162, side: 9, up: 21 },
};
export const SIPHON_UP = 7.5; // the siphon hangs this far over the reef's centre until it sinks

// Camera keys [t, [along, side, up], [along, side, up]]; up is above the town's ground (1.5 m). Every spot
// clears the reef's hills (≤ 11 m before the crater) and Tidewell's walls (the east gate at along 92 is open).
export const HEART_SHOTS = {
  past: {
    title: 'A MEMORY · THE QUIET SPRINGS', chapter: 'IV · THE HEART KINGDOM', flashback: 'heartPast',
    keys: [
      [0, [34, 0, 7], [76, 0, 3]],              // Tidewell alive: down the full canal
      [4.5, [70, 2, 9], [124, 0, 7]],           // through the east gate to the Listening Spring
      [8, [100, -38, 20], [155, 0, 16]],        // the Triad arrive over the reef
      [11.5, [106, -30, 17], [150, -10, 8]],    // the siphon and the springs
      [13.6, [100, 0, 20], [52, 0, 1]],         // back over the town as it dries
      [17.6, [98, 4, 22], [56, 0, 2]],
      [19.2, [110, 12, 14], [124, 2, 7]],       // Sera hides the spirit
      [23, [104, -24, 13], [126, -10, 4]],      // the queen walks out
      [26.6, [126, -32, 11], [150, -6, 3]],     // the rift takes her
      [30.6, [96, -52, 30], [160, 0, 6]],       // Veyr chains the reef
      [35, [100, -42, 26], [155, 0, 12]],
      [39, [102, -40, 25], [155, 0, 12]],
    ],
    lines: [
      [0.8, 'THE SPRING REMEMBERS', 'A season ago, Heart’s current ran from the reef into every canal in Tidewell.'],
      [4.8, 'THE LISTENING SPRING', 'Sera kept the springs. Queen Elowen kept the town.'],
      [8.6, 'SILE · THE DARK TRIAD', 'A kingdom this generous will not miss its heart.'],
      [12, 'THE SPRING REMEMBERS', 'The siphon was forged in Diamond. It drank all three springs dry.'],
      [14.8, 'THE SPRING REMEMBERS', 'One by one the canals emptied, and the mills stopped.'],
      [19.2, 'SERA · A SEASON AGO', 'Hide, little one. Sleep in the stone until someone comes for you.'],
      [23.4, 'QUEEN ELOWEN OF HEART', 'Give back what you took from my people!'],
      [27, 'MORCANT · THE DARK TRIAD', 'Your queen may keep it company. Below.'],
      [30.8, 'VEYR · THE DARK TRIAD', 'If anyone comes for the siphon, the reef will tear itself out of the ground and carry it out of reach.'],
      [35.8, 'THE SPRING REMEMBERS', 'When your Tide Hook woke, Veyr’s chains pulled.'],
    ],
  },
  // Back in the present, by Sera at the Listening Spring: what to do now.
  sera: {
    title: 'THE STOLEN CURRENT', chapter: 'IV · THE HEART KINGDOM',
    keys: [[0, [72, -3, 2.6], [77, -9, 1.7]], [9, [72.5, -4, 2.5], [77, -9, 1.7]], [18, [71.5, -4.5, 2.8], [77, -9, 1.9]]],
    lines: [
      [0.6, 'SERA', 'Now you have seen it. The siphon is still down there, under the risen reef. So is our queen.'],
      [6.4, 'SERA', 'My water spirit slept in the Listening isle. The quake woke it. Guide it from spring to spring and it will find the siphon.'],
      [12.6, 'SERA', 'Hold Q at the floating crystals to swing up to the islands. Raise the crystal bridges in chaos, and guide the spirit in calm.'],
    ],
  },
};

// World keys for a shot: {x, y, z} points (the game turns them into vectors). base: the town's ground height.
export function heartShotKeys(layout, shot, base = 1.5) {
  const point = ([along, side, up]) => { const p = layout.at(along, side); return { x: p.x, y: base + up, z: p.z }; };
  return shot.keys.map(([t, from, to]) => [t, point(from), point(to)]);
}
// Cast keys in world coordinates: [t, x, z, clip] (the shared poseActor format) and a world face point.
export function heartPastCast(layout) {
  const out = {};
  for (const [name, def] of Object.entries(HEART_PAST_CAST)) {
    const f = layout.at(...def.face);
    out[name] = { ...def, face: { x: f.x, z: f.z }, keys: def.keys.map(([t, along, side, clip]) => { const p = layout.at(along, side); return [t, p.x, p.z, clip]; }) };
  }
  return out;
}
