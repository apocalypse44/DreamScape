import { WATERFALL, WATERFALL_CLIMB, WATERFALL_CHECKPOINT, createWaterfallCourseRecovery, waterfallArea } from '../models/waterfall.js';
import { loadModel } from './models.js';

const noise = /* glsl */`
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x),
      mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    return noise2(p) * 0.57 + noise2(p * 2.03 + 17.0) * 0.28 + noise2(p * 4.11 + 39.0) * 0.15;
  }
`;
const vertex = /* glsl */`
  uniform float uTime, uCurtain;
  varying vec2 vUv;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec3 p = position;
    float sway = sin(uv.y * 19.0 + uTime * 3.0 + uv.x * 7.0);
    p.x += uCurtain * sway * (0.04 + (1.0 - uv.y) * 0.14);
    p.z += uCurtain * sin(uv.y * 30.0 + uTime * 5.0 + uv.x * 12.0) * 0.06;
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const flowFragment = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  ${noise}
  void main() {
    vec2 p = vec2(vUv.x * 9.0, vUv.y * 4.0 + uTime * 2.5);
    float warp = fbm(p * vec2(0.7, 1.8)) - 0.5;
    float ribbons = fbm(vec2(p.x + warp * 1.8, p.y * 0.65));
    float detail = fbm(vec2(p.x * 3.5 + warp, p.y * 3.0));
    float baseFoam = pow(1.0 - vUv.y, 3.0);
    float aeration = smoothstep(0.35, 0.78, ribbons + detail * 0.3 + baseFoam * 0.4);
    vec3 color = mix(vec3(0.18, 0.35, 0.37), vec3(0.82, 0.91, 0.89), aeration);
    color += pow(detail, 7.0) * 0.35;
    float edgeNoise = fbm(vec2(vUv.y * 24.0 + uTime * 3.0, vUv.x * 5.0));
    float width = 0.44 + edgeNoise * 0.06;
    float edge = 1.0 - smoothstep(width - 0.04, width, abs(vUv.x - 0.5));
    float holes = smoothstep(0.15, 0.38, ribbons + baseFoam * 0.25);
    gl_FragColor = vec4(color, edge * holes * (0.55 + aeration * 0.4));
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }
`;
const poolFragment = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${noise}
  float wave(vec2 p) {
    float d = length(p - vec2(0.0, 0.16));
    return sin(d * 37.0 - uTime * 5.0) * exp(-d * 2.8) * 0.12 +
      fbm(p * 9.0 + vec2(uTime * 0.25, -uTime * 0.18)) * 0.65 +
      sin(p.x * 12.0 + p.y * 7.0 + uTime * 1.1) * 0.045;
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p), h = wave(p), e = 0.012;
    vec3 n = normalize(vec3((h - wave(p + vec2(e,0))) * 0.9, e,
      (wave(p + vec2(0,e)) - h) * 0.9));
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = 0.04 + 0.7 * pow(1.0 - max(dot(n, view), 0.0), 4.0);
    vec3 reflection = reflect(-view, n);
    vec3 sky = mix(vec3(0.28, 0.38, 0.33), vec3(0.5, 0.65, 0.73), smoothstep(-0.1, 0.8, reflection.y));
    float clouds = smoothstep(0.55, 0.8, fbm(reflection.xz * 4.0 + uTime * 0.01));
    sky = mix(sky, vec3(0.8, 0.85, 0.82), clouds * 0.6);
    vec3 deep = mix(vec3(0.025, 0.13, 0.12), vec3(0.13, 0.29, 0.21), smoothstep(0.4, 0.95, r));
    vec3 color = mix(deep, sky, fresnel);
    vec3 light = normalize(vec3(-0.4, 0.8, 0.3));
    float glint = pow(max(dot(reflect(-light, n), view), 0.0), 85.0);
    color += glint * vec3(1.3, 1.2, 0.95);
    float impact = length((p - vec2(0.0, 0.16)) * vec2(1.0, 1.8));
    float churn = fbm(p * 22.0 + vec2(uTime * 0.7, -uTime));
    float foam = (1.0 - smoothstep(0.12, 0.55, impact)) * smoothstep(0.35, 0.7, churn);
    foam += smoothstep(0.82, 0.98, r) * smoothstep(0.55, 0.78, churn) * 0.35;
    color = mix(color, vec3(0.85, 0.92, 0.88), clamp(foam, 0.0, 1.0));
    gl_FragColor = vec4(color, (1.0 - smoothstep(0.93, 1.0, r)) * 0.95);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }
