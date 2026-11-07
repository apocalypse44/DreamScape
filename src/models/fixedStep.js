// Bounded fixed physics steps with a render interpolation fraction. A stalled
// tab cannot trigger an unbounded catch-up loop or one giant collision step.
export function createFixedStepper({ step = 1 / 60, maxSteps = 8 } = {}) {
  if (!Number.isFinite(step) || !(step > 0) || !Number.isInteger(maxSteps) || maxSteps < 1) throw new Error('Invalid fixed-step settings');
  let remaining = 0;
  return {
    advance(dt, update) {
      if (!Number.isFinite(dt) || dt <= 0) return remaining / step;
      remaining += Math.min(dt, step * maxSteps);
      let count = 0;
      while (remaining + 1e-10 >= step && count < maxSteps) {
        update(step); remaining = Math.max(0, remaining - step); count++;
      }
      return Math.min(1, remaining / step);
    },
    reset() { remaining = 0; },
  };
}
