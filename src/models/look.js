// Phase 4 look table (4.4 / 4.5 / 4.8): what the world should look like at 0 / 0.5 / 1.
const THREE = window.THREE; // the game loads three.js r128 as a global <script>

export const LOOK_STOPS = [
  { at: 0.0, fogColor: 0xbcd2e6, fogDensity: 0.006, fogNear: 60, fogFar: 420, exposure: 1.0,
    sunColor: 0xfff2dc, sunIntensity: 1.3, hemiSky: 0xcfe3ff, hemiGround: 0x5a6b45, hemiIntensity: 0.7,
    skyMix: 0.0, skyTint: 0xffffff, skySaturation: 1.05, skyBrightness: 1.0, skyFog: 0.15,
    groundTint: 0xffffff, groundTintAmount: 0.0 },
  { at: 0.5, fogColor: 0xc9a08c, fogDensity: 0.011, fogNear: 40, fogFar: 300, exposure: 0.9,
    sunColor: 0xffb070, sunIntensity: 1.0, hemiSky: 0xd8b0a0, hemiGround: 0x4a3a30, hemiIntensity: 0.55,
    skyMix: 0.35, skyTint: 0xffd6c0, skySaturation: 0.95, skyBrightness: 0.85, skyFog: 0.4,
    groundTint: 0xb07a5a, groundTintAmount: 0.25 },
  { at: 1.0, fogColor: 0x7a1d12, fogDensity: 0.022, fogNear: 15, fogFar: 180, exposure: 0.75,
    sunColor: 0xff5528, sunIntensity: 0.6, hemiSky: 0x8a2a1c, hemiGround: 0x1e0d08, hemiIntensity: 0.4,
    skyMix: 1.0, skyTint: 0xff8a70, skySaturation: 0.75, skyBrightness: 0.6, skyFog: 0.7,
    groundTint: 0x6b3a2c, groundTintAmount: 0.6 },
];

const COLOR_KEYS = ['fogColor', 'sunColor', 'hemiSky', 'hemiGround', 'skyTint', 'groundTint'];
const stops = LOOK_STOPS.map((s) => {
  const o = { ...s };
  for (const k of COLOR_KEYS) o[k] = new THREE.Color(s[k]);
  return o;
});
const out = {};
for (const k of COLOR_KEYS) out[k] = new THREE.Color();

export function sampleLook(score) {
  const s = Math.min(1, Math.max(0, score));
  let i = 0;
  while (i < stops.length - 2 && s > stops[i + 1].at) i++;
  const a = stops[i], b = stops[i + 1];
  const t = (s - a.at) / (b.at - a.at);
  for (const k in a) {
    if (k === 'at') continue;
    if (a[k] instanceof THREE.Color) out[k].copy(a[k]).lerp(b[k], t);
    else out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}
