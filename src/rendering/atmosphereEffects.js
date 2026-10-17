// Final atmosphere pass. Time owns celestial lighting; chaos changes the air.
import { CONFIG } from '../models/chaosLookConfig.js';
import { sampleLook } from '../models/look.js';
import { sampleDaylight } from '../models/daylight.js';
import { spadeClimateAt } from '../models/climate.js';
import { createSky } from './sky.js';
import { createChaosWeather } from './chaosWeather.js';
import { createEnvironmentLighting } from './environmentLighting.js';

export function createAtmosphereEffects({ renderer, scene, sun, hemi, chunks, materialProfiles }) {
  const sky = createSky();
  sky.mesh.visible = false;
  scene.add(sky.mesh);
  const lighting = createEnvironmentLighting({ scene, renderer, profiles: materialProfiles, sky });
  const weather = createChaosWeather(scene, CONFIG.weather);
  const moon = new THREE.DirectionalLight(0x9fbaff, 0);
  moon.name = 'Moonlight';
  scene.add(moon, moon.target);
  scene.add(sun.target);
  const originalSunPosition = sun.position.clone();
  const originalSunTarget = sun.target.position.clone();
  const originalGround = hemi.groundColor.clone();
  const zenithNight = new THREE.Color(0x030817).convertSRGBToLinear();
  const zenithDay = new THREE.Color(0x3285d1).convertSRGBToLinear();
  const horizonNight = new THREE.Color(0x121d35).convertSRGBToLinear();
  const horizonDay = new THREE.Color(0xb4dbef).convertSRGBToLinear();
  const sunset = new THREE.Color(0xe68859).convertSRGBToLinear();
  const stormSky = new THREE.Color(0x222c41).convertSRGBToLinear();
  const fogDay = new THREE.Color(0xa9c6d4), fogNight = new THREE.Color(0x101a2c);
  const fogDusk = new THREE.Color(0xa67d79), fogStorm = new THREE.Color(0x303b4a);
  const warmSun = new THREE.Color(0xffb46e), noonSun = new THREE.Color(0xfff2d9);
  const groundNight = new THREE.Color(0x111a2d), groundDay = new THREE.Color(0x59634c);
  const skyNight = new THREE.Color(0x849bcd), skyDay = new THREE.Color(0xc4ddff);
  const white = new THREE.Color(0xffffff);
  let time = 0, lastHour = null, wasEnabled = false;

  return {
    prepare: lighting.prepare,
    update(dt, visual, camera, { enabled = false, hour = 9, biome = null } = {}) {
      time += dt;
      const look = sampleLook(visual);
      const flash = weather.update(dt, visual, camera.position);
      const climate = spadeClimateAt(camera.position.x, camera.position.z);
      sky.mesh.visible = enabled;
      if (!enabled) {
        moon.intensity = 0;
        sun.position.copy(originalSunPosition);
        sun.target.position.copy(originalSunTarget);
        sun.castShadow = true;
        hemi.groundColor.copy(originalGround);
        // Original mode keeps its movement-driven atmosphere.
        const k = CONFIG.lookStrength * visual;
        scene.fog.density += (look.fogDensity - scene.fog.density) * k;
        renderer.toneMappingExposure += (look.exposure - renderer.toneMappingExposure) * k;
        sun.color.lerp(look.sunColor, k);
        sun.intensity += (look.sunIntensity - sun.intensity) * k;
        hemi.color.lerp(look.hemiSky, k);
        hemi.groundColor.lerp(look.hemiGround, k);
        hemi.intensity += (look.hemiIntensity - hemi.intensity) * k + flash * 3;
        sun.intensity *= 1 - climate;
        hemi.intensity += (0.3 - hemi.intensity) * climate;
        hemi.color.lerp(skyNight, climate);
        hemi.groundColor.lerp(groundNight, climate);
        scene.fog.color.lerp(fogNight, climate);
        lighting.update(false, 0, dt, '');
        wasEnabled = false;
      } else {
        // Spade cannot become sunny while its full snow climate is being added.
        const day = sampleDaylight(hour, climate);
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
        hemi.color.copy(skyNight).lerp(skyDay, day.daylight);
        hemi.groundColor.copy(groundNight).lerp(groundDay, day.daylight);
        hemi.intensity = day.ambientIntensity * (1 - storm * 0.4) + flash * 1.2;
        renderer.toneMappingExposure = 1.05 - storm * 0.13;
        const signature = [Math.floor(hour * 2), Math.round(day.daylight * 20), Math.round(day.twilight * 10), Math.round(storm * 10), Math.round(climate * 10)].join(':');
        const jumped = lastHour !== null && Math.abs(hour - lastHour) > 0.25;
        lighting.update(true, 0.28 + day.daylight * 0.52, dt, signature, jumped || !wasEnabled);
        lastHour = hour;
        wasEnabled = true;
      }
      if (CONFIG.tintGround) for (const chunk of chunks.values()) {
        chunk.userData.material.color.copy(white).lerp(look.groundTint, look.groundTintAmount);
      }
    },
    reset() { time = 0; lastHour = null; wasEnabled = false; weather.reset(); },
  };
}
