import { WATERFALL } from '../models/waterfall.js';
import { RIDGE_PATH } from '../models/ridge.js';
import { CLOVER_ENTRANCE } from '../models/cloverTerrain.js';

// Text faces the approach to each marker; destinations use the landmark data.
export function createWayfinding({ scene, world }) {
  const root = new THREE.Group();
  root.name = 'Grimoire landmark signs';
  scene.add(root);
  const signs = [], colliders = [];
  const wood = new THREE.MeshStandardMaterial({ color: 0x685139, roughness: 0.95 });
  const routes = [
    { name: 'GRIMOIRE FALLS', target: WATERFALL, arrow: '↖', direction: 'NORTHWEST', color: '#b7e8de' },
    { name: 'GRIMOIRE RIDGE', target: RIDGE_PATH[0], arrow: '↘', direction: 'SOUTHEAST', color: '#e2dfa2' },
    { name: 'CLOVER TERRACES', target: CLOVER_ENTRANCE, arrow: '↑', direction: 'NORTH', color: '#bde798' }
  ];
  function board(route, x, z, width = 3.2) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#493a2a'; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#9f8961'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, 1008, 240);
    ctx.fillStyle = route.color; ctx.textAlign = 'left';
    ctx.font = 'bold 108px sans-serif'; ctx.fillText(route.arrow, 28, 167);
    ctx.font = 'bold 57px sans-serif'; ctx.fillText(route.name, 164, 102);
    const distance = Math.round(Math.hypot(route.target.x - x, route.target.z - z));
    ctx.font = '36px sans-serif';
    ctx.fillText(`${route.direction} · ~${distance} m${route === routes[1] ? ' TO TRAIL' : ''}`, 164, 176);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width, width / 4, 0.12), wood);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4),
      new THREE.MeshBasicMaterial({ map: texture }));
    face.position.z = 0.065;
    panel.add(face);
    panel.castShadow = panel.receiveShadow = true;
    return panel;
  }
  function sign(x, z, selected, previous, large = false) {
    const group = new THREE.Group();
    group.position.set(x, world.terrainHeight(x, z), z);
    group.rotation.y = Math.atan2(previous.x - x, previous.z - z);
    const height = large ? 3 + Math.max(0, selected.length - 2) * 0.92 : 2.2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, height, 8), wood);
    post.position.y = height / 2;
    // Local +Z faces the reader; keep the post behind the boards' back face.
    post.position.z = -0.24;
    post.castShadow = post.receiveShadow = true;
    group.add(post);
    selected.forEach((route, i) => {
      const panel = board(route, x, z, large ? 3.2 : 2.6);
      panel.position.y = large ? height - 0.35 - i * 0.92 : 1.85;
      group.add(panel);
    });
    root.add(group);
    signs.push(group);
    colliders.push({ x, z, radius: 0.2 });
  }
  sign(-3.5, -5, routes, { x: 0, z: 0 }, true);
  sign(-9, -17, [routes[0]], { x: 0, z: 0 });
  sign(-13, -25, [routes[0]], { x: -9, z: -17 });
  sign(13, 12, [routes[1]], { x: 0, z: 0 });
  sign(27, 29, [routes[1]], { x: 13, z: 12 });
  for (const z of [-70, -170, -270, -330]) sign(5, z, [routes[2]], { x: 0, z: z + 25 });
  let terrainVersion = world.terrainVersion;
  function update() {
    if (terrainVersion === world.terrainVersion) return;
    terrainVersion = world.terrainVersion;
    for (const group of signs) group.position.y = world.terrainHeight(group.position.x, group.position.z);
  }
  return { root, colliders, update, reset() { terrainVersion = -1; update(); } };
}
