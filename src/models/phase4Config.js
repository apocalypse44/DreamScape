// Phase 4 add-on settings. Tune everything here; no game file is edited.

export const CONFIG = {
  // Second HDRI for chaos (Phase 1 delivers it). Missing file = calm sky + red tint only.
  // Path is relative to index.html. .exr uses the game's EXRLoader; .hdr loads RGBELoader below.
  chaosHdri: 'assets/hdri/chaos_2k.hdr',
  rgbeLoaderUrl: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/RGBELoader.js',

  // ---- 5.1 score pacing ----
  // The game still computes chaos its own way; the add-on scales each frame's change.
  // 0.32/s * 0.25 = 0.08/s, jump +0.08 * 0.25 = +0.02, turn 0.014 * 0.25 ≈ 0.0035
  riseScale: 0.25,
  // 0.16/s * 0.375 = 0.06/s
  fallScale: 0.375,
  maxRisePerSec: 0.05,
  maxFallPerSec: 0.05,   // ~10 s calm-down: fallScale 0.6 + maxFallPerSec 0.08
  passThroughJump: 0.3,  // a change bigger than this in one frame (R reset, quest event) is not slowed
  previewSeconds: 8,     // same length as the game's P preview

  // ---- look ----
  // How strongly the add-on pushes fog / lights / exposure toward the chaos look
  // on top of what atmosphere.js (Theatre) already sets. 0 = leave them alone.
  lookStrength: 0.6,
  tintGround: true,      // tint vertex-colored terrain toward ash in chaos
  weather: { embers: 900, ash: 1400 }, // lower if FPS drops
  showHud: true,         // small "CHAOS 0.42 ▲" label (bottom-left)
};
