import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createKeeperRoutine } from '../src/models/keeperRoutine.js';

function glb(path) {
  const bytes = readFileSync(new URL(`../src/assets/people/${path}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(8), bytes.length);
  return { bytes, json: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) };
}

test('one shared clip pack: skeleton only, UAL names, no finger, scale or stray translation tracks', () => {
  const { bytes, json } = glb('people-clips.glb');
  assert.ok(bytes.length < 1024 * 1024, `${bytes.length} bytes`);
  assert.equal(json.meshes?.length || 0, 0);
  const names = json.animations.map(a => a.name);
  for (const clip of ['Idle_Loop', 'Walk_Loop', 'Idle_Talking_Loop', 'Idle_No_Loop', 'Fixing_Kneeling', 'Idle_FoldArms_Loop', 'Jog_Fwd_Loop', 'Spell_Simple_Idle_Loop']) assert.ok(names.includes(clip), clip);
  for (const a of json.animations) for (const c of a.channels) {
    const node = json.nodes[c.target.node].name;
    assert.notEqual(c.target.path, 'scale');
    assert.ok(!/^(index|middle|ring|pinky|thumb)_/.test(node), `${a.name} keeps finger track ${node}`);
    if (c.target.path === 'translation') assert.ok(['root', 'pelvis'].includes(node), `${a.name}:${node}`);
  }
});

for (const name of ['shrineKeeper', 'shrineKeeperYoung', 'villager', 'orin', 'iven', 'ivenYoung', 'neris', 'veyr', 'sile', 'morcant', 'sera']) {
  test(`${name}.glb: one small skinned body with a face shell, no clips and no textures`, () => {
    const { bytes, json } = glb(`${name}.glb`);
    assert.ok(bytes.length < 450 * 1024, `${bytes.length} bytes`);
    assert.equal(json.animations?.length || 0, 0); // clips come from the shared pack
    assert.equal(json.images?.length || 0, 0);
    assert.equal(json.nodes.filter(n => n.skin != null).length, 1);
    const face = json.nodes.find(n => n.name === 'PersonFace');
    assert.ok(face && json.meshes[face.mesh].primitives[0].attributes.TEXCOORD_0 != null);
    assert.ok(json.nodes.some(n => n.name === 'socket_face'));
    const style = json.nodes.find(n => n.extras?.face)?.extras.face;
    assert.equal(style.iris.length, 3); // her amber eyes travel with the asset
    const palette = json.nodes.find(n => n.extras?.palette)?.extras.palette;
    assert.ok(palette && Object.keys(palette).length >= 5); // per-instance recolouring keys off these names
  });
}

test('keeper routine: tends candles when visitors are away, greets the dog, then returns to her post', () => {
  const r = createKeeperRoutine({ spots: 3, random: () => .5 });
  let plan = r.update(1, { playerDistance: 3 });
  assert.equal(plan.mode, 'home'); assert.equal(plan.look, 'player');
  for (let i = 0; i < 40; i++) plan = r.update(1, { playerDistance: 3 }); // a visitor nearby: she stays
  assert.equal(plan.mode, 'home');
  // Once the visitor leaves she sets off within her 4 s re-check.
  for (let i = 0; i < 5 && plan.mode === 'home'; i++) plan = r.update(1, { playerDistance: 20 });
  assert.equal(plan.mode, 'toSpot'); assert.equal(plan.clip, 'Walk_Loop');
  plan = r.update(.1, { playerDistance: 20, arrived: true }); assert.equal(plan.mode, 'tend'); assert.equal(plan.clip, 'Fixing_Kneeling');
  for (let i = 0; i < 5; i++) plan = r.update(1, { playerDistance: 20 });
  assert.equal(plan.mode, 'toHome');
  plan = r.update(.1, { arrived: true }); assert.equal(plan.mode, 'home');
  plan = r.update(.1, { dogDistance: 1.5 }); assert.equal(plan.mode, 'pet'); assert.equal(plan.look, 'dog'); assert.equal(plan.expression, 'joy');
  for (let i = 0; i < 4; i++) plan = r.update(1, { dogDistance: 1.5 });
  assert.equal(plan.mode, 'toHome');
  plan = r.update(.1, { arrived: true, dogDistance: 1.5 }); assert.equal(plan.mode, 'home'); // 30 s before greeting again
  plan = r.update(1, { dogDistance: 1.5 }); assert.equal(plan.mode, 'home');
});
