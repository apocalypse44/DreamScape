import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source=readFileSync(new URL('../src/models/skyIsland.js',import.meta.url),'utf8');
const {createSkyJourney,skyFlightPose,SKY_TRAVEL_SECONDS,SKY_MAIN,SKY_ARRIVAL,SUMMIT_ARRIVAL,SKY_SECRET,SUMMIT_DOOR,SKY_DOOR}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const position = p => ({x:p.x,y:p.top+2.05,z:p.z});
function travel(j,p) {
  j.update(.01,position(p),false,true);
  let target;
  for(let i=0;i<240;i++) target=j.update(1/60,position(p),true,true).target || target;
  return target;
}
test('the summit door travels to the island once per E press and the return door goes back',()=>{
  const j=createSkyJourney();
  assert.deepEqual(travel(j,SUMMIT_DOOR),SKY_ARRIVAL);
  assert.equal(j.visiting,true);
  for(let i=0;i<100;i++) assert.equal(j.update(.02,position(SKY_DOOR),true,true).target,null);
  assert.deepEqual(travel(j,SKY_DOOR),SUMMIT_ARRIVAL);
  assert.equal(j.visiting,false);
});
test('portal use requires proximity, correct height and active input capture',()=>{
  for(const [p,locked] of [[{...SUMMIT_DOOR,x:20},true],[{...SUMMIT_DOOR,top:0},true],[SUMMIT_DOOR,false]]) {
    const j=createSkyJourney();j.update(.9,position(p),true,locked);assert.equal(j.visiting,false);assert.equal(j.blocked,false);
  }
});
test('charge, visible flight and arrival stay blocked until safely landing',()=>{
  const j=createSkyJourney();let event=j.update(.15,position(SUMMIT_DOOR),true,true);
  assert.equal(j.blocked,true);assert.equal(event.flight.phase,'charge');assert.equal(event.target,null);
  event=j.update(1.75,position(SUMMIT_DOOR),true,true);assert.equal(event.flight.phase,'flight');assert.equal(event.target,null);
  assert.ok(event.flight.x>2&&event.flight.x<72);assert.ok(event.flight.top>44);
  event=j.update(1.6,position(SUMMIT_DOOR),true,true);assert.equal(event.flight.phase,'arrival');assert.equal(j.blocked,true);
  event=j.update(.31,position(SKY_ARRIVAL),false,true);assert.deepEqual(event.target,SKY_ARRIVAL);assert.equal(j.blocked,false);
});
test('curved flight is continuous, clears the cliffs, reverses safely and resets midair',()=>{
  for(const [from,to] of [[SUMMIT_ARRIVAL,SKY_ARRIVAL],[SKY_ARRIVAL,SUMMIT_ARRIVAL]]){
    const start=skyFlightPose(from,to,0),end=skyFlightPose(from,to,SKY_TRAVEL_SECONDS);
    assert.equal(start.x,from.x);assert.equal(start.top,from.top);assert.equal(end.x,to.x);assert.equal(end.top,to.top);
    let prev=start;
    for(let t=0;t<SKY_TRAVEL_SECONDS;t+=.01){const p=skyFlightPose(from,to,t);
      assert.ok(Math.hypot(p.x-prev.x,p.z-prev.z,p.top-prev.top)<1);assert.ok(p.top>=Math.min(from.top,to.top));
      if(SKY_MAIN.contains(p.x,p.z))assert.ok(p.top>=64-.001,'flight must clear floating island');prev=p;
    }
  }
  const j=createSkyJourney();j.update(1.9,position(SUMMIT_DOOR),true,true);assert.ok(j.cinematic);
  j.reset();assert.equal(j.cinematic,null);assert.equal(j.blocked,false);assert.equal(j.visiting,false);
});
test('missed island jumps recover at island height and reset clears discoveries and travel',()=>{
  const j=createSkyJourney();travel(j,SUMMIT_DOOR);
  assert.deepEqual(j.recovery({position:{x:100,y:59,z:-550}}),SKY_ARRIVAL);
  assert.equal(j.recovery({position:position(SKY_ARRIVAL)}),null);
  j.update(.1,position({x:67,z:-563,top:68}),false,true);assert.equal(j.awakened,true);
  j.update(.1,position(SKY_SECRET),false,true);assert.equal(j.secret,true);
  j.reset();assert.equal(j.visiting,false);assert.equal(j.awakened,false);assert.equal(j.secret,false);assert.equal(j.blocked,false);
  assert.equal(j.recovery({position:{y:0}}),null);
});
test('the visible irregular island outline is the collision footprint',()=>{
  assert.equal(SKY_MAIN.contains(SKY_ARRIVAL.x,SKY_ARRIVAL.z),true);
  assert.equal(SKY_MAIN.contains(SKY_MAIN.x+23,SKY_MAIN.z+20),false);
});
