// Procedural sky: the celestial bodies share world-space directions with the lights.
import { CONFIG } from '../models/chaosLookConfig.js';
const vertexShader = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 uZenith, uHorizon, uFogColor, uSunDirection;
  uniform float uDaylight, uTwilight, uStars, uTime, uCloudCover, uStorm, uFlash, uCapture, uEvil;
  uniform vec3 uEvilClouds, uEvilFlash;
  uniform float uVortex, uVortexPhase;
  uniform vec3 uVortexDir;
  varying vec3 vDir;
  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(vec3(i, 0.0)), hash(vec3(i + vec2(1,0), 0.0)), f.x),
               mix(hash(vec3(i + vec2(0,1), 0.0)), hash(vec3(i + vec2(1,1), 0.0)), f.x), f.y);
  }
  float clouds(vec2 p) {
    return noise(p) * 0.57 + noise(p * 2.03) * 0.28 + noise(p * 4.09) * 0.15;
  }
  // Cloud cover and density looking along sky direction s (|y| so a warped look below the horizon mirrors).
  vec2 cloudAt(vec3 s) {
    vec2 p = s.xz / (abs(s.y) + 0.22) * 2.8;
    p += vec2(uTime * 0.006, uTime * 0.002) * (1.0 + uStorm * 4.0);
    float n = clouds(p);
    return vec2(smoothstep(0.75 - uCloudCover * 0.45, 0.9 - uCloudCover * 0.4, n), n);
  }
  // How strongly the rift pulls at direction d: full at its centre, gone ~70° away.
  float riftPull(vec3 d) {
    return uVortex * (1.0 - smoothstep(0.0, 1.25, acos(clamp(dot(d, uVortexDir), -1.0, 1.0))));
  }
  // The rift sucks the sky in: look further out from its centre (the sky near it is stretched inward) and
  // twist around its axis. flow (0..1) pushes the look outward and turns it, so clouds stream in along spirals.
  vec3 riftWarp(vec3 d, float flow) {
    float axial = clamp(dot(d, uVortexDir), -1.0, 1.0);
    vec3 perp = d - uVortexDir * axial;
    if (dot(perp, perp) < 1e-6) return d;
    float ang = acos(axial), pull = uVortex * (1.0 - smoothstep(0.0, 1.25, ang));
    vec3 radial = normalize(perp), tangent = cross(uVortexDir, radial);
    float reach = min(ang * (1.0 + 1.6 * pull) + flow * 0.45 * pull, 3.0);
    float twist = pull * (3.5 + flow * 1.4);
    return uVortexDir * cos(reach) + (radial * cos(twist) + tangent * sin(twist)) * sin(reach);
  }
  void main() {
    vec3 d = normalize(vDir);
    float altitude = max(d.y, 0.0);
    vec3 col = mix(uHorizon, uZenith, pow(altitude, 0.48));
    float sunDot = clamp(dot(d, uSunDirection), -1.0, 1.0);
    float moonDot = clamp(dot(d, -uSunDirection), -1.0, 1.0);
    float aboveHorizon = smoothstep(-0.015, 0.025, d.y);
    col += vec3(0.85, 0.22, 0.055) * uTwilight * pow(max(sunDot, 0.0), 7.0);
    col += vec3(1.0, 0.72, 0.34) * pow(max(sunDot, 0.0), 90.0) * uDaylight * 0.3;
    float sunDisc = smoothstep(0.99965, 0.99987, sunDot);
    col += mix(vec3(3.0, 0.65, 0.16), vec3(5.0, 4.2, 2.8), uDaylight)
      * sunDisc * aboveHorizon * (1.0 - uCloudCover * 0.8) * uDaylight;
    float moonDisc = smoothstep(0.9995, 0.99975, moonDot);
    float craters = 0.7 + hash(floor(d * 620.0)) * 0.3;
    col += vec3(0.6, 0.72, 1.0) * (moonDisc * craters * 1.5
      + pow(max(moonDot, 0.0), 120.0) * 0.09) * uStars * aboveHorizon;
    // Direction cells avoid the dense pole seam of an equirectangular star field.
    vec3 starCell = floor(d * 340.0);
    float starSeed = hash(starCell);
    float star = step(0.9975, starSeed) * pow(max(0.0, 1.0 - length(fract(d * 340.0) - 0.5)), 4.0);
    col += mix(vec3(0.7, 0.82, 1.0), vec3(1.0, 0.86, 0.65), starSeed)
      * star * uStars * aboveHorizon * (0.75 + 0.25 * sin(uTime * 1.3 + starSeed * 90.0));
    // Three noise octaves keep animated clouds inexpensive.
    float pull = riftPull(d);
    col *= 1.0 - pull * 0.35;                         // the rift drains light from the sky around it
    if (d.y > 0.0) {
      // Near the rift the clouds are sampled through its warp. Two flows half a cycle apart cross-fade, each
      // resetting while invisible, so the inflow never ends and the spiral never winds tighter over time.
      vec2 cn = cloudAt(d);
      if (pull > 0.001) {
        float f1 = fract(uVortexPhase * 0.25), f2 = fract(f1 + 0.5), w1 = 1.0 - abs(2.0 * f1 - 1.0);
        cn = cloudAt(riftWarp(d, f1)) * w1 + cloudAt(riftWarp(d, f2)) * (1.0 - w1);
      }
      float n = cn.y;
      float cloud = cn.x * smoothstep(0.0, 0.12, d.y);
      vec3 cloudColor = mix(vec3(0.025, 0.035, 0.065), vec3(0.92, 0.94, 1.0), uDaylight);
      cloudColor = mix(cloudColor, vec3(0.08, 0.09, 0.13), uStorm * 0.8);
      cloudColor = mix(cloudColor, uEvilClouds, uEvil);
      cloudColor = mix(cloudColor, vec3(0.5, 0.06, 0.05), pull * 0.6);   // clouds redden as they are drawn in
      cloudColor += vec3(0.42, 0.12, 0.025) * uTwilight * pow(max(sunDot, 0.0), 3.0);
      col = mix(col, cloudColor * (0.72 + n * 0.3), cloud * 0.96);
    }
    // Hollow Gate rift: a vortex fixed above Spade castle (models/rift.js). Sky directions are projected
    // stereographically around its axis so it stays round; three log-spiral arms wind into a dark eye.
    float vortexDot = dot(d, uVortexDir);
    if (uVortex > 0.001 && vortexDot > 0.0) {
      vec3 side = normalize(cross(uVortexDir, abs(uVortexDir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
      vec2 p = vec2(dot(d, side), dot(d, cross(uVortexDir, side))) / (1.0 + vortexDot);
      float r = length(p) / 0.26;                                        // 1 at the rim, ~29° from the centre
      float swirl = atan(p.y, p.x) + 2.6 * log(r + 0.04) - uVortexPhase;
      float arms = 0.5 + 0.5 * sin(3.0 * swirl + noise(p * 9.0 + uVortexPhase * 0.3) * 2.5);
      float disk = 1.0 - smoothstep(0.55, 1.0, r);
      float eye = 1.0 - smoothstep(0.08, 0.22, r);
      float ringOffset = (r - 0.24) / 0.07;
      float ring = exp(-ringOffset * ringOffset);                        // not pow(): undefined for a negative base
      vec3 armColor = mix(vec3(0.8, 0.07, 0.04), vec3(0.42, 0.07, 0.6), smoothstep(0.25, 0.9, r)); // red in, violet out
      vec3 vortex = armColor * arms * arms * disk * 1.6 + vec3(1.0, 0.32, 0.12) * ring * 1.3;
      float show = uVortex * aboveHorizon;
      col = mix(col, vec3(0.012, 0.0, 0.006), eye * show);               // the eye swallows the light
      col += vortex * show;
    }
    col += mix(vec3(0.35, 0.42, 0.6), uEvilFlash, uEvil) * uFlash;
    float horizonFog = 1.0 - smoothstep(0.0, 0.14, altitude);
    if (uCapture > 0.5) col = mix(col, pow(uFogColor, vec3(2.2)), horizonFog * 0.85);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    // Match r128 fog, which is applied after output encoding.
    if (uCapture < 0.5) gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, horizonFog * 0.85);
  }
`;

export function createSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uFogColor: { value: new THREE.Color() }, uSunDirection: { value: new THREE.Vector3() },
    uDaylight: { value: 1 }, uTwilight: { value: 0 }, uStars: { value: 0 },
    uTime: { value: 0 }, uCloudCover: { value: 0.4 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uCapture: { value: 0 },
    uVortex: { value: 0 }, uVortexPhase: { value: 0 }, uVortexDir: { value: new THREE.Vector3(0, 1, 0) },
    uEvil: { value: 0 }, uEvilClouds: { value: new THREE.Vector3(...CONFIG.evil.clouds) }, uEvilFlash: { value: new THREE.Vector3(...CONFIG.evil.flash) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, side: THREE.BackSide,
    depthWrite: false, depthFunc: THREE.LessEqualDepth, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), material);
  mesh.name = 'SkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return {
    mesh, uniforms,
    update(camera) { mesh.position.copy(camera.position); },
    dispose() { mesh.geometry.dispose(); material.dispose(); },
  };
}
