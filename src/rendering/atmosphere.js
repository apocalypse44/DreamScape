import { createWorldClock } from '../models/worldClock.js';
import { createAtmosphereEffects } from './atmosphereEffects.js';

// The full world environment is always active and responds to actual movement.
export function createAtmosphere({ scene, renderer, sun, hemi, moteMat, materialProfiles, chunks }) {
  const timeStatus = document.querySelector('#worldTime');
  const clock = createWorldClock();
  const effects = createAtmosphereEffects({ scene, renderer, sun, hemi, chunks, materialProfiles });
  const warmFog = new THREE.Color(0x421329), warmLight = new THREE.Color(0xff7655);
  const coolLight = new THREE.Color(0xd8fff1), coolParticles = new THREE.Color(0x92ffe3);
  const sample = (values, score) => {
    const position = Math.max(0, Math.min(1, score)) * 2;
    const index = Math.min(1, Math.floor(position)), t = position - index;
    const ease = t * t * (3 - 2 * t);
    return values[index] + (values[index + 1] - values[index]) * ease;
  };
  const refreshTime = () => {
    if (timeStatus && timeStatus.textContent !== clock.label) {
      timeStatus.textContent = clock.label;
      timeStatus.setAttribute('datetime', clock.label);
    }
  };
  refreshTime();
  return {
    clock,
    prepare: effects.prepare,
    advance(dt) { clock.advance(dt); refreshTime(); },
    finish: (dt, visualScore, camera, story) => effects.update(dt, visualScore, camera, { hour: clock.hour, ...story }),
    reset() { clock.reset(); effects.reset(); refreshTime(); },
    update(score, biome) {
      const warmth = sample([0, .18, .9], score);
      scene.fog.density = sample([.006, .014, .033], score);
      scene.fog.color.set(biome.fog).lerp(warmFog, warmth);
      scene.background = scene.fog.color;
      sun.color.copy(coolLight).lerp(warmLight, warmth);
      hemi.color.set(biome.sky).lerp(warmLight, warmth * .6);
      sun.intensity = sample([2.1, 1.65, .95], score);
      hemi.intensity = sample([1.6, 1.25, .8], score);
      renderer.toneMappingExposure = sample([1.15, 1.05, .9], score);
      moteMat.color.copy(coolParticles).lerp(warmLight, warmth);
      moteMat.size = sample([.16, .35, .85], score);
      moteMat.opacity = sample([.3, .65, .95], score);
    },
  };
}
