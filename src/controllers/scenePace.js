// Reading pace for the timed story scenes (door, Clover): a line stays until it has been on screen
// long enough to read, and Space plays the scene fast until the next line.
export const readSeconds = text => text ? Math.max(2.5, text.trim().split(/\s+/).length * 0.3) : 0;

export function createPace() {
  let read = 0, need = 0, rushing = false;
  return {
    show(text = '') { read = 0; need = readSeconds(text); rushing = false; },
    rush() { rushing = true; },
    // The scene clock's step: nearly still while the current line is unread and the next one
    // (nextAt: its time, or the scene's end) is due. The camera drifts rather than freezing.
    step(dt, time, nextAt) {
      read += dt;
      if (rushing) return dt * 4;
      return time + dt >= nextAt && read < need ? dt * 0.08 : dt;
    },
  };
}
