// Player settings (the home screen's Settings panel): music, voice and effect volumes (0..1) and subtitles.
// Saved per browser; the game page and the Tutorial Lab page both read them. Storage can be missing or blocked
// (private windows, previews): then the defaults apply and nothing is saved.
export const DEFAULTS = Object.freeze({ music: 1, voices: 1, effects: 1, subtitles: true });
const KEY = 'dreamscape.settings';

export function createSettings(storage = globalThis.localStorage) {
  let values = { ...DEFAULTS };
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === typeof DEFAULTS[k]) values[k] = saved[k];
  } catch { /* defaults */ }
  const listeners = new Set();
  return {
    get(key) { return values[key]; },
    set(key, value) {
      if (!(key in DEFAULTS) || typeof value !== typeof DEFAULTS[key]) return;
      values = { ...values, [key]: typeof value === 'number' ? Math.min(1, Math.max(0, value)) : value };
      try { storage?.setItem(KEY, JSON.stringify(values)); } catch { /* not saved */ }
      for (const f of listeners) f({ ...values });
    },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    get all() { return { ...values }; },
  };
}

export const settings = createSettings(); // the page's shared instance
