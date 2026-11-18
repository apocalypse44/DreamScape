// renderer.compile() only builds programs. The GPU driver finishes them, and uploads each object's buffers
// and textures, on the first frame that actually draws the object, so things hidden at startup (chaos-mode
// sand vortexes, arenas, effects) used to stall the frame they first appeared on: entering chaos the first
// time took ~2 s of 500-750 ms frames. Draw everything once behind the intro instead, in a tiny viewport.
export function warmEverything(renderer, scene, camera) {
  const shown = new Set(), saved = [];
  scene.traverseVisible(object => shown.add(object));
  scene.traverse(object => {
    saved.push([object, object.visible, object.frustumCulled]);
    // A light that isn't lit now must stay out: a different light count would build a second set of programs.
    object.visible = object.isLight ? shown.has(object) : true;
    object.frustumCulled = false;
  });
  const size = renderer.getSize(new THREE.Vector2());
  renderer.setViewport(0, 0, 4, 4);
  try { renderer.render(scene, camera); }
  finally {
    renderer.setViewport(0, 0, size.x, size.y);
    for (const [object, visible, culled] of saved) { object.visible = visible; object.frustumCulled = culled; }
  }
}
