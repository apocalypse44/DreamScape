// Load a glTF and scale it to `height`, centred on x/z with its base at y = 0.
export function loadModel(url, height) {
  return new Promise((resolve, reject) => new THREE.GLTFLoader().load(url, gltf => {
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const scale = height / Math.max(box.max.y - box.min.y, 1e-6);
    model.scale.multiplyScalar(scale);
    model.position.set(
      -(box.min.x + box.max.x) / 2 * scale,
      -box.min.y * scale,
      -(box.min.z + box.max.z) / 2 * scale
    );
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      // Skinned bounds use the bind pose; animated limbs would otherwise pop out of view.
      if (object.isSkinnedMesh) object.frustumCulled = false;
    });
    const object = new THREE.Group();
    object.add(model);
    const size = box.getSize(new THREE.Vector3()).multiplyScalar(scale);
    resolve({ object, size, animations: gltf.animations });
  }, undefined, reject));
}

// Clone a model's materials and make them glow, so tinting one copy leaves the others alone.
export function makeGlow(object, color, intensity) {
  const materials = [];
  object.traverse(child => {
    if (!child.isMesh) return;
    child.material = child.material.clone();
    child.material.emissive = new THREE.Color(color);
    child.material.emissiveIntensity = intensity;
    materials.push(child.material);
  });
  return materials;
}
