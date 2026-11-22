import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/rendering/music.js', import.meta.url), 'utf8');
const { createMusic, MUSIC_TRACKS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const settle = () => new Promise(resolve => setImmediate(resolve));

test('music respects user activation, crossfades game moods, prioritizes scenes and resumes the background track', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  const events = new Map(), media = [];
  globalThis.document = { hidden: false, hasFocus: () => true, querySelector: () => null,
    addEventListener: (name, handler) => events.set(name, handler) };
  globalThis.window = { addEventListener: (name, handler) => events.set(name, handler) };
  const state = { mode: 'calm', locked: false };
  const mediaFactory = () => {
    const audio = { paused: true, currentTime: 0, duration: 600, plays: 0,
      play() { this.paused = false; this.plays++; return Promise.resolve(); }, pause() { this.paused = true; } };
    media.push(audio); return audio;
  };
  try {
    const music = createMusic({ state, mediaFactory });
    const [calm, calmStandby, chaos, , danger] = media;
    const frames = async (count = 90) => { for (let i = 0; i < count; i++) music.update(1 / 60); await settle(); };
    await frames();
    assert.ok(media.every(a => a.paused && a.plays === 0));
    events.get('pointerdown')(); state.locked = true;
    await frames();
    assert.ok(!calm.paused && calm.volume > 0);
    calm.currentTime = 42;
    state.mode = 'chaos'; music.update(.04); await settle();
    assert.ok(calm.volume > 0 && chaos.volume > 0); // actual overlap during fade
    await frames();
    assert.ok(calm.paused && !chaos.paused);
    state.cinematic = true; await frames();
    assert.equal(music.current, 'danger');
    assert.ok(chaos.paused && !danger.paused);
    state.cinematicMood = 'calm'; await frames();
    assert.equal(music.current, 'calm');
    assert.ok(!calm.paused && danger.paused);
    state.cinematic = false; state.mode = 'calm'; await frames();
    assert.equal(calm.currentTime, 42);
    assert.ok(!calm.paused && danger.paused);
    // Begin the repeat before the silent tail. A slow-starting standby must
    // leave the outgoing stream audible until playback actually advances.
    calm.currentTime = MUSIC_TRACKS.calm.loopEnd - 8;
    await frames();
    assert.ok(!calm.paused && !calmStandby.paused);
    assert.equal(calmStandby.currentTime, MUSIC_TRACKS.calm.loopStart);
    assert.equal(calmStandby.volume, 0);
    const fullVolume = calm.volume;
    calm.currentTime += 4; calmStandby.currentTime += 4; await frames(1);
    assert.ok(calm.volume > 0 && calmStandby.volume > 0);
    assert.ok(Math.abs(calm.volume ** 2 + calmStandby.volume ** 2 - fullVolume ** 2) < 1e-8);
    calm.currentTime += 4; calmStandby.currentTime += 4; await frames(1);
    assert.ok(calm.paused && calm.volume === 0 && !calmStandby.paused);
    assert.equal(calmStandby.volume, fullVolume);
    // The same two streams swap roles again on the following repeat.
    calmStandby.currentTime = MUSIC_TRACKS.calm.loopEnd - 8; await frames(1);
    assert.ok(!calm.paused && !calmStandby.paused);
    assert.equal(calm.currentTime, MUSIC_TRACKS.calm.loopStart);
    const key = { code: 'KeyN', repeat: false, target: { tagName: 'BODY' }, preventDefault() {}, stopImmediatePropagation() {} };
    events.get('keydown')(key); await settle();
    assert.equal(music.muted, true);
    assert.ok(media.every(a => a.paused && a.volume === 0));
    music.reset(); await frames();
    assert.equal(music.muted, true);
    assert.ok(media.every(a => a.currentTime === 0 && a.paused));
    events.get('keydown')(key); await frames();
    document.hidden = true; events.get('visibilitychange')(); await settle();
    assert.ok(media.every(a => a.paused && a.volume === 0));
    document.hidden = false; state.locked = false; await frames();
    assert.ok(media.every(a => a.paused));
  } finally { globalThis.document = oldDocument; globalThis.window = oldWindow; }
});

test('music ducks under a recorded voice line and swells back after it', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  const events = new Map(), media = [];
  globalThis.document = { hidden: false, hasFocus: () => true, querySelector: () => null, addEventListener: (n, h) => events.set(n, h) };
  globalThis.window = { addEventListener: (n, h) => events.set(n, h) };
  const mediaFactory = () => { const a = { paused: true, currentTime: 0, duration: 600, play() { this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } }; media.push(a); return a; };
  let talking = false;
  try {
    const music = createMusic({ state: { mode: 'calm', locked: true }, mediaFactory, speaking: () => talking });
    const frames = async (n = 120) => { for (let i = 0; i < n; i++) music.update(1 / 60); await settle(); };
    events.get('pointerdown')(); await frames();
    const full = media[0].volume;
    talking = true; await frames(15);                    // a quarter second into the line
    assert.ok(Math.abs(media[0].volume - full * .35) < 1e-9);
    talking = false; await frames();
    assert.ok(Math.abs(media[0].volume - full) < 1e-9);
  } finally { globalThis.document = oldDocument; globalThis.window = oldWindow; }
});
