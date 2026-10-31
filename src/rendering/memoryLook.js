// Memory look for story flashbacks: the rendered frame is replayed as a fading memory. Colour drains
// to warm sepia except story hues (Veyr's violet magic, Clover's living green), with film grain, a
// vignette, a gentle wave at the edges, colour fringing, a slight flicker, a storm tint the scene can
// raise, and a ripple "shimmer" for the rewind in and the snap back out.
//
// Same pipeline as kamui.js: render normally, copy the frame (copyFramebufferToTexture), then draw one
// full-screen quad. Nothing extra runs while the look is off.
const VERTEX = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAGMENT = `
uniform sampler2D tScene;
uniform float uAmount;   // 0 present, 1 full memory
uniform float uShimmer;  // 0..1 transition ripple
uniform float uStorm;    // 0..1 dark violet storm over the memory
uniform float uTime, uAspect;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}

void main() {
  vec2 c = vUv - 0.5; c.x *= uAspect;
  float r = length(c);
  // Wave: strongest at the edges, as if the memory frays; the shimmer adds rings from the centre.
  float edge = smoothstep(0.25, 0.85, r);
  vec2 uv = vUv;
  uv.x += uAmount * edge * 0.006 * sin(vUv.y * 38.0 + uTime * 2.2);
  uv.y += uAmount * edge * 0.004 * sin(vUv.x * 31.0 - uTime * 1.7);
  uv += uShimmer * 0.018 * sin(r * 60.0 - uTime * 14.0) * normalize(c + 1e-5) / vec2(uAspect, 1.0);
  // Colour fringing toward the edges.
  vec2 fringe = normalize(c + 1e-5) / vec2(uAspect, 1.0) * (0.0035 * uAmount * r * r + 0.01 * uShimmer);
  vec3 col = vec3(texture2D(tScene, clamp(uv + fringe, 0.0, 1.0)).r,
                  texture2D(tScene, clamp(uv, 0.0, 1.0)).g,
                  texture2D(tScene, clamp(uv - fringe, 0.0, 1.0)).b);
  // Sepia memory, keeping saturated violet (hue ~0.70-0.88) and living green (~0.22-0.42).
  vec3 h = hsv(col);
  float violet = smoothstep(0.66, 0.72, h.x) * (1.0 - smoothstep(0.86, 0.92, h.x));
  float green = smoothstep(0.19, 0.24, h.x) * (1.0 - smoothstep(0.40, 0.46, h.x));
  float keep = max(violet, green * 0.75) * smoothstep(0.22, 0.45, h.y);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 sepia = lum * vec3(1.08, 0.94, 0.76) + vec3(0.03, 0.02, 0.0);
  vec3 memory = mix(sepia, col, keep * 0.9);
  // Storm: darker, violet-shifted light over everything but the kept hues.
  memory *= mix(1.0, 0.58, uStorm * (1.0 - keep * 0.6));
  memory = mix(memory, memory * vec3(0.78, 0.62, 1.12), uStorm * 0.7);
  // Vignette, grain and a faint projector flicker.
  memory *= 1.0 - smoothstep(0.35, 0.95, r) * 0.55;
  memory += (hash(vUv * 731.0 + fract(uTime * 7.3)) - 0.5) * 0.07;
  memory *= 1.0 + 0.025 * sin(uTime * 13.0);
  col = mix(col, memory, uAmount);
  col += uShimmer * uShimmer * vec3(0.95, 0.88, 0.7) * (1.0 - r) * 0.6; // the white bloom of remembering
  gl_FragColor = vec4(col, 1.0);
}`;

export function createMemoryLook(renderer) {
  const size = new THREE.Vector2(), origin = new THREE.Vector2();
  let texture = null, time = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: null }, uAmount: { value: 0 }, uShimmer: { value: 0 }, uStorm: { value: 0 },
      uTime: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const quadScene = new THREE.Scene(), quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); quad.frustumCulled = false; quadScene.add(quad);
  function ensureTexture() {
    renderer.getDrawingBufferSize(size);
    if (texture && texture.image.width === size.x && texture.image.height === size.y) return;
    texture?.dispose();
    texture = new THREE.DataTexture(new Uint8Array(size.x * size.y * 3), size.x, size.y, THREE.RGBFormat);
    texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
    material.uniforms.tScene.value = texture;
  }
  const look = { amount: 0, shimmer: 0, storm: 0 };
  return {
    look, // set amount / shimmer / storm (0..1) each frame; all zero = off
    // Call right after the frame has been rendered to the screen.
    apply(dt) {
      time += dt;
      if (look.amount <= .001 && look.shimmer <= .001) return;
      ensureTexture();
      renderer.copyFramebufferToTexture(origin, texture);
      const u = material.uniforms;
      u.uAmount.value = look.amount; u.uShimmer.value = look.shimmer; u.uStorm.value = look.storm;
      u.uTime.value = time; u.uAspect.value = size.x / size.y;
      renderer.render(quadScene, quadCamera);
    },
  };
}
