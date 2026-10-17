import { CASTLE_FLOORS, CASTLE_STAIRS, CASTLE_RAILS, CASTLE_PROPS, CASTLE_RECORDS, CASTLE_LEVELS, createCastleDiscovery } from '../models/spadeCastle.js';

// Render through the settlement's existing instance batches; no new model or
// texture downloads. The ward is a small procedural fragment-shader surface.
export function buildCastleInterior({root,add,block,module,label,notify,echo}) {
  const discovery=createCastleDiscovery({hasEcho:()=>!echo||echo.recovered});
  for(const p of CASTLE_FLOORS) block(p.u,p.v,p.width,p.depth,p.top-p.bottom,p.bottom,'trim');
  for(const p of CASTLE_RAILS) {
    block(p.u,p.v,p.width,p.depth,.18,p.top-.18,'trim');
    const alongU=p.width>p.depth,length=Math.max(p.width,p.depth);
    for(let d=-length/2;d<=length/2;d+=2)block(p.u+(alongU?d:0),p.v+(alongU?0:d),.16,.16,.95,p.bottom,'trim');
  }
  for(const s of CASTLE_STAIRS) {
    for(let i=0;i<28;i++) {
      const length=(s.end-s.start)/28,top=s.low+(s.top-s.low)*(i+1)/28;
      block(s.start+(i+.5)*length,s.v,length+.015,s.depth,top-s.bottom,s.bottom,'stone');
      block(s.start+(i+.5)*length,s.v,length+.015,s.depth,.05,top,'trim');
    }
    label('UP · '+(s.start===128?'TESTIMONY ARCHIVE':'CROWN OBSERVATORY'),s.start-1,s.low+2.2,14.85,4,0);
  }
  // Inlaid floors, ribs and floor-height trim make the three levels readable.
  for(const floor of CASTLE_LEVELS) {
    for(const v of [-14.8,14.8])block(150,v,50,.22,.2,floor.top+.2,'trim');
    for(const u of [132,144,156,168]) {
      block(u,0,.35,11.8,.35,floor.top+5.3,'trim');
      for(const side of [-1,1]) {
        // Diagonal corbels suggest Gothic ribs with just shared boxes.
        add('box',u,floor.top+4.7,side*5,.35,2.2,.35,'trim',0);
      }
    }
    for(let u=131;u<169;u+=4)block(u,-10.5,1.3,1.3,.035,floor.top,'road');
  }
  for(const p of CASTLE_PROPS) {
    if(p.name==='archive') {
      block(p.u,p.v,p.width,p.depth,p.height,p.bottom,'roof');
      for(let row=0;row<4;row++) {
        block(p.u,p.v-.05,p.width+.15,p.depth+.1,.12,p.bottom+.3+row*.9,'trim');
        for(let col=0;col<6;col++)block(p.u-1.6+col*.6,p.v+.25,.35,.6,.6,p.bottom+.4+row*.9,(row+col)%2?'house':'road');
      }
    }else if(p.name==='archive-chest')module('chest',p.u,p.bottom,p.v,p.width,p.height,p.depth);
    else {
      block(p.u,p.v,p.width,p.depth,p.height,p.bottom,'stone');
      add('cone',p.u,p.bottom+1.9,p.v,.45,1.4,.45,'wisp');
    }
  }
  for(const r of CASTLE_RECORDS)label(r.title,r.u,r.top+3.3,-12.7,7,0);
  label('LANTERN ATRIUM · EXPLORE IN STILLNESS. DISCOVER IN CHAOS.',126,20.7,0,11);
  label('TESTIMONY ARCHIVE · CHAOS REVEALS THE ERASED PATH',174.5,26.4,0,16);
  // Stained-glass light panels are emissive geometry, not extra shadow lights.
  for(const u of [137,153,169])for(const v of [-14.92,14.92]) {
    block(u,v,3,.035,3.8,26.5,'roof');
    for(const col of [-.7,.7])block(u+col,v-Math.sign(v)*.03,.65,.04,2.6,27,'wisp');
    block(u,v-Math.sign(v)*.05,.14,.05,3.5,26.6,'trim');
  }
  const panel=document.createElement('div');panel.className='spade-castle-journal';
  Object.assign(panel.style,{position:'fixed',right:'22px',bottom:'24px',maxWidth:'310px',padding:'14px 18px',background:'rgba(12,19,36,.9)',border:'1px solid #657394',color:'#dce7fa',font:'12px/1.65 Georgia,serif',pointerEvents:'none',zIndex:15,display:'none'});
  document.body.appendChild(panel);let last='';
  return {discovery,
    update(dt,player,state,inHall){
      panel.style.display=inHall&&state.locked?'block':'none';
      if(!inHall||!state.locked)return;
      const event=discovery.update(player.position,state.chaos);
      if(event)notify?.(`${event.title} · ${event.text}`,8000);
      const feet=player.position.y-2.05,level=CASTLE_LEVELS[feet>29?2:feet>22?1:0];
      const echoText=echo?`\nERASED WITNESS ${echo.recovered?'RESTORED':echo.active?'REVEALED':'HIDDEN'}\n${echo.objective}`:'';
      const text=`${level.name}\nTESTIMONIES ${discovery.count}/3${echoText}\n${state.chaos>.4?'Chaos exposes what the Triad erased.':discovery.objective}`;
      if(text!==last){panel.textContent=text;panel.style.whiteSpace='pre-line';last=text;}
    },
    reset(){discovery.reset();last='';panel.style.display='none';},
  };
}
