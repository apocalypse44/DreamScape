// three r128 shades every point light on every lit pixel (one unrolled lighting block each), however far
// away. Eleven lamps scattered across the kingdoms made load frames GPU-heavy, and the main thread waits on
// that queue at each new shader: in paired cold loads, startup took ~28-33 s with them and ~19-21 s without.
// Keep a fixed few real lights and give them to the lamps nearest the camera each frame. Lamps are still
// made with `new THREE.PointLight` and animated as before; they just never reach a shader themselves.
const OFF_LAYER = 31; // a layer no camera renders: a lamp there is left out of every program

export function createLightPool(scene, size = 3) {
  const Base = THREE.PointLight, lamps = new Set();
  // ponytail: a global swap, so call this before anything builds lamps. Lamps that cast shadows would lose
  // them here; none do.
  THREE.PointLight = class extends Base { constructor(...args) { super(...args); lamps.add(this); } };
  const slots = Array.from({ length: size }, () => { const light = new Base(0xffffff, 0); scene.add(light); return light; });
  const live = [];

  function shownIn(object) { // visible all the way up to this scene
    for (; object; object = object.parent) if (!object.visible) return false; else if (object === scene) return true;
    return false;
  }
  const at = (lamp, i) => lamp.matrixWorld.elements[12 + i];

  return {
    slots,
    // Call before each render, after the frame has moved things.
    update(viewer) {
      live.length = 0;
      for (const lamp of lamps) {
        if (!shownIn(lamp)) { lamp.layers.set(0); continue; } // another scene's lamp, or a hidden one: as before
        lamp.layers.set(OFF_LAYER);
        if (!(lamp.intensity > 0)) continue;
        lamp.updateWorldMatrix(true, false);
        // How far the camera is outside the lamp's reach (negative: inside it). Endless lamps come first.
        const gap = Math.hypot(at(lamp, 0) - viewer.x, at(lamp, 1) - viewer.y, at(lamp, 2) - viewer.z) - (lamp.distance || Infinity);
        live.push({ gap, lamp });
      }
      live.sort((a, b) => a.gap - b.gap);
      slots.forEach((slot, i) => {
        const lamp = live[i]?.lamp;
        if (!lamp) { slot.intensity = 0; return; }
        slot.position.set(at(lamp, 0), at(lamp, 1), at(lamp, 2));
        slot.color.copy(lamp.color);
        slot.intensity = lamp.intensity; slot.distance = lamp.distance; slot.decay = lamp.decay;
      });
    },
  };
}
