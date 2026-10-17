import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
function load(file) {
  const source = readFileSync(file, 'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,
    (_, q, path) => `from ${q}${load(new URL(path, file))}${q}`);
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const { landmarkHintLines } = await import(load(new URL('../src/models/landmarkHints.js', import.meta.url)));
test('Spade hints use reachable door distances and include all three destinations', () => {
  const lines = landmarkHintLines('SPADE KINGDOM', { x: -366, z: -15 });
  assert.equal(lines.length, 3);
  assert.match(lines[0], /LANTERN REFUGE · 0 m/);
  assert.match(lines[1], /BORDER-ANCHOR PLAZA/);
  assert.match(lines[2], /CASTLE ENTRANCE.*HOLLOW GATE INSIDE · TRIAD FLOOR 2/);
  assert.ok(lines.every(line => !/GRIMOIRE|CLOVER/.test(line)));
  assert.match(landmarkHintLines('SPADE KINGDOM', { x: -462, z: 0 })[2], /0 m/);
});
test('Clover destinations describe summit travel and do not leak to other kingdoms', () => {
  const lines = landmarkHintLines('CLOVER KINGDOM', { x: 0, z: -400 });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /CLOVER SUMMIT/);
  assert.match(lines[1], /SKY GARDEN.*VIA SUMMIT GATEWAY/);
  for (const kingdom of ['GRIMOIRE TOWER', 'HEART KINGDOM', 'DIAMOND KINGDOM']) {
    assert.deepEqual(landmarkHintLines(kingdom, { x: 0, z: 0 }), []);
  }
});
