import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSettings, DEFAULTS } from '../src/models/settings.js';

const memory = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };

test('defaults when nothing is saved, or storage is missing or broken', () => {
  assert.deepEqual(createSettings(memory()).all, DEFAULTS);
  assert.deepEqual(createSettings(undefined).all, DEFAULTS);
  assert.deepEqual(createSettings({ getItem() { throw new Error('blocked'); } }).all, DEFAULTS);
  assert.deepEqual(createSettings(memory({ 'dreamscape.settings': '{not json' })).all, DEFAULTS);
});

test('saved values load; wrong types are ignored; volumes clamp to 0..1; changes save and notify', () => {
  const store = memory({ 'dreamscape.settings': JSON.stringify({ music: .4, voices: 'loud', subtitles: false }) });
  const s = createSettings(store);
  assert.equal(s.get('music'), .4); assert.equal(s.get('voices'), 1); assert.equal(s.get('subtitles'), false);
  let seen = null; s.onChange(v => { seen = v; });
  s.set('effects', 3); assert.equal(s.get('effects'), 1);
  s.set('effects', -1); assert.equal(s.get('effects'), 0);
  s.set('nope', 1); s.set('subtitles', 'yes'); assert.equal(s.get('subtitles'), false);
  assert.equal(seen.effects, 0);
  assert.equal(JSON.parse(store.m.get('dreamscape.settings')).effects, 0);
  assert.equal(createSettings(store).get('effects'), 0); // a reload reads it back
});
