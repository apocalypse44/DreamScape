// rendering/chaosWeather.js  - Phase 4, DEV_PHASES 4.6
// Ember rain + ash that fade in with chaos, and lightning flashes above 0.8.
// Particles are wrapped around the player on the GPU (no per-frame CPU loop).
const THREE = window.THREE; // the game loads three.js r128 as a global <script>

const vert = /* glsl */`
  uniform vec3 uCenter;
  uniform float uTime, uSize, uBox, uHeight, uFall, uWind;
  attribute float aSeed;
  varying float vFade;
  void main() {
    vec3 p = position;
    p.y -= uTime * uFall * (0.6 + aSeed);
    p.x += uTime * uWind + sin(uTime * 0.7 + aSeed * 40.0) * 1.2;
    p.z += cos(uTime * 0.5 + aSeed * 30.0) * 1.2;
    vec3 hb = vec3(uBox, uHeight, uBox) * 0.5;
    vec3 rel = mod(p - uCenter + hb, vec3(uBox, uHeight, uBox)) - hb; // wrap around player
    vec4 mv = viewMatrix * vec4(uCenter + rel, 1.0);
    gl_PointSize = uSize * (0.5 + aSeed) * (300.0 / max(-mv.z, 0.1));
    gl_Position = projectionMatrix * mv;
    vFade = 1.0 - smoothstep(0.6, 1.0, length(rel.xz) / (uBox * 0.5));
  }
`;

const frag = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * uOpacity * vFade);
  }
`;

function makeLayer({ count, color, size, fall, wind, additive, box = 70, height = 35 }) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * box;
    pos[i * 3 + 1] = (Math.random() - 0.5) * height;
    pos[i * 3 + 2] = (Math.random() - 0.5) * box;
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Vector3() }, uTime: { value: 0 },
      uSize: { value: size }, uBox: { value: box }, uHeight: { value: height },
      uFall: { value: fall }, uWind: { value: wind },
      uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 },
    },
    vertexShader: vert, fragmentShader: frag,
    transparent: true, depthWrite: false, fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

/**
 * const weather = createChaosWeather(scene);
 * each frame: const flash = weather.update(dt, visualScore, player.position);
 * then pass `flash` to applyLook(...).
 */
export function createChaosWeather(scene, opts = {}) {
  const embers = makeLayer({ count: opts.embers ?? 900, color: 0xff7a2a, size: 0.9, fall: 1.2, wind: 0.6, additive: true });
  const ash = makeLayer({ count: opts.ash ?? 1400, color: 0x5a524c, size: 0.7, fall: 0.6, wind: 1.0, additive: false });
  scene.add(embers, ash);

  let time = 0, nextFlash = 3, flashT = -1;
  // two-strike flash shape (seconds, strength)
  const shape = [[0, 0], [0.05, 1], [0.12, 0.2], [0.2, 0.9], [0.5, 0]];
  const sampleFlash = (x) => {
    for (let i = 1; i < shape.length; i++) {
      if (x <= shape[i][0]) {
        const [x0, y0] = shape[i - 1], [x1, y1] = shape[i];
        return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
      }
    }
    return 0;
  };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  return {
    embers, ash,
    /** @returns lightning flash 0..1 */
    update(dt, score, center) {
      time += dt;
      for (const layer of [embers, ash]) {
        const u = layer.material.uniforms;
        u.uTime.value = time;
        u.uCenter.value.copy(center);
      }
      embers.material.uniforms.uOpacity.value = 0.9 * smooth(0.45, 0.9, score);
      ash.material.uniforms.uOpacity.value = 0.55 * smooth(0.55, 1.0, score);
      embers.visible = embers.material.uniforms.uOpacity.value > 0.001;
      ash.visible = ash.material.uniforms.uOpacity.value > 0.001;

      // lightning above 0.8
      if (score < 0.8) { nextFlash = Math.max(nextFlash, time + 1); }
      else if (flashT < 0 && time >= nextFlash) { flashT = 0; nextFlash = time + 4 + Math.random() * 6; }
      let flash = 0;
      if (flashT >= 0) {
        flashT += dt;
        flash = sampleFlash(flashT);
        if (flashT > 0.5) flashT = -1;
      }
      return flash;
    },
    /** R reset */
    reset() { time = 0; nextFlash = 3; flashT = -1; },
  };
}
