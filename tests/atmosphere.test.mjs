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
const { createAtmosphere } = await import(moduleUrl(source));

function fixture() {
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
  globalThis.window = {};
  globalThis.THREE = { Color: class { set() { return this; } copy() { return this; } lerp() { return this; } } };
  const color = () => new THREE.Color();
  const scene = { fog: { color: color(), density: 0 } }, renderer = {};
  const sun = { color: color() }, hemi = { color: color() }, moteMat = { color: color() };
  return { atmosphere: createAtmosphere({ scene, renderer, sun, hemi, moteMat }), element, scene, moteMat };
}

test('the full world clock advances independently of changes in actual chaos', () => {
  const { atmosphere, element } = fixture();
  const clock = atmosphere.clock;
  atmosphere.advance(50);
  assert.equal(clock.hour, 10);
  atmosphere.advance(4);
  assert.ok(Math.abs(clock.hour - 10.08) < 1e-8);
  atmosphere.advance(50);
  assert.ok(Math.abs(clock.hour - 11.08) < 1e-8);
  assert.equal(atmosphere.clock, clock);
  assert.match(element('#worldTime').textContent, /11:04/);
});

test('atmosphere reset restores morning and unpauses the shared world clock', () => {
  const { atmosphere, element } = fixture();
  atmosphere.clock.setHour(23);
  atmosphere.clock.setPaused(true);
  atmosphere.reset();
  assert.equal(atmosphere.clock.label, '09:00');
  assert.equal(atmosphere.clock.paused, false);
  assert.match(element('#worldTime').textContent, /09:00/);
});

test('world rendering runs without an external timeline and follows actual chaos', () => {
  const { atmosphere, scene, moteMat } = fixture();
  atmosphere.advance(50);
  assert.equal(atmosphere.clock.hour, 10);
  const camera = { position: { x: 0, y: 2, z: 0 } };
  atmosphere.finish(0.02, 0.7, camera);
  assert.deepEqual(globalThis.atmosphereCalls, [[0.02, 0.7, camera, {hour: 10}]]);
  atmosphere.update(0, { fog: 0, sky: 0 });
  assert.equal(scene.fog.density, .006);
  assert.equal(moteMat.size, .16);
  atmosphere.update(1, { fog: 0, sky: 0 });
  assert.ok(Math.abs(scene.fog.density - .033) < 1e-8);
  assert.ok(Math.abs(moteMat.size - .85) < 1e-8);
  atmosphere.reset();
  assert.equal(atmosphere.clock.hour, 9);
});
