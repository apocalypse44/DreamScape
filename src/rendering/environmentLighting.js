// Keep Theatre's surface materials, with reflections captured from the procedural
// sky alone. Capture at intervals rather than rendering six extra views per frame.
export function createEnvironmentLighting({ scene, renderer, profiles, sky }) {
  const originalEnvironment = scene.environment;
  const replacements = new Map(), originals = new Map(), standardMaterials = new Map();
  let active = false, intensity = 1, target = null, elapsed = 5, lastSignature = '';
  const captureScene = new THREE.Scene();
  const captureSky = sky.mesh.clone();
  captureSky.position.set(0, 0, 0);
  captureSky.visible = true;
  captureScene.add(captureSky);
  const pmrem = new THREE.PMREMGenerator(renderer);

  for (const [original, surface] of profiles) {
    const material = new THREE.MeshStandardMaterial({
      color: original.color.clone(), emissive: original.emissive.clone(),
      emissiveIntensity: original.emissiveIntensity, transparent: original.transparent,
      opacity: original.opacity, side: original.side, flatShading: Boolean(original.flatShading),
      ...surface,
    });
    replacements.set(original, material);
    originals.set(material, original);
  }
  function prepareMaterial(material) {
    const original = originals.get(material) || material;
    const next = active ? replacements.get(original) || original : original;
    if (next.isMeshStandardMaterial) {
      if (!standardMaterials.has(next)) {
        standardMaterials.set(next, next.envMapIntensity);
        next.addEventListener('dispose', () => standardMaterials.delete(next));
      }
      next.envMapIntensity = active ? intensity : standardMaterials.get(next);
    }
    return next;
  }
  const prepare = root => root.traverse(object => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(prepareMaterial) : prepareMaterial(object.material);
  });

  return {
    prepare,
    update(enabled, strength, dt, signature, force = false) {
      intensity = strength;
      elapsed += dt;
      if (enabled !== active) {
        active = enabled;
        prepare(scene);
      }
      if (active && (!target || force || (elapsed >= 5 && signature !== lastSignature))) {
        const previous = target;
        const flash = sky.uniforms.uFlash.value;
        sky.uniforms.uCapture.value = 1;
        sky.uniforms.uFlash.value = 0;
        try {
          target = pmrem.fromScene(captureScene, 0, 0.1, 100);
        } finally {
          sky.uniforms.uCapture.value = 0;
          sky.uniforms.uFlash.value = flash;
        }
        previous?.dispose();
        lastSignature = signature;
        elapsed = 0;
      }
      scene.environment = active ? target?.texture || null : originalEnvironment;
      for (const [material, originalIntensity] of standardMaterials) {
        material.envMapIntensity = active ? intensity : originalIntensity;
      }
    },
  };
}
