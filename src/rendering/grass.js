/* Procedural grass ground texture for Theatre mode. Blade models were removed; props.js dresses the land. */
// Only the green lands get it, so each kingdom keeps its own ground color in Theatre mode.
const GRASSY = new Set(['hub', 'trees']);

export function createGrass({ hash, chunks }) {
  const status = document.querySelector('#grassStatus');
  // Procedural ground detail: the model's blade atlas is not a tileable lawn.
  const size = 128;
  const pixels = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = hash(x + 503, y + 709);
    const blade = Math.pow(noise, 3);
    const i = (y * size + x) * 3;
    pixels[i] = 65 + blade * 48;
    pixels[i + 1] = 87 + blade * 57;
    pixels[i + 2] = 35 + blade * 28;
  }
  const groundTexture = new THREE.DataTexture(pixels, size, size, THREE.RGBFormat);
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(16, 16);
  groundTexture.encoding = THREE.sRGBEncoding;
  groundTexture.magFilter = THREE.LinearFilter;
  groundTexture.minFilter = THREE.LinearMipmapLinearFilter;
  groundTexture.generateMipmaps = true;
  groundTexture.needsUpdate = true;
  const groundStates = new WeakMap();
  const updateGround = enabled => {
    for (const chunk of chunks.values()) {
      if (!GRASSY.has(chunk.userData.biome.kind)) continue;
      const material = chunk.userData.material;
      let state = groundStates.get(material);
      if (!state) {
        state = { map: material.map, color: material.color.clone(), enabled: false };
        groundStates.set(material, state);
      }
      if (state.enabled === enabled) continue;
      state.enabled = enabled;
      material.map = enabled ? groundTexture : state.map;
      if (enabled) material.color.set(0xffffff);
      else material.color.copy(state.color);
      material.needsUpdate = true;
    }
  };
  return {
    update(enabled) {
      updateGround(enabled);
      const text = enabled ? 'Grass: ground texture' : 'Grass: off';
      if (status.textContent !== text) status.textContent = text;
    }
  };
}
