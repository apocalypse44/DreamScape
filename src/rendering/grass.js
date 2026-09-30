/* A fixed pool of nearby grass patches; no extra meshes accumulate on travel. */
export function createGrass({ scene, terrainHeight, hash, chunks }) {
  const status = document.querySelector('#grassStatus');
  const radius = 43;
  const spacing = 1.4;
  const capacity = (radius * 2 + 1) ** 2;
  const dummy = new THREE.Object3D();
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
  let mesh = null;
  let cellX = null;
  let cellZ = null;
  let builtVersion = -1;
  let builtAt = 0;
  let ready = false;
  let failed = false;
  let lastLabel = '';
  const label = text => {
    if (text !== lastLabel) { status.textContent = text; lastLabel = text; }
  };

  new THREE.GLTFLoader().load(
    'assets/grass_medium_01_1k.gltf/grass_medium_01_1k.gltf',
    gltf => {
      const source = gltf.scene.getObjectByName('grass_medium_01_tall_b_LOD0');
      if (!source?.isMesh) {
        failed = true;
        label('Grass unavailable: model variant missing');
        return;
      }
      gltf.scene.updateMatrixWorld(true);
      const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const height = box.max.y - box.min.y;
      geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      geometry.scale(0.65 / Math.max(height, 0.001), 0.65 / Math.max(height, 0.001), 0.65 / Math.max(height, 0.001));
      const material = source.material.clone();
      // Cutout blades avoid sorting artifacts between overlapping instances.
      material.transparent = false;
      material.alphaTest = 0.45;
      material.depthWrite = true;
      material.roughness = 0.85;
      mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      // Textures remain shared by the retained material; unused geometry is freed.
      const geometries = new Set(), materials = new Set();
      gltf.scene.traverse(object => {
        if (object.isMesh) {
          geometries.add(object.geometry);
          materials.add(object.material);
        }
      });
      geometries.forEach(item => item.dispose());
      materials.forEach(item => item.dispose());
      ready = true;
    },
    undefined,
    error => { failed = true; console.warn('Grass model failed to load.', error); }
  );

  return {
    update(enabled, position, chaos, terrainVersion) {
      updateGround(enabled);
      label(!enabled ? 'Grass: off' : failed ? 'Grass unavailable' : ready ? 'Grass: ground + nearby blades' : 'Loading grass...');
      if (!mesh) return;
      mesh.visible = enabled;
      if (!enabled) return;
      mesh.material.envMapIntensity = 0.8 - chaos * 0.5;
      const cx = Math.floor(position.x / spacing), cz = Math.floor(position.z / spacing);
      // Re-seat blades when the terrain reshapes, at most ~3x per second.
      // ponytail: blades can lag the ground by up to 0.3s while it moves; move to a vertex shader if visible.
      const now = performance.now();
      const reshaped = terrainVersion !== builtVersion && now - builtAt > 300;
      if (cx === cellX && cz === cellZ && !reshaped) return;
      cellX = cx; cellZ = cz;
      builtVersion = terrainVersion;
      builtAt = now;
      let count = 0;
      for (let x = cx - radius; x <= cx + radius; x++) {
        for (let z = cz - radius; z <= cz + radius; z++) {
          if ((x - cx) ** 2 + (z - cz) ** 2 > radius ** 2) continue;
          const distance = Math.hypot(x - cx, z - cz) * spacing;
          const density = distance < 18 ? 1 : distance < 36 ? 0.3 : 0.08;
          if (hash(x + 151, z + 263) > density) continue;
          const wx = (x + hash(x + 71, z)) * spacing;
          const wz = (z + hash(x, z + 93)) * spacing;
          const y = terrainHeight(wx, wz);
          // Keep grass off steep slopes where a flat tuft would float.
          if (Math.abs(terrainHeight(wx + 0.4, wz) - y) > 0.3 ||
              Math.abs(terrainHeight(wx, wz + 0.4) - y) > 0.3) continue;
          dummy.position.set(wx, y - 0.025, wz);
          dummy.rotation.set(0, hash(x + 11, z + 17) * Math.PI * 2, 0);
          dummy.scale.setScalar(0.7 + hash(x + 29, z + 41) * 0.7);
          dummy.updateMatrix();
          mesh.setMatrixAt(count++, dummy.matrix);
        }
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
}
