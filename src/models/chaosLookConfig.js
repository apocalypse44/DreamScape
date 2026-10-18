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
};
