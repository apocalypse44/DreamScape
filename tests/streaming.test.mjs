import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const source=readFileSync(new URL('../src/models/streaming.js',import.meta.url),'utf8');
const {createFrameQueue,nextChunkPrefetch}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('completed asset downloads can install only one mesh per game frame',()=>{
  const queue=createFrameQueue(),installed=[];
  for(let i=0;i<30;i++)queue.push(()=>installed.push(i));
  for(let frame=0;frame<30;frame++){
    assert.equal(queue.run(),true);assert.equal(installed.length,frame+1);assert.equal(queue.pending,29-frame);
  }
  assert.equal(queue.run(),false);assert.equal(queue.completed,30);
});
test('walking toward Spade prefetches the next chunk row before crossing its boundary',()=>{
  const chunks=new Set(),key=(x,z)=>`${x},${z}`;
  for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)chunks.add(key(a,b));
  for(let x=0;x>=-430;x-=.3){
    const cx=Math.floor((x+32)/64);let missing=0;
    for(let a=cx-2;a<=cx+2;a++)for(let b=-2;b<=2;b++)if(!chunks.has(key(a,b))){missing++;chunks.add(key(a,b));}
    assert.equal(missing,0,`chunk row arrived too late at ${x}`);
    const next=nextChunkPrefetch(cx,0,x,0,2,(a,b)=>chunks.has(key(a,b)));
    if(next)chunks.add(key(next.x,next.z));
  }
  assert.equal(nextChunkPrefetch(0,0,0,0,2,()=>false),null);
  assert.equal(nextChunkPrefetch(0,0,15,0,0,()=>false),null);
});
