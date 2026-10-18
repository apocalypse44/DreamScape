export const MUSIC_TRACKS = {
  // Audible boundaries measured from these recordings, excluding their silent padding.
  calm: { file: 'sb_reverie.mp3', title: 'Reverie', level: .7, loopStart: 1.48, loopEnd: 221.8 },
  chaos: { file: 'Legionnaire2022.mp3', title: 'Legionnaire', level: .6, loopStart: 1.03, loopEnd: 183.76 },
  danger: { file: 'Anabasis_I.mp3', title: 'Anabasis I', level: .8, loopStart: .87, loopEnd: 556.73 },
};

// Stream recordings instead of decoding the three long tracks into memory.
export function createMusic({ state, mediaFactory = () => new Audio() }) {
  const tracks = Object.fromEntries(Object.entries(MUSIC_TRACKS).map(([id, track]) => {
    const decks = Array.from({ length: 2 }, () => {
      const audio = mediaFactory();
      audio.preload = 'metadata'; audio.loop = false; audio.volume = 0;
      audio.src = `assets/music/${track.file}`;
      return { audio, starting: false, failed: false, blocked: false, wanted: false };
    });
    return [id, { ...track, decks, active: 0, blend: null, gain: 0 }];
  }));
  let unlocked = false, muted = false, selected = null;
  const volume = .35;
  const button = document.querySelector('#musicToggle');
  function refresh() {
    if (!button) return;
    button.textContent = `MUSIC · ${muted ? 'OFF' : 'ON'} · N`;
    button.setAttribute('aria-pressed', String(!muted));
    button.setAttribute('aria-label', muted ? 'Unmute background music (N)' : 'Mute background music (N)');
    button.title = selected ? MUSIC_TRACKS[selected].title : 'Background music';
  }
  function silence() {
    for (const track of Object.values(tracks)) {
      track.gain = 0;
      track.decks.forEach(pause);
    }
  }
  function pause(deck) { deck.wanted = false; deck.audio.pause(); deck.audio.volume = 0; }
  function rewind(track) {
    track.decks.forEach(deck => { pause(deck); deck.audio.currentTime = 0; });
    track.active = 0; track.blend = null; track.gain = 0;
  }
  const allowed = () => unlocked && !muted && !document.hidden && document.hasFocus() &&
    (state.locked || state.mapOpen || state.cinematic);
  function play(track) {
    track.wanted = true;
    if (!track.audio.paused || track.starting || track.failed || track.blocked) return;
    track.starting = true;
    Promise.resolve().then(() => { if (allowed() && track.wanted) return track.audio.play(); }).then(() => {
      if (!allowed() || !track.wanted) track.audio.pause();
    }).catch(error => {
      track.blocked = error?.name === 'NotAllowedError';
      track.failed = error?.name !== 'NotAllowedError' && error?.name !== 'AbortError';
    }).finally(() => { track.starting = false; });
  }
  function loop(track) {
    let outgoing = track.decks[track.active];
    const end = Math.min(track.loopEnd, outgoing.audio.duration);
    // Preload the standby stream while the current one plays, without decoding
    // the entire recording into a large Web Audio buffer.
    track.decks.forEach(deck => { deck.audio.preload = 'auto'; });
    if (!track.blend && Number.isFinite(end) && outgoing.audio.currentTime >= end - 8) {
      const index = 1 - track.active, incoming = track.decks[index];
      if (!incoming.failed && !incoming.blocked) {
        incoming.audio.currentTime = track.loopStart;
        track.blend = { index, duration: Math.max(.25, end - outgoing.audio.currentTime) };
      }
    }
    play(outgoing);
    if (!track.blend) { outgoing.audio.volume = track.gain; return; }
    const incoming = track.decks[track.blend.index];
    play(incoming);
    // Follow actual playback time: a delayed play() or buffering must not fade
    // out the old stream before the new stream has started making progress.
    const progress = Math.max(0, Math.min(1, (incoming.audio.currentTime - track.loopStart) / track.blend.duration));
    outgoing.audio.volume = track.gain * Math.cos(progress * Math.PI / 2);
    incoming.audio.volume = track.gain * Math.sin(progress * Math.PI / 2);
    if (progress >= 1) {
      pause(outgoing); outgoing.audio.currentTime = 0;
      track.active = track.blend.index; track.blend = null;
    }
  }
  function update(dt) {
    const next = state.cinematic ? state.cinematicMood ?? 'danger' : state.mode === 'chaos' ? 'chaos' : 'calm';
    if (next !== selected) {
      selected = next;
      if (next === 'danger') rewind(tracks.danger);
      refresh();
    }
    if (!allowed()) {
      silence(); return;
    }
    const step = Math.max(0, Math.min(dt, .1)) * volume / 1.2;
    for (const [id, track] of Object.entries(tracks)) {
      const target = id === selected ? volume * track.level : 0;
      track.gain = track.gain < target ? Math.min(target, track.gain + step) : Math.max(target, track.gain - step);
      if (track.gain > 0) loop(track);
      else track.decks.forEach(pause);
    }
  }
  function unlock() { unlocked = true; for (const track of Object.values(tracks)) track.decks.forEach(deck => { deck.blocked = false; }); update(.04); }
  function toggle() { muted = !muted; unlock(); refresh(); }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('pointerlockchange', () => update(.04));
  document.addEventListener('visibilitychange', () => update(.04));
  window.addEventListener('blur', silence);
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.code === 'KeyN' && !event.repeat) {
      event.preventDefault(); event.stopImmediatePropagation(); toggle();
    } else unlock();
  }, true);
  button?.addEventListener('click', toggle);
  refresh();
  return {
    update,
    get current() { return selected; },
    get muted() { return muted; },
    reset() { selected = null; Object.values(tracks).forEach(rewind); refresh(); },
  };
}
