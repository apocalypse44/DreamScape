// Dynamic resolution on high-DPI screens: fewer pixels when frames are slow, more with headroom.
// Pixel shading (fill rate) scales with pixelRatio squared, but only helps when the GPU is the
// bottleneck. So the governor
//   - never renders below the screen's CSS resolution (min 1.0): stretching that looks blurry;
//   - tests each drop: if frames are not at least 10% faster two seconds later, the frame cost is
//     on the CPU (terrain, A*, animation), so it restores full sharpness and stops trying;
//   - climbs back slowly after 4 s of headroom, never above a ratio that was already too slow.
export function createResolutionGovernor(renderer, { max = Math.min(devicePixelRatio, 1.75), min = Math.min(1, max) } = {}) {
  let ratio = max, ceiling = max, average = 16.7, slow = 0, fast = 0;
  let trial = null;     // { from, before, time } while a drop is being tested
  let cpuBound = false; // a drop did not help: keep full resolution from now on

  function set(next) {
    ratio = next;
    slow = fast = 0;
    renderer.setPixelRatio(ratio);
  }

  return {
    get ratio() { return ratio; },
    update(rawDt) {
      if (rawDt > 0.25) return; // the tab was hidden or a load hitch: not a real frame time
      average += (rawDt * 1000 - average) * 0.05;
      if (trial) {
        trial.time += rawDt;
        if (trial.time < 2) return;
        if (average > trial.before * 0.9) { cpuBound = true; set(trial.from); } // no real gain: undo
        trial = null;
        return;
      }
      if (cpuBound) return;
      slow = average > 22 ? slow + rawDt : 0;
      fast = average < 17.5 ? fast + rawDt : 0;
      if (slow > 1 && ratio > min) {
        trial = { from: ratio, before: average, time: 0 };
        ceiling = Math.max(min, ratio - 0.05);
        set(Math.max(min, ratio - 0.15));
      } else if (fast > 4 && ratio < ceiling) {
        set(Math.min(ceiling, ratio + 0.1));
      }
    }
  };
}
