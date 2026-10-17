import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('audio context and samples are prepared before entry; first movement only resumes playback', async () => {
  const originalWindow = globalThis.window, originalFetch = globalThis.fetch;
  let contexts = 0, downloads = 0, decodes = 0, suspends = 0, resumes = 0;
  class AudioContext {
    constructor() { contexts++; this.state = 'running'; }
    async suspend() { suspends++; this.state = 'suspended'; }
    async resume() { resumes++; this.state = 'running'; }
    async decodeAudioData(data) { decodes++; return data; }
  }
  globalThis.window = { AudioContext };
  globalThis.fetch = async () => {
    downloads++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  try {
    const source = readFileSync(new URL('../src/rendering/fx.js', import.meta.url), 'utf8');
    const { prepareAudio, unlockAudio } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const preparation = prepareAudio();
    assert.equal(prepareAudio(), preparation);
    await preparation;
    assert.equal(contexts, 1);
    assert.equal(suspends, 1);
    assert.equal(downloads, 6);
    assert.equal(decodes, 6);
    assert.equal(resumes, 0);
    unlockAudio();
    unlockAudio();
    assert.equal(resumes, 1);
    assert.equal(contexts, 1);
    assert.equal(downloads, 6);
  } finally {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});
