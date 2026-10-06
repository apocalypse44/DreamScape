// controllers/phase4.js - Phase 4 (score pacing + environment change) as a DROP-IN ADD-ON.
//
// No existing game file is edited. Add ONE line to index.html, after the game's script:
//   <script type="module" src="src/controllers/phase4.js"></script>
// Remove that line and the game is exactly as before.
//
// How it hooks in (all at runtime):
//  - hooks THREE.Scene.prototype.onBeforeRender, so it runs once per frame right
//    before the game draws (after the game's own update) and sees renderer + scene + camera;
//  - finds the shared `state` object (state.chaos) by re-importing game modules
//    that are already loaded (ES modules are cached, nothing runs twice);
//  - slows the score by scaling the change the game made this frame (5.1);
//  - swaps the fixed HDRI background for a blendable sky dome (4.1-4.3);
//  - pushes fog / lights / exposure / ground toward the chaos look (4.4, 4.5, 4.8);
//  - adds ember / ash rain and lightning (4.6).
// Open the browser console: lines starting with [phase4] say what was found.

const THREE = window.THREE; // the game loads three.js r128 as a global <script>
import { CONFIG } from '../models/phase4Config.js';
import { createSky } from '../rendering/sky.js';
import { createChaosWeather } from '../rendering/chaosWeather.js';
import { sampleLook } from '../models/look.js';
import { START } from '../models/state.js'; // already loaded by the game, not run twice

const log = (...a) => console.log('[phase4]', ...a);
const warn = (...a) => console.warn('[phase4]', ...a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const P4 = {
  renderer: null, scene: null, camera: null,
  getState: null, visual: 0, trend: 0,
  sky: null, calmTex: null, chaosTex: null, chaosEnv: null, envSwapped: false, savedEnv: null,
  weather: null, sun: null, hemi: null, ground: [], lastScan: -1e9,
  previewUntil: 0, previewStart: 0, lastNow: 0,
};
window.phase4 = P4; // inspect from the console: phase4.visual, phase4.getState()

// ---------------------------------------------------------------- state lookup
// game.js keeps `state` private, but reset() runs Object.assign(state, START) at start-up
// and on every R press. We watch for that call and keep a reference to `state`.
let capturedState = null;
const originalAssign = Object.assign;
Object.assign = function (target, ...sources) {
  if (sources[0] === START && target && target !== START) {
    if (capturedState !== target) log('score found (game state captured)');
    capturedState = target;
    gov.last = null; gov.pending = 0;   // a reset is never slowed down
    P4.visual = 0;
    if (P4.weather) P4.weather.reset();
  }
  return originalAssign.call(Object, target, ...sources);
};
P4.getState = () => capturedState;
setTimeout(() => {
  if (!capturedState) warn('Game state not captured yet. Press R in the game once; if this stays, send the Console to your helper.');
}, 6000);

// ---------------------------------------------------------------- 5.1 pacing
const gov = { last: null, pending: 0, slope: 0, fights: 0 };

function govern(st, dt) {
  const raw = st.chaos;
  if (typeof raw !== 'number' || dt <= 0) return;
  if (gov.last === null) { gov.last = raw; return; }

  const d = raw - gov.last;
  if (Math.abs(d) > CONFIG.passThroughJump) { gov.last = raw; gov.pending = 0; return; } // R reset, quest events

  // Game moved too far for its own fast pacing? It probably overwrites state.chaos from a private copy.
  gov.fights = Math.abs(d) > 0.05 ? gov.fights + 1 : Math.max(0, gov.fights - 1);
  if (gov.fights === 60) warn('The game keeps overwriting state.chaos - pacing cannot slow it from outside.');

  const up = CONFIG.maxRisePerSec * dt;
  const down = CONFIG.maxFallPerSec * dt;
  const s = d > 0 ? d * CONFIG.riseScale : d * CONFIG.fallScale;
  let delta = 0;
  if (s >= 0) gov.pending += s; else delta = Math.max(s, -down);
  const take = Math.min(gov.pending, Math.max(0, up - delta));
  delta += take;
  gov.pending = Math.min(gov.pending - take, 0.05);

  const prev = gov.last;
  st.chaos = clamp(gov.last + delta, 0, 1);
  gov.last = st.chaos;

  gov.slope += ((st.chaos - prev) / dt - gov.slope) * (1 - Math.exp(-4 * dt));
  P4.trend = gov.slope > 0.004 ? 1 : gov.slope < -0.004 ? -1 : 0;
}

// ---------------------------------------------------------------- "driven" values
// Push a value toward a target WITHOUT losing what the game set: if the game
// rewrote the value since our last write, that becomes the new base.
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

// ---------------------------------------------------------------- scene scan
function scan(scene) {
  let sun = null, hemi = null;
  const ground = new Set();
  scene.traverse((o) => {
    if (o.isDirectionalLight && (!sun || o.intensity > sun.intensity)) sun = o;
    if (o.isHemisphereLight && !hemi) hemi = o;
    if (CONFIG.tintGround && o.isMesh && !o.isInstancedMesh && o.material && !Array.isArray(o.material)) {
      const pos = o.geometry && o.geometry.attributes.position;
      const chunkMat = o.parent && o.parent.userData && o.parent.userData.material;
      if (chunkMat === o.material && o.material.color && pos && pos.count > 500) ground.add(o.material);
    }
  });
  P4.sun = sun; P4.hemi = hemi; P4.ground = [...ground];
}

// ---------------------------------------------------------------- chaos HDRI
function loadScript(url) {
  return new Promise((ok, fail) => {
    const el = document.createElement('script');
    el.src = url; el.onload = ok; el.onerror = fail;
    document.head.appendChild(el);
  });
}

async function loadChaosHdri(renderer) {
  const isExr = /\.exr$/i.test(CONFIG.chaosHdri);
  try {
    if (!isExr && !THREE.RGBELoader) await loadScript(CONFIG.rgbeLoaderUrl);
  } catch {
    warn(`Could not load RGBELoader from ${CONFIG.rgbeLoaderUrl} - chaos HDRI skipped (tint still works).`);
    return;
  }
  const Loader = isExr ? THREE.EXRLoader : THREE.RGBELoader;
  if (!Loader) { warn('No EXR/RGBE loader available - chaos HDRI skipped.'); return; }
  const loader = new Loader();
  if (loader.setDataType) loader.setDataType(THREE.HalfFloatType);
  loader.load(CONFIG.chaosHdri, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    P4.chaosTex = tex;
    if (P4.sky) P4.sky.setChaosTexture(tex);
    const pmrem = new THREE.PMREMGenerator(renderer);
    P4.chaosEnv = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    log('chaos HDRI loaded');
  }, undefined, () => warn(`chaos HDRI not found at ${CONFIG.chaosHdri} - using calm sky + red tint.`));
}

