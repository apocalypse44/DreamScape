import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const source=readFileSync(new URL('../src/models/castleEcho.js',import.meta.url),'utf8');
const {createCastleEcho,ECHO_ENTRY,ECHO_FRAGMENTS,echoContains}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const playerAt=(p,grounded=true)=>({position:{x:p.x,z:p.z,y:p.top+2.05},grounded,velocity:{y:0}});

test('erased masonry has no calm collision and appears with chaos hysteresis',()=>{
  const echo=createCastleEcho(),player=playerAt(ECHO_ENTRY),first=echo.platforms[0];
  echo.update(player,.1);
  assert.equal(echo.active,false);assert.equal(first.contains(first.x,first.z),false);
  assert.equal(echo.update(player,.7).type,'reveal');
  assert.equal(first.contains(first.x,first.z),true);
  echo.update(player,.5);assert.equal(echo.active,true);
  echo.update(player,.39);assert.equal(echo.active,false);
  echo.update(player,.9,false);assert.equal(echo.active,false);
});
test('each Gothic fragment shares a convex footprint that rejects its broken corners',()=>{
  for(const p of ECHO_FRAGMENTS){
    assert.equal(echoContains(p,p.x,p.z),true);
    assert.equal(echoContains(p,p.x+1.8,p.z+1.6),false);
    for(const [x,z] of p.outline)assert.equal(echoContains(p,p.x+x*.99,p.z+z*.99),true);
  }
});
test('the witness requires the complete route and stillness, persists on exit, and resets',()=>{
  const echo=createCastleEcho();echo.update(playerAt(ECHO_ENTRY),.8);
  const last=ECHO_FRAGMENTS.at(-1);
  echo.update(playerAt(last),.1);assert.equal(echo.recovered,false);
  assert.equal(echo.progress,0); // dropping from an upper gallery cannot skip the route
  for(const p of ECHO_FRAGMENTS)echo.update(playerAt(p),.8);
  assert.equal(echo.progress,5);assert.equal(echo.recovered,false);
  assert.equal(echo.update(playerAt(last),.1).type,'memory');
  assert.equal(echo.recovered,true);assert.equal(echo.active,true);
  assert.equal(echo.update(playerAt(last),.1),null);
  echo.update(playerAt({x:0,z:0,top:1.5}),.1);
  assert.equal(echo.active,false);assert.equal(echo.recovered,true);
  echo.reset();assert.equal(echo.recovered,false);assert.equal(echo.progress,0);
});
test('calming mid-jump keeps footing until the player lands on an ordinary floor',()=>{
  const echo=createCastleEcho();echo.update(playerAt(ECHO_ENTRY),.8);
  const launch=playerAt({...ECHO_ENTRY,top:ECHO_ENTRY.top+1},false);
  echo.update(launch,.1);assert.equal(echo.active,true,'a launch from the balcony must stay safe before the first landing');
  const first=ECHO_FRAGMENTS[0];echo.update(playerAt(first),.8);
  const airborne=playerAt({...first,top:first.top+1},false);
  echo.update(airborne,.1);assert.equal(echo.active,true);
  echo.update(playerAt(ECHO_ENTRY),.1);
  assert.equal(echo.active,false);
  assert.equal(echo.platforms[0].contains(first.x,first.z),false);
});
