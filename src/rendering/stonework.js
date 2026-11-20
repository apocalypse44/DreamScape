// Shared carved stonework for the Clover sanctums (summit gateway, Sky Garden castle, ruins and return portal).
// Everything is procedural: one small canvas texture of ashlar courses gives flat primitives visible block joints, so
// bright daylight no longer washes them into featureless white. No downloads.
import { cloverShapes } from './kingdomGates.js';

let ashlar = null;
/** Ashlar courses: staggered blocks, darker mortar, a little tone per block. 256 px tile = 2 x 1 m of wall. */
function ashlarCanvas() {
  if (ashlar) return ashlar;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8d8a7e'; ctx.fillRect(0, 0, 256, 128); // mortar
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 4; row++) {
    const y = row * 32, offset = row % 2 ? -32 : 0;
    for (let x = offset; x < 256; x += 64) {
      const w = 64 - 3, tone = 222 + rnd() * 26 | 0;
      ctx.fillStyle = `rgb(${tone},${tone - 4},${tone - 16})`;
      ctx.fillRect(x + 1.5, y + 1.5, w, 29);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 1.5, y + 1.5, w, 3); // lit top edge
      ctx.fillStyle = 'rgba(60,54,40,.14)'; ctx.fillRect(x + 1.5, y + 27, w, 3.5); // shaded bottom edge
      for (let k = 0; k < 6; k++) { ctx.fillStyle = `rgba(90,84,66,${.05 + rnd() * .08})`; ctx.fillRect(x + rnd() * w, y + 4 + rnd() * 22, 2 + rnd() * 6, 1.5); } // pits
    }
  }
  return (ashlar = canvas);
}

/**
 * A stone material tinted `color`, its ashlar tiled for a face of w x h metres. Lambert on purpose: standard materials
 * take the sky as an environment map (environmentLighting.js, one global strength), which under the bright Sky Garden
 * sky washed every stone tint, even dark grey-green, to white. Lambert keeps the sun's shading and the stone's tone.
 */
export function stoneMaterial(color, w = 2, h = 1, extra = {}) {
  const map = new THREE.CanvasTexture(ashlarCanvas());
  map.encoding = THREE.sRGBEncoding; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  map.repeat.set(Math.max(1, w / 2), Math.max(1, h));
  return new THREE.MeshLambertMaterial({ color, map, ...extra });
}

/** Overlapping emerald roof shingles, rows of scallops, for cone roofs. */
export function shingleMaterial(color = 0x2f8f4e) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6f9a7c'; ctx.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row++) for (let i = -1; i < 9; i++) {
    const x = i * 16 + (row % 2) * 8, y = row * 16;
    ctx.fillStyle = row % 3 ? '#b9d3bf' : '#a3c4ab'; ctx.beginPath(); ctx.arc(x + 8, y + 4, 8, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = 'rgba(30,60,40,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas); map.encoding = THREE.sRGBEncoding;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(6, 4);
  return new THREE.MeshLambertMaterial({ color, map }); // Lambert, like the stone (see stoneMaterial)
}

export const GOLD = () => new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: .6, roughness: .35, emissive: 0x3a2a08 });
export const MOSS = () => new THREE.MeshStandardMaterial({ color: 0x2f6b3c, roughness: .8, emissive: 0x0f3a18, emissiveIntensity: .5 });
export const LEAF = () => new THREE.MeshStandardMaterial({ color: 0x8fe36b, emissive: 0x4bd23a, emissiveIntensity: 1.2, roughness: .4 });

/**
 * The sanctum gateway frame around a portal: octagonal pillars on plinths with moss bands, a half-ring arch with a
 * gold rim, and a glowing clover keystone in a gold ring. Adds to `group`; returns { keystone, colliders }.
 * Both ends of the Sky Garden teleport use it, so they match.
 */
export function gateFrame(group, { x, z, floor, half, rise, stone, gold = GOLD(), moss = MOSS(), leaf = LEAF(), yaw = 0 }) {
  const frame = new THREE.Group(); frame.position.set(x, floor, z); frame.rotation.y = yaw; group.add(frame);
  const put = (mesh, px, py, pz, shadow = true) => { mesh.position.set(px, py, pz); mesh.castShadow = shadow; mesh.receiveShadow = true; frame.add(mesh); return mesh; };
  for (const side of [-1, 1]) {
    const px = side * half;
    put(new THREE.Mesh(new THREE.CylinderGeometry(.5, .62, rise + .4, 8), stone), px, (rise + .4) / 2 - .2, 0);
    put(new THREE.Mesh(new THREE.BoxGeometry(1.5, .5, 1.5), stone), px, .25, 0);
    put(new THREE.Mesh(new THREE.BoxGeometry(1.3, .3, 1.3), stone), px, rise + .05, 0); // capital
    for (const y of [.9, 2.4]) { const band = put(new THREE.Mesh(new THREE.TorusGeometry(.6, .09, 6, 18), moss), px, y, 0, false); band.rotation.x = Math.PI / 2; }
  }
  put(new THREE.Mesh(new THREE.TorusGeometry(half, .42, 8, 32, Math.PI), stone), 0, rise + .2, 0);
  put(new THREE.Mesh(new THREE.TorusGeometry(half - .48, .1, 6, 32, Math.PI), gold), 0, rise + .2, 0, false);
  const keystone = new THREE.Group();
  keystone.add(new THREE.Mesh(new THREE.ExtrudeGeometry(cloverShapes(1.5), { depth: .22, bevelEnabled: false }).center(), leaf));
  keystone.add(new THREE.Mesh(new THREE.TorusGeometry(1.02, .09, 8, 32), gold));
  keystone.position.set(0, rise + .2 + half + 1.05, 0); frame.add(keystone);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const colliders = [-1, 1].map(side => ({ x: x + c * side * half, z: z - s * side * half, radius: .62 }));
  return { keystone, colliders };
}
