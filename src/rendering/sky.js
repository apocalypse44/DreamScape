// Procedural sky: the celestial bodies share world-space directions with the lights.
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
  uniform float uDaylight, uTwilight, uStars, uTime, uCloudCover, uStorm, uFlash, uCapture;
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
    if (d.y > 0.0) {
      vec2 cloudPoint = d.xz / (altitude + 0.22) * 2.8;
      cloudPoint += vec2(uTime * 0.006, uTime * 0.002) * (1.0 + uStorm * 4.0);
      float n = clouds(cloudPoint);
      float cloud = smoothstep(0.75 - uCloudCover * 0.45, 0.9 - uCloudCover * 0.4, n);
      cloud *= smoothstep(0.0, 0.12, d.y);
      vec3 cloudColor = mix(vec3(0.025, 0.035, 0.065), vec3(0.92, 0.94, 1.0), uDaylight);
      cloudColor = mix(cloudColor, vec3(0.08, 0.09, 0.13), uStorm * 0.8);
      cloudColor += vec3(0.42, 0.12, 0.025) * uTwilight * pow(max(sunDot, 0.0), 3.0);
      col = mix(col, cloudColor * (0.72 + n * 0.3), cloud * 0.96);
    }
    col += vec3(0.35, 0.42, 0.6) * uFlash;
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
