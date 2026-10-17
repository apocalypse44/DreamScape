import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source=readFileSync(new URL('../src/models/spadeCastle.js',import.meta.url),'utf8');
const {createCastleDiscovery,createCastleRecovery,CASTLE_RECORDS,CASTLE_FLOORS,CASTLE_STAIRS}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
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
  assert.match(q.objective,/border anchor/);
  q.reset();assert.equal(q.count,0);assert.equal(q.complete,false);
});
test('a fall inside the atrium returns to the last gallery rather than the world spawn',()=>{
  const recovery=createCastleRecovery(),player={position:{x:-516,y:32.17,z:11},velocity:{y:0},grounded:true};
  assert.equal(recovery.update(player),null);
  player.grounded=false;player.velocity.y=-10;player.position.y=25;player.position.x=-501;player.position.z=0;
  assert.deepEqual(recovery.update(player),{x:-516,z:11,top:30.12});
  player.grounded=true;player.position.y=25.17;player.position.x=-492;player.position.z=11;
  recovery.update(player);player.grounded=false;player.position.y=18;player.position.x=-501;player.position.z=0;
  assert.deepEqual(recovery.update(player),{x:-492,z:11,top:23.12});
  recovery.reset();assert.equal(recovery.update(player),null);
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
