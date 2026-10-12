/* Three.js r128 needs explicit PMREM filtering for HDR environment lighting. */
export function createHDRILighting({ scene, renderer, profiles, onStatus }) {
  const originalEnvironment = scene.environment;
  const replacements = new Map();
  const originals = new Map();
  const standardMaterials = new Map();
  let environmentTarget = null;
  let skyTexture = null;
  let active = false;
  let intensity = 1;

  for (const [original, surface] of profiles) {
    const material = new THREE.MeshStandardMaterial({
      color: original.color.clone(),
      emissive: original.emissive.clone(),
      emissiveIntensity: original.emissiveIntensity,
      transparent: original.transparent,
      opacity: original.opacity,
      side: original.side,
      flatShading: Boolean(original.flatShading), // Lambert/Basic originals have no flatShading
      ...surface
    });
    replacements.set(original, material);
    originals.set(material, original);
  }

  const prepare = root => root.traverse(object => {
    if (!object.isMesh) return;
    const original = originals.get(object.material) || object.material;
    object.material = active ? replacements.get(original) || original : original;
    const material = object.material;
    if (material.isMeshStandardMaterial && !standardMaterials.has(material)) {
      standardMaterials.set(material, material.envMapIntensity);
      material.addEventListener('dispose', () => standardMaterials.delete(material));
    }
    if (material.isMeshStandardMaterial) {
      material.envMapIntensity = active ? intensity : standardMaterials.get(material);
    }
  });

  const update = (enabled, strength) => {
    intensity = strength;
    const next = enabled && environmentTarget !== null;
    // The atmosphere pass refreshes the fog every frame. Choose the visible sky
    // here after that pass, independently of the filtered reflection texture.
    scene.background = next ? skyTexture : scene.fog.color;
    if (next !== active) {
      active = next;
      scene.environment = active ? environmentTarget.texture : originalEnvironment;
      prepare(scene);
    }
    for (const [material, originalIntensity] of standardMaterials) {
      material.envMapIntensity = active ? intensity : originalIntensity;
    }
  };

  if (!THREE.EXRLoader || !window.fflate) {
    onStatus('HDRI unavailable');
    return { update, prepare };
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  new THREE.EXRLoader().setDataType(THREE.HalfFloatType).load(
    'assets/DaySkyHDRI066A_1K/DaySkyHDRI066A_1K_HDR.exr',
    texture => {
      try {
        environmentTarget = pmrem.fromEquirectangular(texture);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        skyTexture = texture;
        onStatus('Day Sky 066A HDRI');
      } catch (error) {
        texture.dispose();
        console.warn('HDRI filtering failed; keeping the existing atmosphere.', error);
        onStatus('HDRI unavailable');
      } finally {
        pmrem.dispose();
      }
    },
    progress => {
      if (progress.lengthComputable) {
        onStatus(`Loading day sky ${Math.round(progress.loaded / progress.total * 100)}%`);
      }
    },
    error => {
      pmrem.dispose();
      console.warn('HDRI could not load; keeping the existing atmosphere.', error);
      onStatus('HDRI unavailable');
    }
  );
  return { update, prepare };
}
