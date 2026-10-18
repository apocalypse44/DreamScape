// Chaos pacing and look settings (controllers/chaosLook.js).

export const CONFIG = {
  // Score pacing
  // The game still computes chaos its own way; pacing scales each frame's change.
  // 0.32/s * 0.25 = 0.08/s, jump +0.08 * 0.25 = +0.02, turn 0.014 * 0.25 ≈ 0.0035
  riseScale: 0.25,
  // 0.16/s * 0.375 = 0.06/s
  fallScale: 0.375,
  maxRisePerSec: 0.05,
  maxFallPerSec: 0.05,   // ~10 s calm-down: fallScale 0.6 + maxFallPerSec 0.08
  passThroughJump: 0.3,  // a change bigger than this in one frame (quest event) is not slowed

  // Look
  tintGround: true,      // tint vertex-coloured terrain toward ash in chaos
  weather: { embers: 900, ash: 1400 }, // lower if FPS drops
  showHud: true,         // small "CHAOS 0.42 ▲" label (bottom-left)

  // Evil mode (after Swordigo): deep chaos turns the world into dark silhouettes under a blood-red sky with
  // red lightning. Blends in from `start` to `full` chaos, on top of the storm that builds before it.
  evil: {
    start: 0.5, full: 0.85, // chaos mode switches on at 0.65: already ~40% evil there, full at a sprint
    zenith: 0x14040a,    // sky overhead: very dark crimson
    horizon: 0x9a0d08,   // sky at the horizon: blood red, so terrain and trees read as black against it
    fog: 0x5e0b08,       // deep red: unlit things up close stay dark, distance fades into red (layered silhouettes)
    clouds: [0.09, 0.015, 0.015], // storm clouds, linear RGB: red-black instead of blue-grey
    flash: [1.1, 0.12, 0.05],     // lightning added to the sky, linear RGB: red
    light: 0xff2a12,     // the one key light (sun by day, moon by night), turned red
    lightIntensity: 1.1,
    hemiSky: 0x4a0808, hemiGround: 0x140404, hemiIntensity: 0.4, // low ambient: shadows stay dark but keep detail
    exposure: 0.9,
  },
};