// ---------------------------------------------------------------- HUD
let hud = null;
function updateHud(score) {
  if (!CONFIG.showHud) return;
  if (!hud) {
    hud = document.createElement('div');
    hud.setAttribute('aria-live', 'polite');
    hud.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;font:600 13px/1.2 system-ui,sans-serif;' +
      'color:#fff;background:rgba(0,0,0,.45);padding:6px 10px;border-radius:6px;pointer-events:none;';
    document.body.appendChild(hud);
  }
  const arrow = P4.trend > 0 ? '▲' : P4.trend < 0 ? '▼' : '–';
  const label = performance.now() < P4.previewUntil ? 'PREVIEW' : score >= 0.65 ? 'CHAOS' : 'CALM';
  hud.textContent = `${label} ${score.toFixed(2)} ${arrow}`;
}

// ---------------------------------------------------------------- per frame
function frame(renderer, scene, camera, now, camPos) {
  const dt = clamp((now - (P4.lastNow || now)) / 1000, 0, 0.1);
  P4.lastNow = now;

  // 5.1 score
  const st = P4.getState ? P4.getState() : null;
  if (st) govern(st, dt);
  const score = st && typeof st.chaos === 'number' ? st.chaos : 0;

  // visual score (own 8 s preview sweep while P runs)
  const btn = document.querySelector('#atmospherePreview');
  const gamePreview = !!(btn && /STOP/i.test(btn.textContent));
  if (gamePreview && P4.previewUntil < now) { P4.previewStart = now; P4.previewUntil = now + CONFIG.previewSeconds * 1000; }
  if (!gamePreview) P4.previewUntil = 0;
  if (now < P4.previewUntil) {
    const t = (now - P4.previewStart) / (CONFIG.previewSeconds * 1000);
    P4.visual = 0.5 - 0.5 * Math.cos(Math.min(1, t) * Math.PI * 2);
  } else {
    P4.visual += (score - P4.visual) * (1 - Math.exp(-3 * dt));
  }
  const v = P4.visual;
  const look = sampleLook(v);

  if (now - P4.lastScan > 2000) { scan(scene); P4.lastScan = now; }

  // Theatre mode = the game shows an equirect HDRI as background.
  const bg = scene.background;
  if (bg && bg.isTexture && !bg.isCubeTexture && bg.image) {
    P4.calmTex = bg;
    scene.background = null;              // the dome shows it instead (4.1)
    if (!P4.sky) {
      P4.sky = createSky({ calm: bg, chaos: P4.chaosTex || bg });
      log('sky dome active (Theatre mode)');
    } else P4.sky.setCalmTexture(bg);
    if (!P4.chaosTex) P4.sky.setChaosTexture(bg);
  }
  const theatre = !!(P4.sky && scene.background === null && scene.environment);

  if (P4.sky) {
    if (P4.sky.mesh.parent !== scene) scene.add(P4.sky.mesh);
    P4.sky.mesh.visible = theatre;
    P4.sky.mesh.position.copy(camPos);
    P4.sky.mesh.updateMatrixWorld(); // scene matrices were already updated this frame
  }

  // 4.6 weather (first, so lightning can feed the lights)
  if (!P4.weather) P4.weather = createChaosWeather(scene, CONFIG.weather);
  if (P4.weather.embers.parent !== scene) scene.add(P4.weather.embers, P4.weather.ash);
  const flash = P4.weather.update(dt, v, camPos);

  // 4.4 fog / exposure / lights: push toward chaos look, strength grows with the score
  const k = CONFIG.lookStrength * v;
  if (scene.fog) {
    driveColor(scene.fog.color, look.fogColor, k);
    if ('density' in scene.fog) driveNumber(scene.fog, 'density', look.fogDensity, k);
    else { driveNumber(scene.fog, 'near', look.fogNear, k); driveNumber(scene.fog, 'far', look.fogFar, k); }
  }
  driveNumber(renderer, 'toneMappingExposure', look.exposure, k);
  if (P4.sun) { driveColor(P4.sun.color, look.sunColor, k); driveNumber(P4.sun, 'intensity', look.sunIntensity, k); }
  if (P4.hemi) {
    driveColor(P4.hemi.color, look.hemiSky, k);
    driveColor(P4.hemi.groundColor, look.hemiGround, k);
    driveNumber(P4.hemi, 'intensity', look.hemiIntensity, k, flash * 3);
  }

  // 4.5 ground tint
  for (const m of P4.ground) driveColor(m.color, look.groundTint, look.groundTintAmount);

  // 4.1-4.3 sky dome values (always the current fog color at the horizon)
  if (P4.sky) {
    const u = P4.sky.uniforms;
    u.uMix.value = P4.chaosTex ? look.skyMix : 0;
    u.uTint.value.copy(look.skyTint);
    u.uSaturation.value = look.skySaturation;
    u.uBrightness.value = look.skyBrightness + flash * 1.5;
    u.uFogAmount.value = look.skyFog;
    if (scene.fog) u.uFogColor.value.copy(scene.fog.color);
  }

  // 4.2 reflections: swap to the chaos environment past the middle
  if (P4.chaosEnv && theatre) {
    if (!P4.envSwapped && look.skyMix > 0.55) { P4.savedEnv = scene.environment; scene.environment = P4.chaosEnv; P4.envSwapped = true; }
    else if (P4.envSwapped && look.skyMix < 0.45) { scene.environment = P4.savedEnv; P4.envSwapped = false; }
  } else if (P4.envSwapped) {
    if (scene.environment === P4.chaosEnv) scene.environment = P4.savedEnv;
    P4.envSwapped = false;
  }

  // 4.8 normal mode: background color follows the fog so it turns red too
  if (!theatre && scene.background && scene.background.isColor && scene.fog) {
    driveColor(scene.background, scene.fog.color, v);
  }

  updateHud(score);
}

