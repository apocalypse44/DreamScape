// Textured, rotating lifetime sprites inspired by Bobby Roe's Simple-Particle-Effects.
// https://github.com/bobbyroe/Simple-Particle-Effects
// Upstream sprite license: vendor/simple-particle-effects-LICENSE.txt.
import { createFireParticles, fireLife } from '../models/houndFire.js';

const VERTEX = `
  attribute float aSize;
  attribute float aAngle;
  attribute vec4 aTint;
  uniform float uPixels;
  uniform float uMaxSize;
  varying vec4 vTint;
  varying vec2 vRotation;
  void main() {
    vec4 eye = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * eye;
    gl_PointSize = clamp(aSize * uPixels / max(.1, -eye.z), 1.0, uMaxSize);
    vTint = aTint;
    vRotation = vec2(cos(aAngle), sin(aAngle));
  }`;
const FRAGMENT = `
  uniform sampler2D uSprite;
  uniform float uSpark;
  uniform float uSmoke;
  varying vec4 vTint;
  varying vec2 vRotation;
  void main() {
    vec2 p = gl_PointCoord - .5;
    vec2 uv = mat2(vRotation.x, -vRotation.y, vRotation.y, vRotation.x) * p + .5;
    vec4 sprite = texture2D(uSprite, uv);
    float mask = sprite.a;
    if (uSmoke > .5) mask *= dot(sprite.rgb, vec3(.3333));
    if (uSpark > .5) { mask = pow(max(0.0, 1.0 - length(p) * 2.0), 1.8); sprite.rgb = vec3(1.0); }
    float alpha = mask * vTint.a;
    if (alpha < .002) discard;
    gl_FragColor = vec4(uSmoke > .5 ? vTint.rgb : sprite.rgb * vTint.rgb, alpha);
  }`;

export function createHoundFire({ scene, camera, renderer }) {
  const simulation = createFireParticles();
  const capacity = simulation.particles.length, screen = new THREE.Vector2();
  const fallback = new THREE.DataTexture(new Uint8Array([255, 120, 25, 255]), 1, 1, THREE.RGBAFormat);
  fallback.needsUpdate = true;
  const loader = new THREE.TextureLoader();
  const context = renderer.getContext();
  const maxPointSize = Math.min(256, context.getParameter(context.ALIASED_POINT_SIZE_RANGE)[1]);
  const layers = ['smoke', 'flame', 'spark'].map(kind => {
    const geometry = new THREE.BufferGeometry();
    for (const [name, itemSize] of [['position', 3], ['aTint', 4], ['aSize', 1], ['aAngle', 1]]) {
      geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(capacity * itemSize), itemSize).setUsage(THREE.DynamicDrawUsage));
    }
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      uniforms: { uSprite: { value: fallback }, uPixels: { value: 800 }, uMaxSize: { value: maxPointSize },
        uSpark: { value: kind === 'spark' ? 1 : 0 }, uSmoke: { value: kind === 'smoke' ? 1 : 0 } },
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthTest: true, depthWrite: false, toneMapped: false,
      blending: kind === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    if (kind !== 'spark') loader.load(`assets/particles/${kind === 'smoke' ? 'smoke' : 'fire'}.png`, texture => {
      material.uniforms.uSprite.value = texture;
    }, undefined, error => console.warn('Particle sprite unavailable; using fallback.', error));
    const points = new THREE.Points(geometry, material);
    points.name = `Hound ${kind}`; points.frustumCulled = false; points.visible = false;
    points.renderOrder = kind === 'smoke' ? 1 : 2;
    scene.add(points);
    return { kind, geometry, material, points, order: [] };
  });
  const light = new THREE.PointLight(0xff651b, 0, 6, 2); scene.add(light);
  const distance = p => (p.x - camera.position.x) ** 2 + (p.y - camera.position.y) ** 2 + (p.z - camera.position.z) ** 2;
  return {
    reset() {
      simulation.reset(); light.intensity = 0;
      for (const layer of layers) { layer.points.visible = false; layer.geometry.setDrawRange(0, 0); }
    },
    update(dt, pose) {
      simulation.update(dt, pose);
      renderer.getDrawingBufferSize(screen);
      const pixels = screen.y * camera.projectionMatrix.elements[5] * .5;
      for (const layer of layers) {
        const { geometry, material, points, order, kind } = layer;
        order.length = 0;
        simulation.particles.forEach((p, i) => { if (p.life > 0 && p.kind === kind) order.push(i); });
        if (kind === 'smoke') order.sort((a, b) => distance(simulation.particles[b]) - distance(simulation.particles[a]));
        order.forEach((index, vertex) => {
          const p = simulation.particles[index], age = 1 - p.life / p.maxLife, curve = fireLife(age);
          const smoke = kind === 'smoke', spark = kind === 'spark';
          const size = p.size * (smoke ? .5 + age * 1.8 : spark ? 1 - age * .65 : curve.size);
          const alpha = pose.intensity * (smoke ? .13 * Math.sin(age * Math.PI) : spark ? (1 - age) * .8 : curve.alpha * .48);
          geometry.attributes.position.setXYZ(vertex, p.x, p.y, p.z);
          geometry.attributes.aSize.setX(vertex, size);
          geometry.attributes.aAngle.setX(vertex, p.angle);
          geometry.attributes.aTint.setXYZW(vertex, smoke ? .13 : 1, smoke ? .11 : .95 - age * .55, smoke ? .1 : .65 - age * .57, alpha);
        });
        for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
        geometry.setDrawRange(0, order.length);
        material.uniforms.uPixels.value = pixels;
        points.visible = pose.intensity > 0 && order.length > 0;
      }
      light.position.copy(pose.position); light.position.y += .7;
      light.intensity = pose.intensity * (.9 + Math.sin(simulation.time * 13) * .15);
    },
  };
}
