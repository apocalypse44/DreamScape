// Recorded voice lines (VOICE_PLAN.md): one MP3 per caption, found by its caption text in assets/voice/index.json
// (tools/make_voices.py writes it; sounds with no caption, like Sile's laughs, use 'scene/id').
// Load-time rules: nothing at boot. A scene asks for its lines when it is queued; files arrive 4 at a time at low
// priority through fetch (never <audio>, which holds a connection open) and decode into fx.js's audio context.
// A line that hasn't arrived plays as text only; nothing ever waits on the network.
import { audio } from '../rendering/fx.js';

const ROOT = 'assets/voice/', AT_ONCE = 4;
let map = null, mapping = null;       // caption text or 'scene/id' -> 'scene/file.mp3'
const buffers = new Map();            // file -> AudioBuffer, or 'loading'
const waiting = [], playing = new Set();
let fetching = 0, lineEnd = 0, speakingUntil = 0; // speakingUntil: performance.now() ms, for the music's duck

function index() {
  mapping ||= fetch(ROOT + 'index.json', { priority: 'low' }).then(r => (r.ok ? r.json() : {})).catch(() => ({}))
    .then(m => (map = m));
  return mapping;
}
function pump() {
  while (fetching < AT_ONCE && waiting.length) {
    const file = waiting.shift(); fetching++;
    fetch(ROOT + file, { priority: 'low' }).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then(data => audio()?.decodeAudioData(data))
      .then(buffer => { if (buffers.has(file)) buffers.set(file, buffer); }) // released meanwhile: drop it
      .catch(() => buffers.delete(file))
      .finally(() => { fetching--; pump(); });
  }
}
// keys: caption texts / 'scene/id's, or a folder name ('sile-fight') for everything in it.
const filesFor = keys => typeof keys === 'string'
  ? Object.values(map).filter(f => f.startsWith(keys + '/'))
  : keys.map(k => map[k]).filter(Boolean);

export const voice = {
  /** Fetch and decode lines ahead of time (a scene being queued, an arena opening). */
  preload(keys) {
    return index().then(() => {
      for (const f of filesFor(keys)) if (!buffers.has(f)) { buffers.set(f, 'loading'); waiting.push(f); }
      pump();
    });
  },
  /** Free decoded audio once its scene is over (about 10 MB per scene). */
  release(keys) { if (map) for (const f of filesFor(keys)) buffers.delete(f); },
  /**
   * Speak a line now, cutting off the last one; next: start when the current line ends instead (a laugh after a
   * taunt). Returns the seconds it takes, or 0 when there is no recording (yet): show the text and move on.
   */
  say(key, { next = false } = {}) {
    const buffer = map && buffers.get(map[key]), ac = buffer?.duration && audio();
    if (!ac || ac.state !== 'running') { if (!next) voice.stop(); return 0; }
    if (!next) voice.stop();
    const source = ac.createBufferSource(), at = Math.max(ac.currentTime, next ? lineEnd : 0);
    source.buffer = buffer; source.connect(ac.destination); source.start(at);
    source.onended = () => playing.delete(source); playing.add(source);
    lineEnd = at + buffer.duration;
    speakingUntil = performance.now() + (lineEnd - ac.currentTime) * 1000;
    return lineEnd - ac.currentTime;
  },
  stop() { for (const s of playing) { try { s.stop(); } catch { /* not started */ } } playing.clear(); lineEnd = speakingUntil = 0; },
  /** A line is being spoken right now (the music ducks under it). */
  get speaking() { return performance.now() < speakingUntil; },
};