`;
const foamFragment = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  ${noise}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float n = fbm(p * 8.0 + vec2(uTime * 0.8, -uTime * 0.65));
    float edge = 1.0 - smoothstep(0.45, 1.0, length(p));
    gl_FragColor = vec4(vec3(0.88, 0.95, 0.93), edge * smoothstep(0.3, 0.72, n) * 0.85);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }
`;
// Open water in world space: no radial cut, so it can fill any basin.
const lakeFragment = /* glsl */`
  uniform float uTime;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${noise}
  float wave(vec2 p) {
    return fbm(p * 0.3 + vec2(uTime * 0.12, -uTime * 0.09)) + fbm(p * 1.2 - uTime * 0.2) * 0.35;
  }
  void main() {
    vec2 p = vWorld.xz;
    float e = 0.2, h = wave(p);
    vec3 n = normalize(vec3((h - wave(p + vec2(e, 0))) * 1.5, e, (h - wave(p + vec2(0, e))) * 1.5));
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = 0.05 + 0.75 * pow(1.0 - max(dot(n, view), 0.0), 4.0);
    vec3 r = reflect(-view, n);
    vec3 sky = mix(vec3(0.3, 0.45, 0.43), vec3(0.62, 0.78, 0.84), smoothstep(-0.1, 0.8, r.y));
    vec3 color = mix(vec3(0.02, 0.13, 0.15), sky, fresnel);
    color += pow(max(dot(reflect(-normalize(vec3(-0.4, 0.8, 0.3)), n), view), 0.0), 90.0) * vec3(1.2, 1.15, 0.95);
    color = mix(color, vec3(0.85, 0.93, 0.9), smoothstep(0.7, 0.85, fbm(p * 0.7 + uTime * 0.15)) * 0.25);
    gl_FragColor = vec4(color, 0.94);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }
`;
export function createSoftDot() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}
export function createWaterSurface(kind) {
  if (kind === 'lake') return waterMaterial(lakeFragment);
  return waterMaterial(kind === 'fall' ? flowFragment : poolFragment, kind === 'fall');
}
function waterMaterial(fragmentShader, curtain = false) {
  return new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog,
      { uTime: { value: 0 }, uCurtain: { value: curtain ? 1 : 0 } }]),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
}

