// Kamui warp: a screen-space space-time vortex (after Kakashi's Kamui in Naruto), used for the Sky
// Garden gateway and the curse / cure moments.
//
// It is domain warping applied to the rendered image instead of the terrain: each output pixel looks
// the scene up somewhere else, colour(p) = scene(warp(p)). warp() rotates p around the vortex centre by
// an angle that grows toward the centre (a swirl), pulls it inward (a pinch), and adds an fBm offset so
// the spiral arms tear instead of staying perfectly smooth. A dark core, a violet rim and radial
// chromatic aberration finish the look.
//
// Pipeline: the scene is rendered normally, the frame is copied into a texture
// (copyFramebufferToTexture, already tone-mapped and sRGB), then one full-screen quad draws the warped
// copy. Nothing extra runs while the effect is off.
const VERTEX = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAGMENT = `
uniform sampler2D tScene;
uniform vec2 uCenter;     // vortex centre in UV
uniform float uAspect;    // width / height
uniform float uStrength;  // 0 = off, 1 = full vortex
uniform float uTime;
uniform float uReach;    // vortex size: 0.8 local, 1.3 covers the whole screen
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * noise(p) + 0.3 * noise(p * 2.03 + 7.1) + 0.2 * noise(p * 4.01 - 3.7); }
vec2 rotate(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

void main() {
  vec2 p = vUv - uCenter;
  p.x *= uAspect;                                   // work in square units so the vortex is round
  float r = length(p);
  float k = uReach / 0.8;                           // size factor relative to the local vortex
  float reach = uReach * (0.3 + 0.7 * uStrength);   // vortex radius grows with strength
  float fall = 1.0 - smoothstep(0.0, reach, r);     // 1 at the centre, 0 outside
  // Domain warp: fBm turbulence that itself spins, so the arms shear apart.
  float turbulence = fbm(rotate(p, uTime * 0.8) * 6.0 + uTime * 0.5) - 0.5;
  float angle = uStrength * fall * fall * (7.0 + 3.0 * turbulence) + uStrength * 0.6 * fall * sin(uTime * 3.0 + r * 18.0);
  vec2 q = rotate(p, angle);
  q *= 1.0 - 0.55 * uStrength * fall;               // pinch: space is sucked toward the centre
  q += uStrength * fall * 0.04 * vec2(fbm(p * 9.0 + uTime), fbm(p * 9.0 - uTime) - 0.5);
  q.x /= uAspect;
  vec2 uv = uCenter + q;
  // Chromatic aberration along the radius, strongest inside the vortex.
  vec2 radial = normalize(p + 1e-5) / vec2(uAspect, 1.0) * 0.012 * uStrength * fall;
  vec3 colour = vec3(texture2D(tScene, clamp(uv + radial, 0.0, 1.0)).r,
                     texture2D(tScene, clamp(uv, 0.0, 1.0)).g,
                     texture2D(tScene, clamp(uv - radial, 0.0, 1.0)).b);
  // Kamui palette: everything near the eye drains to violet-black, with a glowing rim.
  float core = 1.0 - smoothstep(0.0, 0.16 * k * uStrength, r);
  float rim = smoothstep(0.03 * k, 0.0, abs(r - 0.18 * k * uStrength - 0.03 * turbulence)) * uStrength;
  colour = mix(colour, colour * vec3(0.55, 0.45, 0.85), uStrength * fall);
  colour = mix(colour, vec3(0.03, 0.0, 0.06), core);
  colour += vec3(0.55, 0.25, 1.0) * rim * 0.9;
  gl_FragColor = vec4(colour, 1.0);
}`;

export function createKamui(renderer) {
  const size = new THREE.Vector2();
  const origin = new THREE.Vector2();
  let texture = null;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uAspect: { value: 1 }, uStrength: { value: 0 }, uTime: { value: 0 }, uReach: { value: 0.8 },
    },
    vertexShader: VERTEX, fragmentShader: FRAGMENT,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const projected = new THREE.Vector3();

  let pulse = null;   // { time, duration, at: Vector3 | null, reach }
  let driven = 0;     // strength set from outside this frame (gateway travel)
  let drivenAt = null;
  let time = 0;

  function ensureTexture() {
    renderer.getDrawingBufferSize(size);
    if (texture && texture.image.width === size.x && texture.image.height === size.y) return;
    texture?.dispose();
    texture = new THREE.DataTexture(new Uint8Array(size.x * size.y * 3), size.x, size.y, THREE.RGBFormat);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    material.uniforms.tScene.value = texture;
  }

  return {
    // A one-off vortex, optionally centred on a world position; full: true swallows the whole screen.
    pulse(at = null, duration = 1.8, { full = false } = {}) {
      pulse = { time: 0, duration, at: full ? null : at?.clone() ?? null, reach: full ? 1.3 : 0.8 };
    },
    // Hold the strength for this frame (0..1); used to follow the gateway's travel phases.
    drive(strength, at = null) { driven = Math.max(driven, strength); drivenAt = at; },
    get active() { return material.uniforms.uStrength.value > 0.001; },

    render(scene, camera, dt) {
      time += dt;
      let strength = driven, at = drivenAt, reach = 0.8;
      if (pulse) {
        pulse.time += dt;
        const u = pulse.time / pulse.duration;
        // Fast pull-in to full strength, slower release.
        const s = THREE.MathUtils.smoothstep(u, 0, 0.3) * (1 - THREE.MathUtils.smoothstep(u, 0.45, 1));
        if (s >= strength) { strength = s; at = pulse.at; reach = pulse.reach; }
        if (u >= 1) pulse = null;
      }
      driven = 0;
      drivenAt = null;
      renderer.render(scene, camera);
      material.uniforms.uStrength.value = strength;
      if (strength <= 0.001) return;

      ensureTexture();
      renderer.copyFramebufferToTexture(origin, texture);
      const center = material.uniforms.uCenter.value.set(0.5, 0.5);
      if (at) {
        projected.copy(at).project(camera);
        if (projected.z < 1) center.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5);
      }
      material.uniforms.uAspect.value = size.x / size.y;
      material.uniforms.uReach.value = reach;
      material.uniforms.uTime.value = time;
      renderer.render(quadScene, quadCamera);
    }
  };
}
