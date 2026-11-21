// Skip scenery the fog already hides. With FogExp2 a point at distance d keeps exp(-(density·d)²) of its
// colour; past 2.3 / density that is under 0.5%, i.e. indistinguishable from the fog. Such groups are
// hidden only for the draw (visibility is restored right after), so game code never sees the change, and
// cutscenes work for free because the test uses wherever the camera is.
// Also turns off shadows for small static meshes (radius < SMALL_SHADOW): ~half the draws were the shadow pass.
const FOG_HIDDEN = 2.3;      // -ln(0.005) = 5.3 = 2.3²
const SPLIT_RADIUS = 60;     // groups larger than this are split into their children for finer culling
const MAX_DEPTH = 4;
const SMALL_SHADOW = 0.6;    // metres; smaller static meshes stop casting shadows
const MARGIN = 10;           // slack for things that drift a little between bound refreshes

// Things that must never vanish: lights (a changed light count recompiles every shader), animated
// characters, particles/sprites, deliberately fog-free glows, and instanced props (their bounds aren't known).
const keep = o => o.isLight || o.isSkinnedMesh || o.isPoints || o.isSprite || o.isInstancedMesh ||
  (o.material && [].concat(o.material).some(m => m.fog === false));

export function createFogCull(scene, camera) {
  const box = new THREE.Box3(), sphere = new THREE.Sphere(), hidden = [];
  let nodes = [], refresh = 0;

  function measure(node) {
    let pinned = false;
    box.makeEmpty();
    node.traverse(o => {
      if (keep(o)) pinned = true;
      if (!o.isMesh || o.isInstancedMesh) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if (o.castShadow && !o.userData.shadowTrimmed && !o.isSkinnedMesh && sphere.radius < SMALL_SHADOW) {
        o.castShadow = false; o.userData.shadowTrimmed = true;
      }
      box.expandByPoint(sphere.center.clone().addScalar(sphere.radius));
      box.expandByPoint(sphere.center.clone().subScalar(sphere.radius));
    });
    node.userData.fogSphere = box.isEmpty() ? null : box.getBoundingSphere(new THREE.Sphere());
    return pinned;
  }

  function collect(node, depth, out) {
    const pinned = measure(node);
    const big = (node.userData.fogSphere?.radius ?? 0) > SPLIT_RADIUS;
    if ((pinned || big) && depth < MAX_DEPTH && node.children.length) {
      for (const child of node.children) collect(child, depth + 1, out);
    } else if (!pinned && node.userData.fogSphere) out.push(node);
  }

  return {
    // Once the world is loaded. Objects added later simply aren't culled (safe default).
    // ponytail: no re-split of groups that gain children later; call rebuild() again if that matters.
    rebuild() {
      const out = [];
      for (const child of scene.children) collect(child, 0, out);
      nodes = out;
    },
    // Call right before the scene render; pair with restore() right after.
    hide() {
      if (!scene.fog?.density || !nodes.length) return;
      measure(nodes[refresh++ % nodes.length]); // one bound refresh per frame keeps moving scenery honest
      const reach = FOG_HIDDEN / scene.fog.density + MARGIN, eye = camera.position;
      for (const node of nodes) {
        const s = node.userData.fogSphere;
        if (node.visible && s && eye.distanceTo(s.center) - s.radius > reach) { node.visible = false; hidden.push(node); }
      }
    },
    restore() { while (hidden.length) hidden.pop().visible = true; },
    get count() { return nodes.length; },
  };
}
