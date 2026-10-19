import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source=readFileSync(new URL('../src/models/spadeCastle.js',import.meta.url),'utf8');
const {createCastleDiscovery,isInsideSpadeCastle,CASTLE_RECORDS,CASTLE_FLOORS,CASTLE_STAIRS}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('castle discoveries require the archive floor and calm, persist and reset',()=>{
  const q=createCastleDiscovery();
  for(const r of CASTLE_RECORDS){
    const position={x:-344-r.u,z:r.v,y:r.top+2.05};
    assert.equal(q.update({...position,y:18.17},0),null);
    assert.equal(q.update(position,.8),null);
    assert.equal(q.update(position,.1).title,r.title);
    assert.equal(q.update(position,.1),null);
  }
  assert.equal(q.count,3);assert.equal(q.complete,false);
  const crown={x:-516,z:0,y:32.17};
  assert.equal(q.update(crown,.1).title,'THE HOLLOW CROWN');assert.equal(q.complete,true);
  assert.match(q.objective,/Clover/);
  q.reset();assert.equal(q.count,0);assert.equal(q.complete,false);
});
test('castle fall policy covers stairs, atrium and echo route without affecting other kingdoms',()=>{
  for(const [x,z] of [[-487,11],[-499,0],[-505.2,-3.5]])assert.equal(isInsideSpadeCastle({x,z}),true);
  for(const [x,z] of [[0,0],[-366,-23],[-460,0],[-530,0],[-500,20]])assert.equal(isInsideSpadeCastle({x,z}),false);
});

test('the castle conclusion waits for the recovered chaos memory when connected',()=>{
  let recovered=false;const q=createCastleDiscovery({hasEcho:()=>recovered});
  for(const r of CASTLE_RECORDS)q.update({x:-344-r.u,z:r.v,y:r.top+2.05},.1);
  const crown={x:-516,z:0,y:32.17};
  assert.equal(q.update(crown,.1),null);assert.equal(q.complete,false);
  assert.match(q.objective,/erased castle/);
  recovered=true;
  assert.equal(q.update(crown,.1).title,'THE HOLLOW CROWN');assert.equal(q.complete,true);
});
test('each gallery preserves its stair slot and the central atrium',()=>{
  for(const s of CASTLE_STAIRS)for(let u=s.start+2;u<s.end-2;u+=1){
    const x=-344-u,feet=s.topAt(x,11);
    for(const p of CASTLE_FLOORS){
      const overlaps=Math.abs(u-p.u)<p.width/2&&Math.abs(11-p.v)<p.depth/2;
      assert.ok(!overlaps||p.bottom>=feet+2.05||p.top<=feet+.6,`ceiling cuts into stair at ${u}`);
    }
  }
  for(const p of CASTLE_FLOORS)assert.ok(!(Math.abs(157-p.u)<p.width/2&&Math.abs(p.v)<p.depth/2));
});