export function createWaterfall({ scene, world, onReady }) {
  const root = new THREE.Group();
  root.name = 'Grimoire waterfall';
  root.position.set(WATERFALL.x, WATERFALL.base, WATERFALL.z);
  scene.add(root);
  const cliff = new THREE.Group();
  root.add(cliff);
  const groundDetails = [];
  const platforms = WATERFALL_CLIMB;
  const climbMaterial = new THREE.MeshStandardMaterial({ color: 0x768779, roughness: 0.85, flatShading: true });
  for (const p of platforms) {
    // Flat stone terraces match their collision boxes, keeping landing edges clear.
    const height = p.top - p.bottom;
    const rock = new THREE.Mesh(new THREE.BoxGeometry(p.width * 0.65, height, p.depth * 0.65), climbMaterial);
    rock.position.set(p.x - WATERFALL.x, (p.top + p.bottom) / 2 - WATERFALL.base, p.z - WATERFALL.z);
    rock.castShadow = rock.receiveShadow = true;
    cliff.add(rock);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(p.width, 0.06, p.depth),
      new THREE.MeshStandardMaterial({ color: 0xa0ae91, roughness: 1 }));
    cap.position.set(rock.position.x, p.top - WATERFALL.base - 0.03, rock.position.z);
    cap.receiveShadow = true;
    cliff.add(cap);
  }
  const climbRecovery = createWaterfallCourseRecovery();
  let feedback = '', feedbackTime = 0, lookoutReached = false;
  function courseRecovery(player) {
    const target = climbRecovery.update(player);
    if (target) { feedback = 'Returned to climb entrance'; feedbackTime = 3; }
    return target;
  }
  const colliders = [
    { x: WATERFALL.x, z: WATERFALL.z - 8, radius: 6.5 },
    { x: WATERFALL.x - 8, z: WATERFALL.z - 6, radius: 2.3 },
    { x: WATERFALL.x + 8, z: WATERFALL.z - 6, radius: 2.3 }
  ];

  // Requested dimensions, rather than arbitrary model scales, keep the
  // existing nature rocks fitted around the water curtain and its upper lip.
  const rocks = [
    { p: [0, -0.5, -8], size: [16, 12.5, 7], rotation: 0.2 },
    { p: [-7, -0.4, -6], size: [5, 8, 6], rotation: -0.5 },
    { p: [7, -0.4, -6], size: [5, 9, 6], rotation: 0.5 }
  ];
  for (const p of platforms) rocks.push({
    p: [p.x - WATERFALL.x, p.bottom - WATERFALL.base, p.z - WATERFALL.z],
    size: [p.width, p.top - p.bottom - 0.08, p.depth], rotation: 0
  });
  for (let i = 0; i < 18; i++) {
    const angle = i / 18 * Math.PI * 2;
    // Leave an opening toward spawn on the southeast shore.
    if (angle > 0.5 && angle < 1.5) continue;
    const radius = 6.1 + world.hash(i, 605) * 0.65;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    if (z < -4) continue;
    rocks.push({ p: [x, -0.3, z], size: [1.3 + world.hash(i, 601), 0.55 + world.hash(603, i), 1.5],
      rotation: angle, grounded: true, wet: true });
  }
  // Small, partly buried stones break up the bank without blocking the approach.
  for (let i = 0; i < 32; i++) {
    const angle = world.hash(i, 621) * Math.PI * 2;
    if (angle > 0.45 && angle < 1.5) continue;
    const radius = 6.7 + world.hash(i, 622) * 3.2;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    if (z < -4) continue;
    const scale = 0.35 + world.hash(i, 623) * 0.6;
    rocks.push({ p: [x, -0.12, z], size: [scale * 1.4, scale * 0.45, scale],
      rotation: angle, grounded: true, wet: radius < 7.8 });
  }
  function installRock(object, size, placement) {
    const copy = object.clone(true);
    copy.scale.set(placement.size[0] / size.x, placement.size[1] / size.y, placement.size[2] / size.z);
    copy.position.set(...placement.p);
    copy.rotation.y = placement.rotation;
    if (placement.wet) copy.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.color.set(0x53685d);
      o.material.roughness = 0.32;
    });
    cliff.add(copy);
    if (placement.grounded) groundDetails.push({ object: copy, offset: placement.p[1] });
    copy.position.y = placement.grounded ? world.terrainHeight(
      WATERFALL.x + copy.position.x, WATERFALL.z + copy.position.z) - WATERFALL.base + placement.p[1] : placement.p[1];
  }
  const rockUrl = encodeURI('assets/Stylized Nature MegaKit[Standard]/glTF/Rock_Medium_1.gltf');
  loadModel(rockUrl, 1).then(({ object, size }) => {
    object.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.color.set(0x7d8b80);
      o.material.roughness = 0.95;
    });
    rocks.forEach(p => installRock(object, size, p));
    onReady?.(root);
  }).catch(error => {
    console.warn('Waterfall rock model unavailable; using faceted rock fallback.', error);
    const object = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x65776c, roughness: 0.95, flatShading: true }));
    object.position.y = 0.5;
    object.castShadow = object.receiveShadow = true;
    const group = new THREE.Group(); group.add(object);
    rocks.forEach(p => installRock(group, new THREE.Vector3(1, 1, 1), p));
    onReady?.(root);
  });

  // Reuse the nature kit for small clusters along the outer shore. Keep the
  // southeast entrance and the water itself clear, including the spawn plaza.
  for (const [model, count, height, seed] of [
    ['Plant_1', 18, 0.65, 641], ['Clover_1', 12, 0.3, 651], ['Bush_Common', 6, 0.85, 661]
  ]) {
    loadModel(encodeURI(`assets/Stylized Nature MegaKit[Standard]/glTF/${model}.gltf`), height)
      .then(({ object }) => {
        for (let i = 0; i < count; i++) {
          const angle = world.hash(i, seed) * Math.PI * 2;
          if (angle > 0.4 && angle < 1.6) continue;
          const radius = 7.3 + world.hash(i, seed + 1) * 3.8;
          const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
          if (z < -3.5 || Math.hypot(WATERFALL.x + x, WATERFALL.z + z) < 26) continue;
          const plant = object.clone(true);
          plant.scale.setScalar(0.8 + world.hash(i, seed + 2) * 0.6);
          plant.rotation.y = angle;
          plant.position.set(x, world.terrainHeight(WATERFALL.x + x, WATERFALL.z + z) - WATERFALL.base - 0.03, z);
          root.add(plant);
          groundDetails.push({ object: plant, offset: -0.03 });
        }
        if (model !== 'Bush_Common') {
          const lookout = platforms[platforms.length - 1];
          for (const [dx, dz] of [[1.25, -1.2], [-1.25, -1.2]]) {
            const plant = object.clone(true);
            plant.scale.setScalar(0.55);
            plant.position.set(lookout.x - WATERFALL.x + dx, lookout.top - WATERFALL.base, lookout.z - WATERFALL.z + dz);
            root.add(plant);
          }
        }
        onReady?.(root);
      }).catch(error => console.warn(`Waterfall ${model} dressing unavailable.`, error));
  }

  const flowMat = waterMaterial(flowFragment, true);
  const sheetGeo = new THREE.PlaneGeometry(4.2, WATERFALL.height, 12, 32);
  const pos = sheetGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = sheetGeo.attributes.uv.getY(i);
    pos.setXYZ(i, pos.getX(i) * (1 + (1 - t) * 0.15),
      0.08 + t * WATERFALL.height, -1 - t * 3.9);
  }
  sheetGeo.computeVertexNormals();
  const sheet = new THREE.Mesh(sheetGeo, flowMat);
  sheet.frustumCulled = false; // shader sway extends slightly beyond the CPU bounds
  root.add(sheet);

  const poolMat = waterMaterial(poolFragment);
  // Plane UVs provide centered radial coordinates; shader cuts it to a pool.
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.04;
  root.add(pool);

  const creekMat = waterMaterial(flowFragment);
  const creek = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.3), creekMat);
  creek.rotation.x = -Math.PI / 2;
  creek.position.set(0, WATERFALL.height + 0.08, -6.5);
  root.add(creek);

  const foamTexture = (() => {
    const size = 32, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const alpha = Math.max(0, 1 - Math.hypot(x - 15.5, y - 15.5) / 15.5);
      pixels.set([255, 255, 255, Math.round(alpha * alpha * 255)], i);
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  })();
  const mistCount = 96;
  const mistGeo = new THREE.BufferGeometry();
  const mistPositions = new Float32Array(mistCount * 3);
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: 0xc7eee3,
    map: foamTexture, size: 1.25, opacity: 0.3, transparent: true, depthWrite: false }));
  mist.frustumCulled = false;
  root.add(mist);

  const dropCount = 180;
  const dropPositions = new Float32Array(dropCount * 3);
  const dropSeeds = Array.from({ length: dropCount }, (_, i) => [world.hash(i, 901), world.hash(i, 902), world.hash(i, 903)]);
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPositions, 3));
  const drops = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0xe7f5f2,
    map: foamTexture, size: 0.13, transparent: true, opacity: 0.7, depthWrite: false }));
  drops.frustumCulled = false;
  root.add(drops);

  const splashCount = 64;
  const splashPositions = new Float32Array(splashCount * 3);
  const splashSeeds = Array.from({ length: splashCount }, (_, i) => [world.hash(i, 911), world.hash(i, 912), world.hash(i, 913)]);
  const splashGeo = new THREE.BufferGeometry();
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
  const splash = new THREE.Points(splashGeo, new THREE.PointsMaterial({ color: 0xe7f5f2,
    map: foamTexture, size: 0.18, transparent: true, opacity: 0.65, depthWrite: false }));
  splash.frustumCulled = false;
  root.add(splash);

  const foam = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.5),
    waterMaterial(foamFragment));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.07, -1);
  root.add(foam);

  // Player feedback: a burst + ripple on entering the pool, smaller kicks while wading.
  const wadeCount = 120;
  const wadePositions = new Float32Array(wadeCount * 3), wadeVelocity = new Float32Array(wadeCount * 3);
  const wadeLife = new Float32Array(wadeCount);
  const wadeGeo = new THREE.BufferGeometry();
  wadeGeo.setAttribute('position', new THREE.BufferAttribute(wadePositions, 3));
  const wade = new THREE.Points(wadeGeo, new THREE.PointsMaterial({ color: 0xeef9f6,
    map: foamTexture, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false }));
  wade.frustumCulled = false;
  root.add(wade);
  const ripples = Array.from({ length: 6 }, () => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({
      color: 0xe7f5f2, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false; root.add(ring);
    return { ring, age: 1 };
  });
  let nextWade = 0, nextRipple = 0, wasInPool = false;
  const lastPlayer = new THREE.Vector3();
  function kick(x, z, count, power) {
    for (let i = 0, n = 0; i < wadeCount && n < count; i++) {
      if (wadeLife[i] > 0) continue;
      const angle = Math.random() * Math.PI * 2, out = (0.4 + Math.random()) * power;
      wadePositions.set([x + Math.cos(angle) * 0.3, 0.1, z + Math.sin(angle) * 0.3], i * 3);
      wadeVelocity.set([Math.cos(angle) * out, (1.5 + Math.random() * 2.5) * power, Math.sin(angle) * out], i * 3);
      wadeLife[i] = 0.5 + Math.random() * 0.4; n++;
    }
  }
  function ripple(x, z, size) {
    const r = ripples.reduce((a, b) => (b.age > a.age ? b : a));
    r.age = 0; r.size = size; r.ring.position.set(x, 0.08, z); r.ring.visible = true;
  }
  function updateWading(dt, playerPosition) {
    const x = playerPosition.x - WATERFALL.x, z = playerPosition.z - WATERFALL.z;
    const feet = playerPosition.y - 2.05 - WATERFALL.base;
    const inPool = Math.hypot(x, z) < WATERFALL.poolRadius - 0.4 && feet < 0.4;
    const speed = dt > 0 ? Math.hypot(playerPosition.x - lastPlayer.x, playerPosition.z - lastPlayer.z) / dt : 0;
    const falling = dt > 0 ? (lastPlayer.y - playerPosition.y) / dt : 0;
    lastPlayer.copy(playerPosition);
    if (inPool && !wasInPool) { kick(x, z, 60, 1 + Math.min(falling, 12) / 12); ripple(x, z, 3.5); }
    if (inPool && speed > 1) {
      nextWade -= dt; nextRipple -= dt;
      if (nextWade <= 0) { kick(x, z, 4, 0.55); nextWade = 0.05; }
      if (nextRipple <= 0) { ripple(x, z, 1.8); nextRipple = 0.4; }
    }
    wasInPool = inPool;
    for (let i = 0; i < wadeCount; i++) {
      if (wadeLife[i] <= 0) { wadePositions[i * 3 + 1] = -50; continue; }
      wadeLife[i] -= dt; wadeVelocity[i * 3 + 1] -= 9.8 * dt;
      for (let k = 0; k < 3; k++) wadePositions[i * 3 + k] += wadeVelocity[i * 3 + k] * dt;
      if (wadePositions[i * 3 + 1] < 0.05) wadeLife[i] = 0;
    }
    wadeGeo.attributes.position.needsUpdate = true;
    for (const r of ripples) {
      if (r.age >= 1) { r.ring.visible = false; continue; }
      r.age = Math.min(1, r.age + dt * 0.9);
      r.ring.scale.setScalar(0.3 + r.age * r.size);
      r.ring.material.opacity = 0.6 * (1 - r.age);
    }
  }

  // The plaza renderer owns the single continuous approach to the falls.
  const sign = new THREE.Group();
  sign.position.set(WATERFALL_CHECKPOINT.x - WATERFALL.x + 1.5, 0,
    WATERFALL_CHECKPOINT.z - WATERFALL.z);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x66583e, roughness: 1 }));
  post.position.y = 0.55;
  sign.add(post);
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512; labelCanvas.height = 192;
  const ctx = labelCanvas.getContext('2d');
  ctx.fillStyle = '#344b3c'; ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#a5bba0'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 496, 176);
  ctx.fillStyle = '#eef0d5'; ctx.textAlign = 'center'; ctx.font = 'bold 40px sans-serif';
  ctx.fillText('FALLS LOOKOUT ↑', 256, 77);
  ctx.font = '30px sans-serif'; ctx.fillText('SPACE TO JUMP', 256, 137);
  const signTexture = new THREE.CanvasTexture(labelCanvas);
  signTexture.encoding = THREE.sRGBEncoding;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.675),
    new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.DoubleSide }));
  board.position.y = 1.15;
  sign.add(board);
  root.add(sign);
  groundDetails.push({ object: sign, offset: 0 });
  let time = 0;
  let terrainVersion = -1;
  const hint = document.createElement('small');
  document.querySelector('.compass').appendChild(hint);
  function update(dt, playerPosition) {
    time += dt;
    feedbackTime = Math.max(0, feedbackTime - dt);
    const lookout = platforms[platforms.length - 1];
    if (!lookoutReached && Math.abs(playerPosition.y - 2.05 - lookout.top) < 0.12 &&
        Math.abs(playerPosition.x - lookout.x) < lookout.width / 2 &&
        Math.abs(playerPosition.z - lookout.z) < lookout.depth / 2) {
      lookoutReached = true;
      feedback = 'Lookout reached · Enjoy the view'; feedbackTime = 4;
    }
    for (const material of [flowMat, poolMat, creekMat, foam.material]) material.uniforms.uTime.value = time;
    for (let i = 0; i < mistCount; i++) {
      const age = (time * (0.35 + world.hash(i, 81) * 0.2) + world.hash(i, 82)) % 1;
      const angle = world.hash(i, 83) * Math.PI * 2;
      const radius = age * (1 + world.hash(i, 84) * 2.8);
      mistPositions[i * 3] = Math.cos(angle) * radius;
      mistPositions[i * 3 + 1] = 0.15 + age * 2.7;
      mistPositions[i * 3 + 2] = -1 + Math.sin(angle) * radius;
    }
    mistGeo.attributes.position.needsUpdate = true;
    dropSeeds.forEach(([phase, spread, speed], i) => {
      const age = (time * (0.55 + speed * 0.3) + phase) % 1;
      const fall = age * age;
      dropPositions[i * 3] = (spread - 0.5) * (4 + fall * 1.2);
      dropPositions[i * 3 + 1] = 0.15 + WATERFALL.height * (1 - fall);
      dropPositions[i * 3 + 2] = -4.9 + fall * 4.1 + Math.sin(spread * 25) * 0.25;
    });
    dropGeo.attributes.position.needsUpdate = true;
    splashSeeds.forEach(([phase, angleSeed, speed], i) => {
      const age = (time * 1.3 + phase) % 1;
      const angle = angleSeed * Math.PI * 2, radius = age * (1.5 + speed * 2);
      splashPositions[i * 3] = Math.cos(angle) * radius;
      splashPositions[i * 3 + 1] = 0.12 + Math.max(0, 3.5 * age - 4 * age * age);
      splashPositions[i * 3 + 2] = -1 + Math.sin(angle) * radius * 0.6;
    });
    splashGeo.attributes.position.needsUpdate = true;
    updateWading(dt, playerPosition);

    if (terrainVersion !== world.terrainVersion) {
      terrainVersion = world.terrainVersion;
      for (const { object, offset } of groundDetails) object.position.y = world.terrainHeight(
        WATERFALL.x + object.position.x, WATERFALL.z + object.position.z) - WATERFALL.base + offset;
    }
    const distance = Math.round(Math.hypot(playerPosition.x - WATERFALL.x, playerPosition.z - WATERFALL.z));
    const nearClimb = Math.hypot(playerPosition.x - WATERFALL_CHECKPOINT.x, playerPosition.z - WATERFALL_CHECKPOINT.z) < 12;
    const label = feedbackTime > 0 ? feedback : nearClimb ? 'GRIMOIRE FALLS · ROCK CLIMB ON EAST BANK · SPACE TO JUMP' :
      distance < 9 ? 'GRIMOIRE FALLS · SHALLOW POOL' : `GRIMOIRE FALLS · ${distance} m · NW OF SPAWN`;
    if (hint.textContent !== label) hint.textContent = label;
  }
  update(0, { x: 0, y: 50, z: 0 });
  return { colliders, platforms, courseRecovery, obstacles: cliff, reserved: (x, z) => waterfallArea(x, z), update,
    reset() { time = 0; terrainVersion = -1; climbRecovery.reset(); feedback = ''; feedbackTime = 0; lookoutReached = false; wasInPool = false; wadeLife.fill(0); } };
}
