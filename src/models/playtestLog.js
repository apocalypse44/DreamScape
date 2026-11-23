// Playtest log (PLAYTEST.md): FPS dips, falls, resets, how long each quest step took, and any other event.
// Pure: no DOM. The screens and the upload are in views/playtest.js.

const LOW_FPS = 30;

/** Feed it FPS samples and events; report() returns the summary. now() returns seconds. */
export function createLog(now) {
  const t0 = now(), events = [], fps = [];
  let dip = null, step = null;
  const at = () => +(now() - t0).toFixed(1);
  const event = (type, data = {}) => { events.push({ t: at(), type, ...data }); };
  return {
    events,
    event,
    /** One sample about every 0.5 s. Consecutive samples under 30 FPS become one 'fps-dip' event. */
    sample(value, ctx = {}) {
      fps.push(value);
      if (value < LOW_FPS) {
        if (!dip) { dip = { t: at(), type: 'fps-dip', minFps: value, seconds: 0, ...ctx }; events.push(dip); }
        dip.minFps = Math.min(dip.minFps, value); dip.seconds = +(at() - dip.t + 0.5).toFixed(1);
      } else dip = null;
    },
    /** A new quest step: also records how long the previous one took. */
    step(title, ctx = {}) {
      if (!title || title === step?.title) return;
      if (step) step.took = +(at() - step.t).toFixed(1);
      step = { t: at(), type: 'step', title, ...ctx }; events.push(step);
    },
    report() {
      const sorted = [...fps].sort((a, b) => a - b);
      const count = type => events.filter(e => e.type === type).length;
      return {
        minutes: +(at() / 60).toFixed(1),
        fps: sorted.length ? {
          average: Math.round(fps.reduce((a, b) => a + b, 0) / fps.length),
          worst1pct: sorted[Math.floor(sorted.length * 0.01)],
          percentUnder30: Math.round(100 * sorted.filter(v => v < LOW_FPS).length / sorted.length),
        } : null,
        dips: count('fps-dip'), falls: count('fall'), resets: count('reset'), steps: count('step'),
        helpOpened: count('help'), events,
      };
    },
  };
}
