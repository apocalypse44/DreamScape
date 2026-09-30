// The supplied FBX is rigged but has no animation clips or embedded textures.
export function createCharacter({ scene, state, player }) {
  const root = new THREE.Group();
  scene.add(root);
  const status = document.querySelector('#characterStatus');
  const joints = [];
  const swing = new THREE.Quaternion();
  let phase = 0;
  let weight = 0;
  let loaded = false;
  let failed = false;
  let lastStatus = '';

  const manager = new THREE.LoadingManager();
  const loader = new THREE.FBXLoader(manager);
  // FBX expects textures at assets/Textures/Textures/<Part>/...; missing ones sample black, so drop them.
  const mapKeys = ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'specularMap', 'bumpMap', 'emissiveMap'];
  manager.onLoad = () => root.traverse(object => {
    if (!object.isMesh) return;
    for (const material of [].concat(object.material)) {
      for (const key of mapKeys) if (material[key] && !material[key].image) material[key] = null;
      if (!material.map) material.color.set(0x8a8478);
      material.needsUpdate = true;
    }
  });
  loader.load('assets/survival_character.fbx', model => {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const scale = 2.05 / Math.max(box.max.y - box.min.y, 0.001);
    model.scale.multiplyScalar(scale);
    model.position.x -= (box.min.x + box.max.x) * 0.5 * scale;
    model.position.y -= box.min.y * scale;
    model.position.z -= (box.min.z + box.max.z) * 0.5 * scale;
    root.rotation.set(0, 0, 0); // joint axes below are computed in the model frame
    root.add(model);
    root.updateMatrixWorld(true);
    const parentRotation = new THREE.Quaternion();
    model.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
      if (!object.isBone) return;
      // Match primary limbs only, not the numerous twist/corrective bones.
      const match = /^(thigh|calf|upperarm|lowerarm)_([lr])$/i.exec(object.name);
      if (!match) return;
      object.parent.getWorldQuaternion(parentRotation);
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(parentRotation.invert());
      const side = match[2].toLowerCase() === 'l' ? 1 : -1;
      let base = object.quaternion.clone();
      if (/upperarm/i.test(match[1])) {
        // Lower the A-pose arms toward the sides.
        const down = new THREE.Vector3(0, 0, 1).applyQuaternion(parentRotation);
        base.premultiply(new THREE.Quaternion().setFromAxisAngle(down, -0.6 * side));
      }
      joints.push({ bone: object, base, axis,
        limb: match[1].toLowerCase(), side });
    });
    loaded = true;
  }, undefined, error => {
    failed = true;
    console.warn('Character FBX could not load.', error);
  });

  return {
    update(dt, cameraDistance) {
      const mode = state.perspective === 'third' ? 'TPP' : 'FPP';
      const label = `${mode} · V to switch · ${failed ? 'Character unavailable' : loaded ? 'Character: procedural gait' : 'Loading character...'}`;
      if (label !== lastStatus) { status.textContent = label; lastStatus = label; }
      root.visible = loaded && state.perspective === 'third' && cameraDistance > 0.8;
      root.position.copy(player.position);
      root.position.y -= 2.05;
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      const moving = speed > 0.2 && player.grounded;
      const targetYaw = speed > 0.2 ? Math.atan2(player.velocity.x, player.velocity.z) : state.yaw + Math.PI;
      const delta = Math.atan2(Math.sin(targetYaw - root.rotation.y), Math.cos(targetYaw - root.rotation.y));
      root.rotation.y += delta * (1 - Math.exp(-12 * dt));
      weight += ((moving ? Math.min(speed / 9, 1) : 0) - weight) * (1 - Math.exp(-12 * dt));
      phase += dt * (speed > 10 ? 13 : 8);
      for (const joint of joints) {
        const stride = Math.sin(phase) * joint.side;
        let angle = stride * 0.45;
        if (joint.limb === 'calf') angle = Math.max(0, -stride) * 0.9; // +X bends the knee back
        if (joint.limb === 'upperarm') angle = -stride * 0.3;
        if (joint.limb === 'lowerarm') angle = 0.15;
        swing.setFromAxisAngle(joint.axis, angle * weight);
        joint.bone.quaternion.copy(joint.base).premultiply(swing);
      }
    }
  };
}
