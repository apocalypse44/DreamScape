// Keep nearby actors fluid; distant idle skeletons do not need 60 evaluations
// a second. Accumulate time so a reduced update rate keeps animation speed.
export function createAnimationCadence(phase = 0) {
  let elapsed = 0, until = phase * 0.5;
  return (dt, distance, visible = true) => {
    if (!visible) { elapsed = 0; until = 0; return 0; }
    elapsed += dt; until -= dt;
    const interval = distance < 35 ? 0 : distance < 100 ? 0.1 : 0.5;
    if (interval && until > 0) return 0;
    const step = elapsed;
    elapsed = 0; until = interval;
    return step;
  };
}
