// One world day lasts twenty real minutes. Climate and chaos never own this clock.
export const WORLD_CLOCK = Object.freeze({ dayLengthSeconds: 20 * 60, startHour: 9 });

const wrapHour = hour => ((hour % 24) + 24) % 24;

export function createWorldClock({
  dayLengthSeconds = WORLD_CLOCK.dayLengthSeconds,
  startHour = WORLD_CLOCK.startHour,
} = {}) {
  if (!Number.isFinite(dayLengthSeconds) || dayLengthSeconds <= 0 || !Number.isFinite(startHour)) {
    throw new RangeError('World clock needs a positive day length and a finite starting hour.');
  }
  const initialHour = wrapHour(startHour);
  let hour = initialHour;
  let day = 0;
  let paused = false;

  return {
    get hour() { return hour; },
    get day() { return day; },
    get dayProgress() { return hour / 24; },
    get paused() { return paused; },
    get label() {
      const minutes = Math.floor(hour * 60);
      return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    },
    advance(dt) {
      if (paused || !Number.isFinite(dt) || dt <= 0) return;
      const next = hour + dt / dayLengthSeconds * 24;
      day += Math.floor(next / 24);
      hour = next % 24;
    },
    // Demo controls affect time only; they never change the movement/chaos score.
    setHour(value) {
      if (!Number.isFinite(value)) throw new RangeError('World hour must be finite.');
      hour = wrapHour(value);
    },
    setPaused(value) { paused = Boolean(value); },
    reset() { hour = initialHour; day = 0; paused = false; },
  };
}
