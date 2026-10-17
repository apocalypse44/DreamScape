import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const cache=new Map();
function load(file){
  if(!cache.has(file.href)){
    const source=readFileSync(file,'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,quote,path)=>`from ${quote}${load(new URL(path,file))}${quote}`);
    cache.set(file.href,`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  }return cache.get(file.href);
}
const {SPADE_MAP_LOCATIONS,REFUGE,BORDER_ANCHOR}=await import(load(new URL('../src/models/spadeStory.js',import.meta.url)));
const {spadeGround,spadeColliders}=await import(load(new URL('../src/models/spade.js',import.meta.url)));
const {findPath}=await import(load(new URL('../src/models/pathfinding.js',import.meta.url)));
test('Atlas Spade markers match authored locations and explain castle floors',()=>{
  assert.equal(new Set(SPADE_MAP_LOCATIONS.map(p=>p.id)).size,3);
  assert.equal(SPADE_MAP_LOCATIONS[0].x,-344-REFUGE.u);
  assert.equal(SPADE_MAP_LOCATIONS[0].z,REFUGE.v);
  assert.equal(SPADE_MAP_LOCATIONS[1].x,-344-BORDER_ANCHOR.u);
  assert.equal(SPADE_MAP_LOCATIONS[1].z,BORDER_ANCHOR.v);
  assert.match(SPADE_MAP_LOCATIONS[2].directions,/Archive on floor 1, Triad thrones on floor 2/);
});
test('each map destination has a ground route from Spade’s entrance',()=>{
  const height=(x,z)=>spadeGround(x,z,1.5),obstacles=spadeColliders().filter(c=>c.minY===undefined);
  for(const p of SPADE_MAP_LOCATIONS){
    const result=findPath({x:-336,z:0},p.destination,{height,obstacles,maxGrade:1.6});
    assert.ok(result?.path.length,`no route to ${p.name}`);
  }
});