// ---------------------------------------------------------------- hook render
// r128 defines renderer.render inside the constructor (not on the prototype), but every
// render() calls scene.onBeforeRender(renderer, scene, camera) - so hook that for all Scenes.
let frameDone = false;
(function tick() { frameDone = false; requestAnimationFrame(tick); })();

const camPos = new THREE.Vector3();
let busy = false;
THREE.Scene.prototype.onBeforeRender = function (renderer, scene, camera) {
  if (busy || !camera) return;
  // main scene = the biggest one (skips PMREM / post-processing helper scenes)
  if (!P4.scene || (scene !== P4.scene && scene.children.length > P4.scene.children.length)) {
    if (!P4.renderer) { log('renderer hooked'); loadChaosHdri(renderer); }
    P4.scene = scene; P4.renderer = renderer;
  }
  if (scene !== P4.scene || frameDone) return;
  frameDone = true;
  P4.camera = camera;
  busy = true;
  try {
    camPos.setFromMatrixPosition(camera.matrixWorld);
    frame(renderer, scene, camera, performance.now(), camPos);
  } catch (e) { console.error('[phase4] frame error', e); }
  busy = false;
};

setTimeout(() => {
  if (!P4.renderer) warn('No render call seen yet - is the game running? (needs the global THREE from index.html)');
}, 4000);

log('add-on loaded');
