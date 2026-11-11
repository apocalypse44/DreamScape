// Final atmosphere pass. Time owns celestial lighting; chaos changes the air.
import { CONFIG } from '../models/chaosLookConfig.js';
import { sampleLook } from '../models/look.js';
import { sampleDaylight } from '../models/daylight.js';
import { spadeClimateAt, diamondClimateAt, heartClimateAt } from '../models/climate.js';
import { createSky } from './sky.js';
import { createChaosWeather } from './chaosWeather.js';
import { createEnvironmentLighting } from './environmentLighting.js';
import { RIFT, riftStrength } from '../models/rift.js';

export function createAtmosphereEffects({ renderer, scene, sun, hemi, chunks, materialProfiles }) {
  const sky = createSky();
  sky.mesh.visible = true;
  scene.add(sky.mesh);
  const lighting = createEnvironmentLighting({ scene, renderer, profiles: materialProfiles, sky });
  const weather = createChaosWeather(scene, CONFIG.weather);
  const moon = new THREE.DirectionalLight(0x9fbaff, 0);
  moon.name = 'Moonlight';
  scene.add(moon, moon.target);
  scene.add(sun.target);
  const zenithNight = new THREE.Color(0x030817).convertSRGBToLinear();
  const zenithDay = new THREE.Color(0x3285d1).convertSRGBToLinear();
  const horizonNight = new THREE.Color(0x121d35).convertSRGBToLinear();
  const horizonDay = new THREE.Color(0xb4dbef).convertSRGBToLinear();
  const sunset = new THREE.Color(0xe68859).convertSRGBToLinear();
  const stormSky = new THREE.Color(0x222c41).convertSRGBToLinear();
  const fogDay = new THREE.Color(0xa9c6d4), fogNight = new THREE.Color(0x101a2c);
  const fogDusk = new THREE.Color(0xa67d79), fogStorm = new THREE.Color(0x303b4a);
  // Diamond: warm golden haze by day, an amber sandstorm in chaos.
  const desertHaze = new THREE.Color(0xd9b97e), sandstorm = new THREE.Color(0x9a6a2e);
  const desertHorizon = new THREE.Color(0xf0c98a).convertSRGBToLinear();
  const warmSun = new THREE.Color(0xffb46e), noonSun = new THREE.Color(0xfff2d9);
  const groundNight = new THREE.Color(0x111a2d), groundDay = new THREE.Color(0x59634c);
  const skyNight = new THREE.Color(0x849bcd), skyDay = new THREE.Color(0xc4ddff);
  const white = new THREE.Color(0xffffff);
  // Heart, "the Drained Tide": always golden hour. Rose-gold horizon, violet zenith, pink haze; a crimson
  // storm in chaos. Once the Tide Sigil restores the current, the haze thins and the air clears.
  const heartZenith = new THREE.Color(0x5a3478).convertSRGBToLinear(), heartHorizon = new THREE.Color(0xffa27e).convertSRGBToLinear();
  const heartFog = new THREE.Color(0xc98593), heartClearFog = new THREE.Color(0xe3b7ad), roseSun = new THREE.Color(0xffa080);
  const heartStormFog = new THREE.Color(0x5a1622), heartStormZenith = new THREE.Color(0x2a0710).convertSRGBToLinear();
  const heartStormHorizon = new THREE.Color(0x7a1828).convertSRGBToLinear();
  const duskSun = new THREE.Vector3(0.82, 0.16, -0.55).normalize(); // Heart's sun hangs low, whatever the hour
  const E = CONFIG.evil;
  const evilZenith = new THREE.Color(E.zenith).convertSRGBToLinear(), evilHorizon = new THREE.Color(E.horizon).convertSRGBToLinear();
  const evilFog = new THREE.Color(E.fog), evilLight = new THREE.Color(E.light);
  const evilHemiSky = new THREE.Color(E.hemiSky), evilHemiGround = new THREE.Color(E.hemiGround);
  let time = 0, lastHour = null, vortexPhase = 0;

  return {
    prepare: lighting.prepare,
    // indoors (0–1): inside an enclosed hall, where sky reflections (the environment light) are mostly blocked.
    update(dt, visual, camera, { hour = 9, rift = 0, indoors = 0, heartRestored = false } = {}) {
      time += dt;
      const look = sampleLook(visual);
      const dry = diamondClimateAt(camera.position.x, camera.position.z);
      const lush = heartClimateAt(camera.position.x, camera.position.z);
      const flash = weather.update(dt, visual, camera.position, { desert: dry, heart: lush, indoors });
      const climate = spadeClimateAt(camera.position.x, camera.position.z);
      // Spade cannot become sunny while its full snow climate is being added.
      const day = sampleDaylight(hour, climate);
      if (lush > 0) { // Heart holds the world at golden hour, as Spade holds it at night
        const mix = (a, b) => a + (b - a) * lush;
        const s = new THREE.Vector3(day.sun.x, day.sun.y, day.sun.z).lerp(duskSun, lush).normalize();
        day.sun = { x: s.x, y: s.y, z: s.z };
        day.daylight = mix(day.daylight, 0.6); day.twilight = mix(day.twilight, 0.85);
        day.sunIntensity = mix(day.sunIntensity, 1.35); day.moonIntensity = mix(day.moonIntensity, 0);
        day.ambientIntensity = mix(day.ambientIntensity, 0.95); day.stars = mix(day.stars, 0.08);
      }
      const storm = visual * 0.8;
      const u = sky.uniforms;
      u.uZenith.value.copy(zenithNight).lerp(zenithDay, day.daylight).lerp(stormSky, storm * 0.65);
      u.uHorizon.value.copy(horizonNight).lerp(horizonDay, day.daylight).lerp(sunset, day.twilight * 0.65).lerp(stormSky, storm * 0.6);
      u.uSunDirection.value.set(day.sun.x, day.sun.y, day.sun.z);
      u.uDaylight.value = day.daylight;
      u.uTwilight.value = day.twilight;
      u.uStars.value = day.stars * (1 - storm);
      u.uTime.value = time;
      u.uCloudCover.value = THREE.MathUtils.lerp(0.38 + storm * 0.6, 0.95, climate);
      u.uStorm.value = storm;
      u.uFlash.value = flash;
      sky.update(camera);
      scene.background = null;
      scene.fog.color.copy(fogNight).lerp(fogDay, day.daylight).lerp(fogDusk, day.twilight * 0.6).lerp(fogStorm, storm * day.daylight);
      // Preserve the landmark passes' reduced fog density.
      scene.fog.density = Math.min(scene.fog.density, 0.006 + storm * 0.014);
      scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, Math.min(scene.fog.density, 0.0048 + visual * 0.0015), climate);
      u.uFogColor.value.copy(scene.fog.color);
      sun.target.position.copy(camera.position);
      sun.position.copy(camera.position).addScaledVector(u.uSunDirection.value, 100);
      sun.color.copy(noonSun).lerp(warmSun, day.twilight);
      sun.intensity = day.sunIntensity * (1 - storm * 0.7);
      moon.target.position.copy(camera.position);
      moon.position.copy(camera.position).addScaledVector(u.uSunDirection.value, -100);
      moon.intensity = day.moonIntensity * (1 - storm * 0.65);
      if (dry > 0) {
        const storming = dry * Math.min(1, visual * 1.5);
        scene.fog.color.lerp(desertHaze, dry * 0.55 * day.daylight).lerp(sandstorm, storming);
        scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, 0.006 + visual * 0.022, storming);
        u.uHorizon.value.lerp(desertHorizon, dry * 0.4 * day.daylight);
        u.uZenith.value.lerp(sandstorm, storming * 0.45 * day.daylight);
        u.uHorizon.value.lerp(desertHorizon, storming * 0.65 * day.daylight);
        u.uFogColor.value.copy(scene.fog.color);
        sun.color.lerp(warmSun, dry * 0.35);
      }
      if (lush > 0) {
        const calm = lush * (1 - storm);
        u.uZenith.value.lerp(heartZenith, calm * 0.7).lerp(heartStormZenith, lush * storm);
        u.uHorizon.value.lerp(heartHorizon, calm * 0.75).lerp(heartStormHorizon, lush * storm * 0.8);
        scene.fog.color.lerp(heartRestored ? heartClearFog : heartFog, calm * 0.7).lerp(heartStormFog, lush * storm);
        scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, (heartRestored ? 0.005 : 0.0085) + storm * 0.01, lush);
        u.uFogColor.value.copy(scene.fog.color);
        sun.color.lerp(roseSun, lush * 0.6);
      }
      u.uHeart.value = lush;
      hemi.color.copy(skyNight).lerp(skyDay, day.daylight);
      hemi.groundColor.copy(groundNight).lerp(groundDay, day.daylight);
      hemi.intensity = day.ambientIntensity * (1 - storm * 0.4) + flash * 1.2;
      renderer.toneMappingExposure = 1.05 - storm * 0.13;
      // Evil mode: red-black sky and fog, one red key light from whichever body is up, almost no ambient.
      const evil = THREE.MathUtils.smoothstep(visual, E.start, E.full);
      if (evil > 0) {
        u.uZenith.value.lerp(evilZenith, evil);
        u.uHorizon.value.lerp(evilHorizon, evil);
        u.uStars.value *= 1 - evil;
        scene.fog.color.lerp(evilFog, evil);
        u.uFogColor.value.copy(scene.fog.color);
        const sunUp = day.sun.y > 0;
        sun.color.lerp(evilLight, evil);
        moon.color.lerp(evilLight, evil);
        sun.intensity = THREE.MathUtils.lerp(sun.intensity, sunUp ? E.lightIntensity : 0, evil);
        moon.intensity = THREE.MathUtils.lerp(moon.intensity, sunUp ? 0 : E.lightIntensity, evil);
        hemi.color.lerp(evilHemiSky, evil);
        hemi.groundColor.lerp(evilHemiGround, evil);
        hemi.intensity = THREE.MathUtils.lerp(hemi.intensity, E.hemiIntensity + flash * 1.6, evil);
        renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, E.exposure, evil);
      }
      u.uEvil.value = evil;
      // The rift spins slowly in calm and churns in evil mode; the phase accumulates so speed changes never jump.
      vortexPhase += dt * (.12 + evil * .9);
      u.uVortex.value = riftStrength(rift, evil);
      u.uVortexPhase.value = vortexPhase;
      u.uVortexDir.value.set(RIFT.x - camera.position.x, RIFT.y - camera.position.y, RIFT.z - camera.position.z).normalize();
      const signature = [Math.floor(hour * 2), Math.round(day.daylight * 20), Math.round(day.twilight * 10), Math.round(storm * 10), Math.round(climate * 10)].join(':');
      const jumped = lastHour !== null && Math.abs(hour - lastHour) > 0.25;
      lighting.update(true, (0.28 + day.daylight * 0.52) * (1 - 0.85 * indoors), dt, signature, jumped || lastHour === null);
      lastHour = hour;
      if (CONFIG.tintGround) for (const chunk of chunks.values()) {
        chunk.userData.material.color.copy(white).lerp(look.groundTint, look.groundTintAmount);
      }
    },
    reset() { time = 0; lastHour = null; vortexPhase = 0; weather.reset(); },
  };
}
