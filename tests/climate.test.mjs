import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const load = file => import(`data:text/javascript;base64,${Buffer.from(readFileSync(new URL(file, import.meta.url),'utf8')).toString('base64')}`);
const { spadeClimateAt } = await load('../src/models/climate.js');
const { sampleDaylight } = await load('../src/models/daylight.js');

test('Spade darkness builds before its gate and reaches permanent night inside', () => {
  assert.equal(spadeClimateAt(-260,0),0);
  assert.equal(spadeClimateAt(-370,0),1);
  assert.ok(spadeClimateAt(-344,0)>.8);
  let previous = 0;
  for(let x=-260;x>=-400;x-=.1) {
    const weight=spadeClimateAt(x,0);
    assert.ok(weight>=previous-1e-10); assert.ok(weight-previous<.002);
    previous=weight;
  }
  for(const [x,z] of [[0,0],[400,0],[0,400],[0,-400]]) assert.equal(spadeClimateAt(x,z),0);
});
test('crossing the circular or diagonal Spade boundary never switches lighting abruptly', () => {
  for(const [x,z] of [[-350,0],[-300,180],[-600,600],[-600,-600]]) {
    const a=spadeClimateAt(x-.001,z), b=spadeClimateAt(x+.001,z);
    assert.ok(Math.abs(a-b)<.0001);
    for(const hour of [0,6,9,12,18]) {
      const before=sampleDaylight(hour,a),after=sampleDaylight(hour,b);
      for(const key of ['daylight','twilight','sunIntensity','moonIntensity','ambientIntensity','stars'])
        assert.ok(Math.abs(before[key]-after[key])<.001,`${key} changes at ${x},${z}`);
    }
  }
});
test('fractional climate blends both directions without changing time or celestial directions', () => {
  for(const hour of [0,6,9,12,18,23]) {
    const daylight=sampleDaylight(hour),night=sampleDaylight(hour,true);
    assert.deepEqual(sampleDaylight(hour,0),daylight);
    assert.deepEqual(sampleDaylight(hour,1),night);
    const middle=sampleDaylight(hour,.5);
    assert.deepEqual(middle.sun,daylight.sun);
    for(const key of ['daylight','twilight','sunIntensity','moonIntensity','ambientIntensity','stars'])
      assert.ok(Math.abs(middle[key]-(daylight[key]+night[key])/2)<1e-10);
  }
});
