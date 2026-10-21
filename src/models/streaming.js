// A small amount of preparation per frame, never an unbounded completion burst.
export function createFrameQueue() {
  const jobs=[];let completed=0;
  return {
    push(job){jobs.push(job);},
    run(){const job=jobs.shift();if(!job)return false;job();completed++;return true;},
    get pending(){return jobs.length;},get completed(){return completed;},
  };
}

// Fill the next view square while the player is still inside the current cell.
// The existing one-ring retention keeps these chunks alive until the crossing.
export function nextChunkPrefetch(cx,cz,x,z,radius,has) {
  if(radius<1)return null;
  const ox=x-cx*64,oz=z-cz*64;
  const nx=cx+(Math.abs(ox)>8?Math.sign(ox):0),nz=cz+(Math.abs(oz)>8?Math.sign(oz):0);
  if(nx===cx&&nz===cz)return null;
  let best=null,distance=Infinity;
  for(let a=nx-radius;a<=nx+radius;a++)for(let b=nz-radius;b<=nz+radius;b++){
    if(has(a,b))continue;
    const d=(a*64-x)**2+(b*64-z)**2;
    if(d<distance){distance=d;best={x:a,z:b};}
  }
  return best;
}
