import { createHDRILighting } from './hdri.js';

/* A small Theatre.js sequence sampled by movement score, or an 8-second preview. */
export function createAtmosphereDemo({ scene, renderer, sun, hemi, moteMat, materialProfiles }) {
  const toggle = document.querySelector('#atmosphereToggle');
  const preview = document.querySelector('#atmospherePreview');
  const status = document.querySelector('#atmosphereStatus');
  if (!window.Theatre?.core) {
    status.textContent = 'Original atmosphere · Theatre could not load';
    toggle.textContent = 'THEATRE UNAVAILABLE';
    toggle.setAttribute('aria-pressed', 'false');
    return { update() {} };
  }

  // Positions 0, 5 and 10 represent calm, unsettled and chaotic conditions.
  const presets = {
    fog: [0.006, 0.014, 0.033],
    warmth: [0, 0.18, 0.9],
    sunlight: [2.1, 1.65, 0.95],
    skylight: [1.6, 1.25, 0.8],
    exposure: [1.15, 1.05, 0.9],
    particleSize: [0.16, 0.35, 0.85],
    particleOpacity: [0.3, 0.65, 0.95],
    environmentIntensity: [1.4, 0.9, 0.35]
  };
  const trackData = {};
  const trackIdByPropPath = {};
  const defaults = {};
  for (const [name, values] of Object.entries(presets)) {
    defaults[name] = values[0];
    trackIdByPropPath[JSON.stringify([name])] = name;
    trackData[name] = {
      type: 'BasicKeyframedTrack',
      keyframes: values.map((value, i) => ({
        id: `${name}-${i}`, position: i * 5, value,
        connectedRight: true, handles: [0.5, 1, 0.5, 0]
      }))
    };
  }
  const project = Theatre.core.getProject('Dreamscape Atmosphere Demo', {
    state: {
      definitionVersion: '0.4.0', revisionHistory: [],
      sheetsById: {
        Atmosphere: {
          staticOverrides: { byObject: {} },
          sequence: {
            type: 'PositionalSequence', length: 10, subUnitsPerUnit: 30,
            tracksByObject: { Look: { trackData, trackIdByPropPath } }
          }
        }
      }
    }
  });
  const sheet = project.sheet('Atmosphere');
  const look = sheet.object('Look', defaults);
  const warmFog = new THREE.Color(0x421329);
  const warmLight = new THREE.Color(0xff7655);
  const coolLight = new THREE.Color(0xd8fff1);
  const coolParticles = new THREE.Color(0x92ffe3);
  let enabled = true;
  let previewTime = null;
  let hdriStatus = 'Loading HDRI';
  const refresh = () => {
    toggle.textContent = enabled ? 'T · THEATRE ON' : 'T · ORIGINAL';
    toggle.setAttribute('aria-pressed', String(enabled));
    preview.textContent = previewTime === null ? 'P · PREVIEW 8s' : 'P · STOP PREVIEW';
    status.textContent = previewTime !== null
      ? `${enabled ? 'Theatre' : 'Original'} · calm → chaos → calm`
      : enabled ? 'Theatre · responds to your movement' : 'Original · responds to your movement';
    if (enabled) status.textContent += ` · ${hdriStatus}`;
  };
  const hdri = createHDRILighting({
    scene, renderer, profiles: materialProfiles,
    onStatus(message) { hdriStatus = message; refresh(); }
  });
  toggle.disabled = preview.disabled = false;
  toggle.addEventListener('click', () => { enabled = !enabled; refresh(); });
  preview.addEventListener('click', () => {
    previewTime = previewTime === null ? 0 : null;
    refresh();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.code === 'KeyT') toggle.click();
    if (event.code === 'KeyP') preview.click();
  });
  refresh();
  return {
    prepare: hdri.prepare,
    isEnabled: () => enabled,
    isPreviewing: () => previewTime !== null,
    // Called before original rendering so both looks receive the same preview score.
    score(dt, chaos) {
      if (previewTime === null) return chaos;
      previewTime += dt;
      if (previewTime >= 8) {
        previewTime = null;
        refresh();
        return chaos;
      }
      return (1 - Math.cos(previewTime / 8 * Math.PI * 2)) / 2;
    },
    update(score, biome) {
      // Restore every property that the original renderer doesn't reset itself.
      sun.intensity = 1.7;
      hemi.intensity = 1.35;
      renderer.toneMappingExposure = 1.05;
      if (!enabled) {
        hdri.update(false, 0);
        return;
      }
      sheet.sequence.position = score * 10;
      const value = look.value;
      scene.fog.density = value.fog;
      scene.fog.color.set(biome.fog).lerp(warmFog, value.warmth);
      scene.background = scene.fog.color;
      hdri.update(true, value.environmentIntensity);
      sun.color.copy(coolLight).lerp(warmLight, value.warmth);
      hemi.color.set(biome.sky).lerp(warmLight, value.warmth * 0.6);
      sun.intensity = value.sunlight;
      hemi.intensity = value.skylight;
      renderer.toneMappingExposure = value.exposure;
      moteMat.color.copy(coolParticles).lerp(warmLight, value.warmth);
      moteMat.size = value.particleSize;
      moteMat.opacity = value.particleOpacity;
    }
  };
}
