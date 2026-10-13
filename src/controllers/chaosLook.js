// Chaos pacing and look: slows how fast the score moves, then pushes fog, lights, exposure, sky and
// ground toward the chaos look, with ember / ash rain and lightning. game.js calls update() once per
// frame, after everything else has set this frame's look and just before rendering.
import { CONFIG } from '../models/chaosLookConfig.js';
import { sampleLook } from '../models/look.js';
import { createSky } from '../rendering/sky.js';
import { createChaosWeather } from '../rendering/chaosWeather.js';
import { updateChaosReadout } from '../views/hud.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Push a value toward a target without losing what the game set: if the game rewrote the value
// since our last write, that becomes the new base. Values the game never rewrites keep their base.
const numDrivers = new WeakMap();
function driveNumber(obj, key, target, k, add = 0) {
  let d = numDrivers.get(obj);
  if (!d) { d = {}; numDrivers.set(obj, d); }
  const st = d[key] || (d[key] = { base: obj[key], written: null });
  if (st.written === null || obj[key] !== st.written) st.base = obj[key];
  const v = st.base + (target - st.base) * k + add;
  obj[key] = v;
  st.written = v;
}
const colorDrivers = new WeakMap();
function driveColor(color, target, k) {
  let d = colorDrivers.get(color);
  if (!d) { d = { base: color.clone(), written: color.clone() }; colorDrivers.set(color, d); }
  if (!color.equals(d.written)) d.base.copy(color);
  color.copy(d.base).lerp(target, k);
  d.written.copy(color);
}

export function createChaosLook({ renderer, scene, sun, hemi, chunks }) {
  const gov = { last: null, pending: 0, slope: 0 };
  let trend = 0;
  let visual = 0;
  let sky = null;
  let chaosTex = null;
  let chaosEnv = null;
  let savedEnv = null;
  let envSwapped = false;
  const weather = createChaosWeather(scene, CONFIG.weather);

  // Second HDRI for the chaos sky and reflections. Missing file = calm sky + red tint only.
  new THREE.RGBELoader().setDataType(THREE.HalfFloatType).load(CONFIG.chaosHdri, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    chaosTex = tex;
    sky?.setChaosTexture(tex);
    const pmrem = new THREE.PMREMGenerator(renderer);
    chaosEnv = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
  }, undefined, () => console.warn(`Chaos HDRI not found at ${CONFIG.chaosHdri}; using calm sky + red tint.`));

  // Pacing: the game computes chaos its own way; this scales each frame's change.
  function govern(state, dt) {
    const raw = state.chaos;
    if (gov.last === null) { gov.last = raw; return; }
    const d = raw - gov.last;
    if (Math.abs(d) > CONFIG.passThroughJump) { gov.last = raw; gov.pending = 0; return; } // quest events
    const up = CONFIG.maxRisePerSec * dt;
    const down = CONFIG.maxFallPerSec * dt;
    const s = d > 0 ? d * CONFIG.riseScale : d * CONFIG.fallScale;
    let delta = 0;
    if (s >= 0) gov.pending += s; else delta = Math.max(s, -down);
    const take = Math.min(gov.pending, Math.max(0, up - delta));
    delta += take;
    gov.pending = Math.min(gov.pending - take, 0.05);
    const prev = gov.last;
    state.chaos = clamp(gov.last + delta, 0, 1);
    gov.last = state.chaos;
    gov.slope += ((state.chaos - prev) / dt - gov.slope) * (1 - Math.exp(-4 * dt));
    trend = gov.slope > 0.004 ? 1 : gov.slope < -0.004 ? -1 : 0;
  }

  return {
    // previewScore: the atmosphere's 8 s P preview sweep, or null when not previewing.
    update(dt, state, camera, previewScore) {
      if (dt > 0) govern(state, dt);
      const score = state.chaos;
      visual = previewScore ?? visual + (score - visual) * (1 - Math.exp(-3 * dt));
      const look = sampleLook(visual);

      // Theatre mode shows an equirect HDRI as background: the blendable sky dome shows it instead.
      const bg = scene.background;
      if (bg && bg.isTexture && !bg.isCubeTexture && bg.image) {
        scene.background = null;
        if (!sky) {
          sky = createSky({ calm: bg, chaos: chaosTex || bg });
          scene.add(sky.mesh);
        } else sky.setCalmTexture(bg);
        if (!chaosTex) sky.setChaosTexture(bg);
      }
      const theatre = !!(sky && scene.background === null && scene.environment);
      if (sky) {
        sky.mesh.visible = theatre;
        sky.update(camera);
      }

      const flash = weather.update(dt, visual, camera.position);

      // Fog, exposure, lights: strength grows with the score. Outside Theatre the fog colour is the
      // background too and stays the game's own.
      const k = CONFIG.lookStrength * visual;
      if (theatre) driveColor(scene.fog.color, look.fogColor, k);
      driveNumber(scene.fog, 'density', look.fogDensity, k);
      driveNumber(renderer, 'toneMappingExposure', look.exposure, k);
      driveColor(sun.color, look.sunColor, k);
      driveNumber(sun, 'intensity', look.sunIntensity, k);
      driveColor(hemi.color, look.hemiSky, k);
      driveColor(hemi.groundColor, look.hemiGround, k);
      driveNumber(hemi, 'intensity', look.hemiIntensity, k, flash * 3);

      if (CONFIG.tintGround) for (const chunk of chunks.values()) driveColor(chunk.userData.material.color, look.groundTint, look.groundTintAmount);

      if (sky) {
        const u = sky.uniforms;
        u.uMix.value = chaosTex ? look.skyMix : 0;
        u.uTint.value.copy(look.skyTint);
        u.uSaturation.value = look.skySaturation;
        u.uBrightness.value = look.skyBrightness + flash * 1.5;
        u.uFogAmount.value = look.skyFog;
        u.uFogColor.value.copy(scene.fog.color);
      }

      // Reflections: swap to the chaos environment past the middle (with hysteresis).
      if (chaosEnv && theatre) {
        if (!envSwapped && look.skyMix > 0.55) { savedEnv = scene.environment; scene.environment = chaosEnv; envSwapped = true; }
        else if (envSwapped && look.skyMix < 0.45) { scene.environment = savedEnv; envSwapped = false; }
      } else if (envSwapped) {
        if (scene.environment === chaosEnv) scene.environment = savedEnv;
        envSwapped = false;
      }

      if (CONFIG.showHud) updateChaosReadout(previewScore !== null ? 'PREVIEW' : score >= 0.65 ? 'CHAOS' : 'CALM', score, trend);
    },

    // R: a reset is never slowed down.
    reset() {
      gov.last = null;
      gov.pending = 0;
      visual = 0;
      weather.reset();
    },
  };
}
