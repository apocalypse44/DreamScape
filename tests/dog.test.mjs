import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dogMood } from '../src/models/dogMood.js';

function glb(name) {
  const bytes = readFileSync(new URL(`../src/assets/${name}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(8), bytes.length);
  return { bytes, json: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) };
}
const SOURCE_CLIPS = ['Attack', 'Death', 'Eating', 'Gallop', 'Gallop_Jump', 'Idle', 'Idle_2', 'Idle_2_HeadLow', 'Idle_HitReact1', 'Idle_HitReact2', 'Jump_ToIdle', 'Walk'];
const AUTHORED = ['sit', 'lie', 'pet', 'howl', 'bark', 'playBow', 'shake'];

for (const [file, kind] of [['dog.glb', 'dog'], ['hound.glb', 'hound']]) {
  test(`${file}: compact, textureless, keeps source clip names and adds authored moods`, () => {
    const { bytes, json } = glb(file);
    assert.ok(bytes.length < 1.5 * 1024 * 1024, `${bytes.length} bytes`);
    assert.equal(json.images?.length || 0, 0);
    const names = json.animations.map(a => a.name);
    for (const clip of [...SOURCE_CLIPS, ...AUTHORED]) assert.ok(names.includes(clip), clip); // the Ember flashback uses source names
    const skinned = json.nodes.filter(n => n.skin != null);
    assert.equal(skinned.length, 1);
    assert.deepEqual(json.meshes[skinned[0].mesh].primitives.map(p => json.materials[p.material].name), kind === 'dog' ? ['DogPalette'] : ['DogPalette', 'DogGlow']);
    // Paws hang off IK-target bones: their translation must survive stripping or the legs swing like pendulums.
    const walk = json.animations.find(a => a.name === 'Walk');
    for (const foot of ['IKFrontLegL', 'IKBackLegR']) assert.ok(walk.channels.some(c => json.nodes[c.target.node].name === foot && c.target.path === 'translation'), foot);
    for (const a of json.animations) for (const c of a.channels) assert.notEqual(c.target.path, 'scale', `${a.name} keeps a scale track`);
    const nodes = new Set(json.nodes.map(n => n.name));
    for (const bone of ['Head', 'Tail1', 'Ear1L', 'Ear1R', 'Neck3']) assert.ok(nodes.has(bone), bone);
    assert.equal(nodes.has('DogAccessories'), kind === 'dog'); // bandana + tag only on the companion
  });
}

test('calm dogs carry the tail high and wag fast; chaos tucks the tail and flattens the ears', () => {
  const calm = dogMood({ happy: 1, chaos: 0 }), scared = dogMood({ happy: 0, chaos: .95 });
  assert.ok(calm.tailRaise > .3 && scared.tailRaise < -.9);
  assert.ok(calm.wagFrequency > scared.wagFrequency && calm.wagAmplitude > scared.wagAmplitude * 3);
  assert.ok(calm.wagAmplitude <= .3 && calm.wagFrequency <= 5.5); // relaxed, not frantic
  assert.ok(calm.ears >= 0 && scared.ears < -.8);
  assert.ok(scared.scarGlow > calm.scarGlow); // the ember scar wakes in chaos
  assert.equal(dogMood({ alert: 1, chaos: .95 }).ears, .18); // barking perks the ears even when scared
});

test('clips that own the head switch the look-at off; galloping only glances', () => {
  for (const clip of ['howl', 'Gallop', 'shake', 'playBow']) assert.equal(dogMood({}, clip).lookWeight, 0, clip);
  assert.equal(dogMood({ speed: 0 }, 'sit').lookWeight, 1);
  assert.ok(dogMood({ speed: 9 }, 'Walk').lookWeight < .5);
  assert.ok(dogMood({ happy: 1, speed: 12 }, 'Gallop').wagAmplitude < dogMood({ happy: 1 }, 'sit').wagAmplitude);
});
