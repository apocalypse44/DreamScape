// rendering/sky.js  - Phase 4, DEV_PHASES 4.1 / 4.2 / 4.3
// Sky dome that replaces `scene.background = skyTexture`.
// - samples two equirect HDRIs (calm + chaos) and blends them with uMix
// - tint / saturation / brightness uniforms
// - blends the fog color into the horizon so red chaos fog is actually seen
//
// Three.js r128.
const THREE = window.THREE; // the game loads three.js r128 as a global <script>

const vertexShader = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;                       // dome is centred on the camera
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;                  // depth = far plane: always behind everything
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D uCalm;
  uniform sampler2D uChaos;
  uniform float uMix, uSaturation, uBrightness, uRotation;
  uniform vec3  uTint;
  uniform vec3  uFogColor;
  uniform float uFogAmount, uFogHeight;
  varying vec3 vDir;

  // Same mapping three.js uses for EquirectangularReflectionMapping,
  // so the dome lines up with the old scene.background.
  vec2 skyUv(vec3 d) {
    float u = atan(d.z, d.x) * 0.15915494 + 0.5;
    float v = asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5;
    return vec2(u, v);                     // upside down? use 1.0 - v
  }

  void main() {
    vec3 d = normalize(vDir);
    float c = cos(uRotation), s = sin(uRotation);
    vec3 r = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
    vec2 uv = skyUv(r);

    vec3 col = mix(texture2D(uCalm, uv).rgb, texture2D(uChaos, uv).rgb, uMix);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSaturation) * uTint * uBrightness;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>

    // three.js applies scene fog AFTER tone mapping/encoding, so do the same:
    // the horizon now matches the fogged terrain exactly.
    float h = clamp(1.0 - max(d.y, 0.0) / uFogHeight, 0.0, 1.0);
    h *= h;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, h * uFogAmount);
  }
`;

/**
 * @param {THREE.Texture} calm   the day HDRI texture hdri.js already loads
 * @param {THREE.Texture} [chaos] stormy / sunset HDRI (Phase 1). Defaults to calm.
 */
export function createSky({ calm, chaos = calm, rotation = 0 } = {}) {
  const uniforms = {
    uCalm: { value: calm },
    uChaos: { value: chaos },
    uMix: { value: 0 },
    uSaturation: { value: 1 },
    uBrightness: { value: 1 },
    uRotation: { value: rotation },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uFogColor: { value: new THREE.Color(0.75, 0.82, 0.9) },
    uFogAmount: { value: 0.2 },
    uFogHeight: { value: 0.25 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    fog: false,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), material);
  mesh.name = 'SkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  return {
    mesh,
    uniforms,
    setChaosTexture(tex) { uniforms.uChaos.value = tex; },
    setCalmTexture(tex) { uniforms.uCalm.value = tex; },
    /** call every frame before render */
    update(camera) { mesh.position.copy(camera.position); },
    dispose() { mesh.geometry.dispose(); material.dispose(); },
  };
}

/**
 * 4.2: swap the PMREM environment (reflections) at mix > 0.5, with hysteresis.
 * calmEnv / chaosEnv = pmremGenerator.fromEquirectangular(tex).texture
 */
export function createEnvSwitcher(scene, calmEnv, chaosEnv) {
  let chaosOn = false;
  return (mix) => {
    if (!chaosEnv) return;
    if (!chaosOn && mix > 0.55) { scene.environment = chaosEnv; chaosOn = true; }
    else if (chaosOn && mix < 0.45) { scene.environment = calmEnv; chaosOn = false; }
  };
}
