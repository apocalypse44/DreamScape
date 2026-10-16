import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const clockUrl = moduleUrl(readFileSync(new URL('../src/models/worldClock.js', import.meta.url), 'utf8'));
const effectsUrl = moduleUrl(`export function createAtmosphereEffects() {
  return { update(...args) { globalThis.atmosphereCalls.push(args); }, reset() {} };
}`);
const source = readFileSync(new URL('../src/rendering/atmosphere.js', import.meta.url), 'utf8')
  .replace("'../models/worldClock.js'", JSON.stringify(clockUrl))
  .replace("'./atmosphereEffects.js'", JSON.stringify(effectsUrl));
const { createAtmosphereDemo } = await import(moduleUrl(source));

function fixture(available = true) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', disabled: true,
      setAttribute() {},
      addEventListener(type, fn) { this[type] = fn; },
    });
    return elements.get(id);
  };
  globalThis.atmosphereCalls = [];
  globalThis.document = { querySelector: element, addEventListener() {} };
  globalThis.Theatre = {
    core: { getProject: () => ({ sheet: () => ({ object: () => ({}), sequence: {} }) }) },
  };
  globalThis.window = { Theatre: available ? globalThis.Theatre : null };
  globalThis.THREE = { Color: class {} };
  return { atmosphere: createAtmosphereDemo({}), element };
}

test('the shared clock continues through chaos preview and theatre toggles', () => {
  const { atmosphere, element } = fixture();
  const clock = atmosphere.clock;
  atmosphere.score(50, 0.2);
  assert.equal(clock.hour, 10);
  element('#atmospherePreview').click();
  assert.equal(atmosphere.isPreviewing(), true);
  assert.equal(atmosphere.score(4, 0.2), 1);
  assert.ok(Math.abs(clock.hour - 10.08) < 1e-8);
  element('#atmosphereToggle').click();
  assert.equal(atmosphere.isEnabled(), false);
  atmosphere.score(50, 0.2);
  assert.ok(Math.abs(clock.hour - 11.08) < 1e-8);
  assert.equal(atmosphere.clock, clock);
  assert.match(element('#worldTime').textContent, /11:04/);
});

test('atmosphere reset restores morning and clears an active preview', () => {
  const { atmosphere, element } = fixture();
  element('#atmospherePreview').click();
  atmosphere.clock.setHour(23);
  atmosphere.clock.setPaused(true);
  atmosphere.reset();
  assert.equal(atmosphere.clock.label, '09:00');
  assert.equal(atmosphere.clock.paused, false);
  assert.equal(atmosphere.isPreviewing(), false);
  assert.match(element('#worldTime').textContent, /09:00/);
});

test('clock and final atmosphere pass remain available if Theatre cannot load', () => {
  const { atmosphere } = fixture(false);
  assert.equal(atmosphere.isEnabled(), false);
  assert.equal(atmosphere.score(50, 0.7), 0.7);
  assert.equal(atmosphere.clock.hour, 10);
  const camera = { position: { x: 0, y: 2, z: 0 } };
  atmosphere.finish(0.02, 0.7, camera);
  assert.deepEqual(globalThis.atmosphereCalls, [[0.02, 0.7, camera, {enabled: false, hour: 10, biome: null}]]);
  atmosphere.reset();
  assert.equal(atmosphere.clock.hour, 9);
});
