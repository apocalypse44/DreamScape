// Diamond fingerposts (Phase 6): timber posts at the gate, the quarry's south junction and the Row,
// each with one pointed board per destination, turned to point at it. The name reads from both sides.
// Layout: FINGERPOSTS in src/models/diamondStory.js.
import { fingerposts } from '../models/diamondStory.js';

function boardTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#4a3624'; g.fillRect(0, 0, 512, 80);
  g.strokeStyle = '#b08d57'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 74);
  g.fillStyle = '#f3e2b8'; g.font = 'bold 40px "DM Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 42, 480);
  return new THREE.CanvasTexture(c);
}

// kingdom: world.diamond. surfaceHeight(x, z): drawn ground.
export function buildDiamondSigns({ scene, kingdom, surfaceHeight }) {
  const root = new THREE.Group(); root.name = 'diamond-signs'; scene.add(root);
  const colliders = [];
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3624, roughness: 0.9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.8 });
  for (const post of fingerposts(kingdom)) {
    const y = surfaceHeight(post.x, post.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.6, 8), wood);
    pole.position.set(post.x, y + 1.8, post.z); pole.castShadow = true;
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), brass); cap.scale.y = 1.4; cap.position.set(post.x, y + 3.8, post.z);
    root.add(pole, cap);
    colliders.push({ x: post.x, z: post.z, radius: 0.3 });
    post.boards.forEach((b, i) => {
      const arm = new THREE.Group();
      arm.position.set(post.x, y + 3.25 - i * 0.52, post.z);
      arm.rotation.y = b.yaw - Math.PI / 2;            // local +x points at the destination
      const face = new THREE.MeshStandardMaterial({ map: boardTexture(b.label), roughness: 0.85 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.42, 0.07), [wood, wood, wood, wood, face, face]);
      board.position.x = 1.35;
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.3, 0.42, 3), wood);   // the pointed end
      tip.rotation.set(0, 0, -Math.PI / 2); tip.scale.z = 0.25; tip.position.x = 2.75;
      board.castShadow = true;
      arm.add(board, tip); root.add(arm);
    });
  }
  return { root, colliders };
}
