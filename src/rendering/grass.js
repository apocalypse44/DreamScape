/* Persistent procedural ground detail; props.js dresses the land. */
// The texture is near-white grain multiplied by each chunk's per-vertex kingdom colour,
// so every kingdom keeps its own ground and borders stay on the real 350 m circle.
export function createGrass({ hash, chunks }) {
  const status = document.querySelector('#grassStatus');
  const size = 128;
  const pixels = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const blade = Math.pow(hash(x + 503, y + 709), 3);
    const patch = hash(Math.floor(x / 8) + 31, Math.floor(y / 8) + 77);
    const v = 175 + blade * 80 - patch * 25;
    pixels.fill(Math.min(255, v), (y * size + x) * 3, (y * size + x) * 3 + 3);
  }
  const groundTexture = new THREE.DataTexture(pixels, size, size, THREE.RGBFormat);
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(16, 16);
  groundTexture.magFilter = THREE.LinearFilter;
  groundTexture.minFilter = THREE.LinearMipmapLinearFilter;
  groundTexture.generateMipmaps = true;
  groundTexture.needsUpdate = true;
  const applied = new WeakSet();
  const updateGround = () => {
    for (const chunk of chunks.values()) {
      const material = chunk.userData.material;
      if (applied.has(material)) continue;
      applied.add(material);
      material.map = groundTexture;
      material.needsUpdate = true;
    }
  };
  return {
    update() {
      updateGround();
      const text = 'Grass: ground texture';
      if (status.textContent !== text) status.textContent = text;
    }
  };
}
