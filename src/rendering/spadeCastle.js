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
    // On the +z wall, so it faces -z (toward the hall); facing +z it read mirrored.
    label('UP · '+(s.start===128?'TESTIMONY ARCHIVE':'CROWN OBSERVATORY'),s.start-1,s.low+2.2,14.85,4,Math.PI);
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
      // A bookcase against the wall: obsidian frame, wooden shelves, three rows of books of varied
      // colour, width and height; the top shelf carries the record's title plaque.
      const back=p.v-p.depth/2,front=p.v+p.depth/2,top=p.bottom+p.height;
      block(p.u,back+.1,p.width,.2,p.height,p.bottom,'wood');
      for(const side of [-1,1])block(p.u+side*(p.width/2-.07),p.v,.14,p.depth,p.height,p.bottom,'obsidian');
      block(p.u,p.v,p.width,p.depth,.18,p.bottom,'obsidian');
      block(p.u,p.v+.05,p.width+.3,p.depth+.15,.18,top,'obsidian');
      block(p.u,front+.11,p.width+.3,.06,.08,top+.05,'gold');
      const spines=['velvet','wood','cloth','obsidian','trim'];
      for(let row=0;row<4;row++){
        const shelf=p.bottom+.18+row*.9;
        block(p.u,p.v,p.width-.28,p.depth-.1,.06,shelf,'wood');
        if(row===3)continue;
        let x=-p.width/2+.2,n=0;
        while(x<p.width/2-.25){
          const r=Math.abs(Math.sin(p.u*12.9+row*78.2+n*37.7)),w=.09+r*.09;
          if(r>.08)block(p.u+x+w/2,p.v-.08,w,p.depth-.4,.48+((r*7)%1)*.28,shelf+.06,spines[Math.floor(r*997)%spines.length]);
          x+=w+.012;n++;
        }
      }
    }else if(p.name==='lectern'){
      block(p.u,p.v,.36,.36,p.height-.08,p.bottom,'obsidian');
      block(p.u,p.v,p.width,p.depth,.08,p.bottom+p.height-.08,'gold');
    }else if(p.name==='archive-chest')module('chest',p.u,p.bottom,p.v,p.width,p.height,p.depth);
    else {
      block(p.u,p.v,p.width,p.depth,p.height,p.bottom,'obsidian');
      block(p.u,p.v,p.width+.2,p.depth+.2,.12,p.bottom+p.height,'gold');
    }
  }
  // The three bindings: a floating crystal over a glowing magic circle, chained to its ruler's throne.
  // Veyr (Binder) violet, Sile (Harvester) blood red, Morcant (Gatekeeper) bone gold.
  const bindings=[];
  const ringGeo=new THREE.RingGeometry(1.25,1.36,48),innerGeo=new THREE.RingGeometry(.8,.85,6),crystalGeo=new THREE.OctahedronGeometry(.42,0).scale(1,1.9,1);
  for(const [i,p]of CASTLE_PROPS.filter(p=>p.name==='binding').entries()){
    const color=[0x9b6bff,0xd0304a,0xd9c79a][i],x=-344-p.u,top=p.bottom+p.height;
    const glow=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false});
    const circle=new THREE.Group();circle.position.set(x,p.bottom+.03,p.v);circle.rotation.x=-Math.PI/2;
    circle.add(new THREE.Mesh(ringGeo,glow),new THREE.Mesh(innerGeo,glow));root.add(circle);
    const crystal=new THREE.Mesh(crystalGeo,new THREE.MeshBasicMaterial({color}));crystal.position.set(x,top+1.15,p.v);root.add(crystal);
    // Two chains run from the crystal back to the throne's arms (u 174).
    const chain=new THREE.LineBasicMaterial({color,transparent:true,opacity:.7});
    for(const side of [-1,1])root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      crystal.position.clone(),new THREE.Vector3(-344-172.4,top+.55,p.v+side*.7),new THREE.Vector3(-344-174,31.3,p.v+side*1.2)]),chain));
    bindings.push({circle,crystal,glow,base:crystal.position.y,phase:i*2.1});
  }
  // An open grimoire floats over each lectern in its kingdom's colour (Clover, Heart, Diamond), and
  // glows brighter once its testimony is read.
  const grimoires=[];
  const coverGeo=new THREE.BoxGeometry(.34,.025,.46),pageGeo=new THREE.BoxGeometry(.3,.02,.42);
  const cover=new THREE.MeshStandardMaterial({color:0x2a1424,roughness:.8});
  for(const [i,r]of CASTLE_RECORDS.entries()){
    const lectern=CASTLE_PROPS.filter(p=>p.name==='lectern')[i];
    const color=new THREE.Color([0x9fe0ae,0x8fd6ef,0xf2cf86][i]);
    const glow=new THREE.MeshBasicMaterial({color:color.clone()});
    const book=new THREE.Group();book.position.set(-344-lectern.u,lectern.bottom+lectern.height+.42,lectern.v);
    book.rotation.x=.55; // tilted up toward a reader standing in front (+z)
    for(const side of [-1,1]){
      const half=new THREE.Group();half.rotation.z=side*.22;book.add(half);
      const c=new THREE.Mesh(coverGeo,cover);c.position.x=side*.17;half.add(c);
      const pg=new THREE.Mesh(pageGeo,glow);pg.position.set(side*.165,.022,0);half.add(pg);
    }
    root.add(book);
    grimoires.push({id:r.id,book,glow,color,base:book.position.y,phase:i*1.7});
  }
  let time=0;
  // Title plaques sit on each bookcase's empty top shelf, no wider than the case.
  for(const r of CASTLE_RECORDS)label(r.title,r.u,r.top+3.3,-12.82,3.7,0);
  label('LANTERN ATRIUM · EXPLORE IN STILLNESS. DISCOVER IN CHAOS.',126,20.7,0,11);
  label('TESTIMONY ARCHIVE · CHAOS REVEALS THE ERASED PATH',174.5,26.4,0,16);
  // Stained-glass light panels are emissive geometry, not extra shadow lights.
  for(const u of [137,153,169])for(const v of [-14.92,14.92]) {
    block(u,v,3,.035,3.8,26.5,'roof');
    for(const col of [-.7,.7])block(u+col,v-Math.sign(v)*.03,.65,.04,2.6,27,'wisp');
    block(u,v-Math.sign(v)*.05,.14,.05,3.5,26.6,'trim');
  }
  // Dark Triad heraldry on the ground floor: a gold-edged crimson runner down the hall and spade banners
  // flanking the doorway (inner face u 124, crests face -x) and the back wall (u 176, crests face +x).
  block(150,0,46,3.2,.03,16.12,'velvet');
  for(const side of [-1,1])block(150,side*1.66,46,.12,.035,16.12,'gold');
  for(const [u,face]of [[124.06,-Math.PI/2],[175.94,Math.PI/2]])for(const side of [-1,1]){
    const v=side*(u<150?10.5:11.5);
    block(u,v,.06,2,5.2,17.3,'velvet');
    block(u,v,.08,2.1,.14,22.5,'gold');
    add('spade',u+(u<150?.05:-.05),20.6,v,1.05,1.15,.05,'gold',face);
  }
  const panel=document.createElement('div');panel.className='spade-castle-journal';
  Object.assign(panel.style,{position:'fixed',right:'22px',bottom:'24px',maxWidth:'310px',padding:'14px 18px',background:'rgba(12,19,36,.9)',border:'1px solid #657394',color:'#dce7fa',font:'12px/1.65 Georgia,serif',pointerEvents:'none',zIndex:15,display:'none'});
  document.body.appendChild(panel);let last='';
  return {discovery,
    update(dt,player,state,inHall){
      time+=dt;
      for(const b of bindings){
        b.crystal.rotation.y=time*.6+b.phase;
        b.crystal.position.y=b.base+Math.sin(time*1.3+b.phase)*.12;
        b.circle.rotation.z=-time*.25-b.phase;
        b.glow.opacity=.6+.25*Math.sin(time*2+b.phase);
      }
      for(const g of grimoires){
        g.book.position.y=g.base+Math.sin(time*1.1+g.phase)*.06;
        g.glow.color.copy(g.color).multiplyScalar((discovery.has(g.id)?1:.6)+.08*Math.sin(time*2.3+g.phase));
      }
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
