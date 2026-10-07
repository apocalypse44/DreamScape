// Glowing curtain on the kingdom border circle, tinted with each kingdom's banner colour,
// so crossing from Grimoire Tower into a kingdom is visible from a distance and up close.
export function createKingdomBorder({ scene, world, player }) {
  const radius = world.kingdomStart;
  const geometry = new THREE.CylinderGeometry(radius, radius, 22, 256, 1, true);
  geometry.translate(0, 3, 0); // y -8 .. 14: covers the ravine and the plains
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3), tint = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    tint.set(world.biomeAt(positions.getX(i) * 1.05, positions.getZ(i) * 1.05).banner).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Alpha: strong at the ground, fading upward, broken into soft vertical light bands.
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const fade = ctx.createLinearGradient(0, 0, 0, 64);
  fade.addColorStop(0, '#000'); fade.addColorStop(0.55, '#333'); fade.addColorStop(1, '#ddd');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 256, 64);
  ctx.globalCompositeOperation = 'multiply';
  for (let x = 0; x < 256; x++) {
    const band = 150 + 105 * Math.abs(Math.sin(x * 0.11) * Math.sin(x * 0.037 + 1));
    ctx.fillStyle = `rgb(${band},${band},${band})`; ctx.fillRect(x, 0, 1, 64);
  }
  const alphaMap = new THREE.CanvasTexture(canvas);
  alphaMap.wrapS = THREE.RepeatWrapping;
  alphaMap.repeat.x = 40;

  const veil = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, alphaMap, transparent: true, opacity: 0.55,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  }));
  veil.renderOrder = 1;
  scene.add(veil);
  // Only near the border: from far away its fogged edges read as thin lines across the sky.
  return { update(dt) {
    alphaMap.offset.x += dt * 0.02;
    const away = Math.abs(Math.hypot(player.position.x, player.position.z) - radius);
    veil.material.opacity = 0.55 * (1 - THREE.MathUtils.smoothstep(away, 40, 110));
    veil.visible = veil.material.opacity > 0.01;
  } };
}
