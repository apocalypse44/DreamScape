import { loadModel } from './models.js';
import { CLOVER_PLATEAUS } from '../models/cloverTerrain.js';

export function createCloverDressing({ root, world, onReady }) {
  const colliders = [], placements = [];
  CLOVER_PLATEAUS.forEach((p, index) => {
    // Clusters live beside the route, away from bridge mouths, trees and
    // east-side takeoff points. The middle plateau has the largest outcrop.
    const clusters = [[-7.5, 3.5], [7, 4]];
    clusters.forEach(([cx, cz], cluster) => {
      const height = cluster === 0 ? (index === 1 ? 2.4 : 1.7) : 1.1;
      placements.push({ model: 'Rock_Medium_2', height, x: cx, z: p.z + cz, y: p.top - 0.12, yaw: index * 0.9 + cluster });
      colliders.push({ x: cx, z: p.z + cz, radius: cluster === 0 ? 1.8 : 1.1 });
      for (let i = 0; i < 3; i++) {
        const angle = i * 2.1 + index, radius = 1.7;
        placements.push({ model: 'Rock_Medium_1', height: 0.25 + world.hash(i, index + 811) * 0.25,
          x: cx + Math.cos(angle) * radius, z: p.z + cz + Math.sin(angle) * radius,
          y: p.top - 0.04, yaw: angle });
      }
      for (const [model, count, size] of [['Bush_Common', 1, 0.7], ['Flower_3_Group', 2, 0.35], ['Clover_1', 4, 0.22]]) {
        for (let i = 0; i < count; i++) {
          const angle = i * 2.4 + index + cluster * 1.5;
          const radius = 2 + world.hash(i + count, index + cluster + 821) * 0.7;
          placements.push({ model, height: size, x: cx + Math.cos(angle) * radius,
            z: p.z + cz + Math.sin(angle) * radius, y: p.top - 0.025, yaw: angle });
        }
      }
    });
  });
  for (const model of new Set(placements.map(p => p.model))) {
    loadModel(encodeURI(`assets/Stylized Nature MegaKit[Standard]/glTF/${model}.gltf`), 1)
      .then(({ object, size }) => {
        for (const p of placements.filter(p => p.model === model)) {
          const copy = object.clone(true);
          // Fit larger rocks to the collider footprint before applying yaw.
          const widthLimit = p.height > 1 ? 2.2 : Infinity;
          const scale = Math.min(p.height, widthLimit / Math.max(size.x, size.z));
          copy.scale.setScalar(scale); copy.position.set(p.x, p.y, p.z); copy.rotation.y = p.yaw;
          root.add(copy);
        }
        onReady?.(root);
      }).catch(error => console.warn(`Clover ${model} dressing unavailable.`, error));
  }
  return { colliders };
}

export function cloverGroundTexture(world) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#536f2d'; ctx.fillRect(0, 0, 256, 256);
  // Wrap broad patches around tile edges so repeated caps have no hard seams.
  for (let i = 0; i < 28; i++) {
    const x = world.hash(i, 851) * 256, y = world.hash(i, 852) * 256;
    const radius = 10 + world.hash(i, 853) * 32;
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
      const gradient = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
      gradient.addColorStop(0, i % 4 === 0 ? 'rgba(115,91,57,0.75)' : 'rgba(103,130,54,0.6)');
      gradient.addColorStop(1, 'rgba(80,110,45,0)'); ctx.fillStyle = gradient;
      ctx.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
    }
  }
  for (let i = 0; i < 6500; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(24,45,14,0.18)' : 'rgba(151,163,92,0.18)';
    ctx.fillRect(world.hash(i, 861) * 256, world.hash(i, 862) * 256, 1, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2);
  return texture;
}
