import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/models/daylight.js', import.meta.url), 'utf8');
const { sampleDaylight } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('sunrise, noon, sunset and midnight share a consistent celestial orbit', () => {
  const dawn = sampleDaylight(6), noon = sampleDaylight(12);
  const dusk = sampleDaylight(18), night = sampleDaylight(0);
  assert.ok(Math.abs(dawn.sun.y) < 1e-8);
  assert.equal(noon.sun.y, 1);
  assert.ok(Math.abs(dusk.sun.y) < 1e-8);
  assert.equal(night.sun.y, -1);
  assert.equal(noon.daylight, 1);
  assert.equal(night.daylight, 0);
  assert.equal(noon.stars, 0);
  assert.equal(night.stars, 1);
  assert.ok(noon.sunIntensity > 2);
  assert.equal(night.sunIntensity, 0);
  assert.ok(night.moonIntensity > 0);
  assert.equal(noon.moonIntensity, 0);
});

test('Spade stays dark at every hour while keeping the shared orbit', () => {
  for (let hour = 0; hour < 24; hour += 0.25) {
    const spade = sampleDaylight(hour, true);
    assert.equal(spade.daylight, 0);
    assert.equal(spade.sunIntensity, 0);
    assert.equal(spade.twilight, 0);
    assert.deepEqual(spade.sun, sampleDaylight(hour).sun);
  }
});

test('lighting remains continuous through sunrise, sunset and midnight', () => {
  for (const hour of [0, 5.5, 6, 6.5, 17.5, 18, 18.5, 24]) {
    const a = sampleDaylight(hour - 0.0001), b = sampleDaylight(hour + 0.0001);
    for (const key of ['daylight', 'twilight', 'sunIntensity', 'moonIntensity', 'ambientIntensity', 'stars']) {
      assert.ok(Math.abs(a[key] - b[key]) < 0.001, `${key} jumps at ${hour}`);
    }
  }
  assert.deepEqual(sampleDaylight(25), sampleDaylight(1));
});
