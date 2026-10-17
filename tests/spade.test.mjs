import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const castleSource = readFileSync(new URL('../src/models/spadeCastle.js', import.meta.url),'utf8');
const castleUrl = `data:text/javascript;base64,${Buffer.from(castleSource).toString('base64')}`;
const storyUrl=`data:text/javascript;base64,${Buffer.from(readFileSync(new URL('../src/models/spadeStory.js',import.meta.url),'utf8')).toString('base64')}`;
const source = readFileSync(new URL('../src/models/spade.js', import.meta.url), 'utf8').replace("'./spadeCastle.js'",JSON.stringify(castleUrl)).replace("'./spadeStory.js'",JSON.stringify(storyUrl));
const { spadeGround, spadeArea, spadeHeight, spadeVolumes, SPADE_HOUSES, SPADE_MOUNTAINS, SPADE_FIXTURES, spadeMountainVolume } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('Spade route stays fixed under chaos and preserves all other kingdom terrain', () => {
  for (const original of [-10, 1.5, 40]) {
    for (let x = -336; x >= -530; x--) assert.ok(Math.abs(spadeGround(x, 0, original) - spadeHeight(x)) < 1e-10);
    for (const [x, z] of [[0, 0], [0, -400], [400, 0], [0, 400], [-280, 0], [-600, 0]]) {
      assert.equal(spadeGround(x, z, original), original); assert.equal(spadeArea(x, z), false);
    }
  }
});
test('Spade ascent is continuous and gentle enough to walk', () => {
  for (let x = -336; x > -530; x -= 0.1) {
    assert.ok(Math.abs(spadeGround(x, 0, 20) - spadeGround(x - 0.1, 0, 20)) < 0.05);
  }
  for (const [x, z, dx, dz] of [[-310, 0, 0.0001, 0], [-570, 0, 0.0001, 0], [-450, 102, 0, 0.0001]])
    assert.ok(Math.abs(spadeGround(x - dx, z - dz, 8) - spadeGround(x + dx, z + dz, 8)) < 0.001);
});
test('the main avenue and castle doorway contain no solid building volume', () => {
  const volumes = spadeVolumes();
  for (let x = -336; x > -513; x -= 0.25) for (const z of [-3, 0, 3]) {
    const feet = spadeGround(x, z, 1.5);
    assert.equal(volumes.some(p => p.bottom < feet + 2.05 && p.top > feet + 0.6 &&
      (p.contains ? p.contains(x,z) : Math.abs(x-p.x) < p.width/2 && Math.abs(z-p.z) < p.depth/2)), false, `blocked at ${x},${z}`);
  }
  assert.ok(volumes.some(p => p.x === -521 && p.depth === 34), 'hall has a back wall');
});

test('every house has a level pad across its complete footprint in both terrain states', () => {
  for (const h of SPADE_HOUSES) for (const dx of [-h.depth/2, 0, h.depth/2]) for (const dz of [-h.width/2, 0, h.width/2]) {
    const x = -344-h.u+dx, z = h.v+dz, expected = spadeHeight(-344-h.u);
    for (const original of [-5,40]) assert.ok(Math.abs(spadeGround(x,z,original)-expected)<1e-8, `unlevel foundation at ${x},${z}`);
  }
});
test('mountain support matches peak, flanks and exterior of the rendered polygon', () => {
  for (const m of SPADE_MOUNTAINS) {
    const volume = spadeMountainVolume(m);
    assert.equal(volume.topAt(volume.x,volume.z),m.bottom+m.height);
    assert.equal(volume.contains(volume.x,volume.z),true);
    assert.equal(volume.contains(volume.x+60,volume.z),false);
    for (const t of [.2,.4,.6]) {
      const x=volume.x+Math.sin(m.rotation)*m.radiusZ*t,z=volume.z+Math.cos(m.rotation)*m.radiusZ*t;
      assert.ok(Math.abs(volume.topAt(x,z)-(m.bottom+m.height*(1-t)))<1e-8);
    }
  }
});
test('all interior fixtures have explicit solid volumes independently of detail loading', () => {
  const volumes=spadeVolumes();
  for(const f of SPADE_FIXTURES) assert.ok(volumes.some(p=>p.name===f.name && p.x===-344-f.u && p.z===f.v && p.solid && p.top>p.bottom));
});
