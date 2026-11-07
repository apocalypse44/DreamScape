// Ember rain outside Diamond; dense, windblown sand inside its desert climate.
// Particles are wrapped around the player on the GPU (no per-frame CPU loop).

const vert = /* glsl */`
  uniform vec3 uCenter;
  uniform float uTime, uSize, uBox, uHeight, uFall, uWind;
  uniform vec2 uDrift;
  uniform float uSand;
  attribute float aSeed;
  varying float vFade;
  varying float vSeed;
  void main() {
    vec3 p = position;
    p.y -= uTime * uFall * (0.6 + aSeed);
    p.x += uTime * uWind + sin(uTime * 0.7 + aSeed * 40.0) * 1.2;
    p.z += cos(uTime * 0.5 + aSeed * 30.0) * 1.2;
    p.xz += uDrift;
    p.y += uSand * sin(uTime * 1.8 + aSeed * 60.0) * 0.7;
    vec3 hb = vec3(uBox, uHeight, uBox) * 0.5;
    vec3 rel = mod(p - uCenter + hb, vec3(uBox, uHeight, uBox)) - hb; // wrap around player
    vec4 mv = viewMatrix * vec4(uCenter + rel, 1.0);
    gl_PointSize = uSize * (0.5 + aSeed) * (300.0 / max(-mv.z, 0.1));
    if (uSand > 0.5) gl_PointSize = clamp(gl_PointSize, 1.0, 4.0);
    gl_Position = projectionMatrix * mv;
    vFade = 1.0 - smoothstep(0.6, 1.0, length(rel.xz) / (uBox * 0.5));
    if (uSand > 0.5) vFade *= smoothstep(0.8, 2.5, -mv.z);
    vSeed = aSeed;
  }
`;

const frag = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSand;
  varying float vFade;
  varying float vSeed;
  void main() {
    vec2 grain = gl_PointCoord - 0.5;
    grain.y *= 1.0 + uSand * 0.8;
    float d = length(grain);
    if (d > 0.5) discard;
    vec3 color = uColor * mix(1.0, 0.75 + vSeed * 0.35, uSand);
    gl_FragColor = vec4(color, (1.0 - smoothstep(0.08, 0.5, d)) * uOpacity * vFade);
  }
`;

function makeLayer({ count, color, size, fall, wind, additive, box = 70, height = 35, sand = false }) {
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
      uDrift: { value: new THREE.Vector2() }, uSand: { value: sand ? 1 : 0 },
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

export function createChaosWeather(scene, opts = {}) {
  const embers = makeLayer({ count: opts.embers ?? 900, color: 0xff7a2a, size: 0.9, fall: 1.2, wind: 0.6, additive: true });
  const ash = makeLayer({ count: opts.ash ?? 1400, color: 0x5a524c, size: 0.7, fall: 0.6, wind: 1.0, additive: false });
  // Two depths keep fine sand all around the camera without large glowing flakes.
  // Both layers animate on the GPU and use normal alpha blending.
  const sand = makeLayer({ count: opts.sand ?? 18000, color: 0xd8b77e, size: 0.075, fall: 0.25, wind: 0, additive: false, box: 48, height: 22, sand: true });
  const sandFar = makeLayer({ count: opts.sandFar ?? 10000, color: 0xb99a69, size: 0.11, fall: 0.15, wind: 0, additive: false, box: 100, height: 40, sand: true });
  scene.add(embers, ash, sand, sandFar);
  const layers = [embers, ash, sand, sandFar];
  for (const layer of layers) layer.visible = false;

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
    embers, ash, sand, sandFar,
    /** @returns lightning flash 0..1 */
    update(dt, score, center, { desert = 0, indoors = 0 } = {}) {
      time += dt;
      for (const layer of layers) {
        const u = layer.material.uniforms;
        u.uTime.value = time;
        u.uCenter.value.copy(center);
      }
      const outside = 1 - Math.min(1, Math.max(0, indoors));
      embers.material.uniforms.uOpacity.value = 0.9 * smooth(0.45, 0.9, score) * (1 - desert) * outside;
      ash.material.uniforms.uOpacity.value = 0.55 * smooth(0.55, 1.0, score) * (1 - desert) * outside;
      const strength = smooth(0.25, 0.85, score);
      const gust = 0.82 + 0.18 * Math.sin(time * 0.75 + Math.sin(time * 0.23));
      sand.material.uniforms.uOpacity.value = desert * outside * (0.09 + strength * 0.63) * gust;
      sandFar.material.uniforms.uOpacity.value = desert * outside * (0.06 + strength * 0.39) * gust;
      for (const layer of [sand, sandFar]) {
        const u = layer.material.uniforms;
        const speed = (3 + strength * 15) * gust;
        u.uDrift.value.x = (u.uDrift.value.x + dt * speed) % u.uBox.value;
        u.uDrift.value.y = (u.uDrift.value.y + dt * speed * 0.32) % u.uBox.value;
      }
      for (const layer of layers) layer.visible = layer.material.uniforms.uOpacity.value > 0.001;

      if (score < 0.8) { nextFlash = Math.max(nextFlash, time + 1); }
      else if (flashT < 0 && time >= nextFlash) { flashT = 0; nextFlash = time + 4 + Math.random() * 6; }
      let flash = 0;
      if (flashT >= 0) {
        flashT += dt;
        flash = sampleFlash(flashT);
        if (flashT > 0.5) flashT = -1;
      }
      return flash * (1 - desert * 0.85) * outside;
    },
    reset() {
      time = 0; nextFlash = 3; flashT = -1;
      for (const layer of layers) {
        layer.material.uniforms.uDrift.value.set(0, 0);
        layer.material.uniforms.uOpacity.value = 0;
        layer.visible = false;
      }
    },
  };
}
