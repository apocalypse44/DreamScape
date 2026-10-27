// The same convex outlines drive rendered masonry and walking collision.
const SHAPES = {
  arch: [[-1.65,-.7],[-1,-1.3],[.9,-1.3],[1.65,-.5],[1.35,1.1],[-1.25,1.2]],
  capital: [[-1.35,-.7],[-.7,-1.35],[.7,-1.35],[1.35,-.7],[1.35,.7],[.7,1.35],[-.7,1.35],[-1.35,.7]],
  rib: [[-1.6,-.7],[-.9,-1.3],[1.3,-.95],[1.6,.6],[.5,1.3],[-1.45,.85]],
  window: [[-1.5,-.8],[-.7,-1.5],[.8,-1.35],[1.5,-.45],[1.25,1.2],[-.9,1.4]],
  dais: [[-1.8,-.9],[-1,-1.6],[1,-1.6],[1.8,-.9],[1.8,.9],[1,1.6],[-1,1.6],[-1.8,.9]],
};
export const ECHO_ENTRY = Object.freeze({ x: -504, z: -9.5, top: 23.12 });
export const ECHO_FRAGMENTS = [
  { u:160,v:-4.4,top:24.25,kind:'arch',name:'BROKEN ARCH' },
  { u:164.5,v:-.5,top:25.4,kind:'capital',name:'FALLEN CAPITAL' },
  { u:161.4,v:4,top:26.55,kind:'rib',name:'VAULT RIB' },
  { u:157.8,v:.2,top:27.7,kind:'window',name:'ROSE-WINDOW FRAGMENT' },
  { u:161.2,v:-3.5,top:29.3,kind:'dais',name:'WITNESS SEAL' },
].map(p => ({ ...p, x:-344-p.u, z:p.v, bottom:p.top-.45, width:3.6, depth:3.2,
  outline:SHAPES[p.kind] }));

export function echoContains(p, x, z, pad = 0) {
  const dx=x-p.x,dz=z-p.z;
  return p.outline.every((a,i) => {
    const b=p.outline[(i+1)%p.outline.length],ex=b[0]-a[0],ez=b[1]-a[1];
    return ex*(dz-a[1])-ez*(dx-a[0]) >= -pad*Math.hypot(ex,ez);
  });
}
const inHall = p => p.x < -468 && p.x > -522 && Math.abs(p.z)<15 && p.y<39;
const inRoute = p => p.x < -499 && p.x > -513 && p.z>-10.5 && p.z<7 && p.y>23;
export function createCastleEcho() {
  let chaosVisible=false,engaged=false,active=false,progress=-1,recovered=false,announced=false,skipped=false;
  const platforms=ECHO_FRAGMENTS.map(p => ({...p,solid:true,
    contains:(x,z,pad=0)=>active&&echoContains(p,x,z,pad) }));
  return {
    platforms,
    get active(){return active;}, get engaged(){return engaged;},
    get progress(){return progress+1;}, get recovered(){return recovered;},
    get objective(){
      if(recovered)return 'Memory restored. Clover can show which of Veyr’s spells are real.';
      if(progress===4)return 'Stand still on the glowing seal to hear the memory.';
      if(engaged&&skipped)return 'You skipped a step. Drop back to the archive balcony and start again from the first broken arch.';
      if(engaged)return `Jump across the broken arches · ${progress+1}/5`;
      return active?'From the archive’s north balcony, jump over the rail toward the glowing arch.'
        :'Go to the archive. Run and jump to stir chaos and reveal the erased castle.';
    },
    update(player,chaos,locked=true){
      const p=player.position,feet=p.y-2.05;
      if(!inHall(p)) {active=chaosVisible=engaged=false;progress=-1;return null;}
      if(!locked)return null;
      if(chaos>=.65)chaosVisible=true;
      else if(chaos<=.4)chaosVisible=false;
      const on=platforms.findIndex(s=>Math.abs(feet-s.top)<.25&&echoContains(s,p.x,p.z,.55));
      if(active&&((player.grounded&&on>=0)||(!player.grounded&&inRoute(p))))engaged=true;
      if(engaged&&player.grounded&&on<0)engaged=false;
      active=chaosVisible||engaged;
      if(!active)return null;
      if(!announced){announced=true;return {type:'reveal',text:'THE ERASED CASTLE · Chaos reveals hidden stone arches! From the archive’s north balcony, jump across the glowing arches.'};}
      // Landing ahead of the next fragment (e.g. dropping onto the seal from the observatory) doesn't count.
      skipped=player.grounded&&on>progress+1?true:player.grounded&&on>=0&&on<=progress+1?false:skipped;
      if(player.grounded&&on===progress+1) {
        progress=on;
        if(progress===4)return {type:'witness',text:'VEYR’S ECHO · “Let them attack the fake anchors. They will never find the real one.” Stand still here to hear the full memory.'};
      }
      if(!recovered&&progress===4&&on===4&&player.grounded&&chaos<=.4){
        recovered=true;
        return {type:'memory',text:'THE ERASED WITNESS · Veyr hid our voices in fake chains. Clover’s roots still remember the real pattern. Find Iven at the Rootkeeper Archive. This memory is now restored.'};
      }
      return null;
    },
    reset(){chaosVisible=engaged=active=recovered=announced=skipped=false;progress=-1;},
  };
}
