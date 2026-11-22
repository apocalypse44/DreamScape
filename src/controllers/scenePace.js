import { voice } from '../views/voice.js';

// Reading pace for the timed story scenes (door, Clover, Heart, Diamond): a line stays until it has been on screen
// long enough to read and its recorded voice has finished, and Space plays the scene fast until the next line.
export const readSeconds = text => text ? Math.max(2.5, text.trim().split(/\s+/).length * 0.3) : 0;
const AFTER_VOICE = 0.3; // a breath between a spoken line and the next

export function createPace() {
  let read = 0, need = 0, rushing = false;
  return {
    show(text = '') {
      const spoken = text ? voice.say(text) : (voice.stop(), 0);
      read = 0; need = Math.max(readSeconds(text), spoken && spoken + AFTER_VOICE); rushing = false;
    },
    rush() { rushing = true; voice.stop(); },
    stop() { voice.stop(); }, // the scene ended or was skipped
    // The scene clock's step. While the current line is unread or still being spoken and the next one (nextAt: its
    // time, or the scene's end) is due, the clock creeps up to just short of nextAt and holds there, however long
    // the voice runs: it must never cross, or the next caption would cut the voice off.
    step(dt, time, nextAt) {
      read += dt;
      if (rushing) return dt * 4;
      if (time + dt < nextAt || read >= need) return dt;
      return Math.min(dt * 0.08, Math.max(0, nextAt - 1e-3 - time));
    },
  };
}
