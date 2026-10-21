import { storyVolumes, BORDER_ANCHOR } from '../models/spadeStory.js';
import { insideRefuge } from '../models/spadeCampaign.js';

// ground(x, z): the terrain as drawn, for paths laid over slopes. road: the avenue's paving material.
export function buildSpadeStory({root,add,block,label,height,ground,road}) {
  const volumes=storyVolumes(height),base=height(-447);
  for(const p of volumes){
    if(!p.name||p.name==='refuge-floor')block(p.u,p.v,p.width,p.depth,p.top-p.bottom,p.bottom,'house');
    if(p.name==='refuge-bed'){
      block(p.u,p.v,p.width,p.depth,.35,p.bottom,'roof');
      block(p.u,p.v,p.width+.05,p.depth,.25,p.bottom+.35,'cloth');
      block(p.u,p.v-.9,p.width,.6,.18,p.bottom+.6,'trim');
    }
    if(p.name==='refuge-table'||p.name==='supplies'){
      block(p.u,p.v,p.width,p.depth,p.top-p.bottom,p.bottom,'wood');
      if(p.name==='supplies')for(const side of [-1,1])block(p.u+side*.42,p.v,.1,p.depth+.03,p.top-p.bottom,p.bottom,'trim');
    }
  }
  // Neris herself is a hooded villager mannequin (rendering/npc.js, VILLAGERS).
  block(25,-25,.3,.3,.5,2.8,'light');
  label('NERIS · LANTERN REFUGE',22,5.2,-18.25,5,0);
  label('THEY TOOK OUR MEMORIES. NOT OUR LIGHT.',22,4,-27.75,7,0);
  // A repaired resistance banner and supplies make this an occupied shelter.
  block(17.25,-24,.08,2.4,1.6,3.1,'cloth');
  for(const u of [18,26])block(u,-18.2,.45,.45,.5,2.4,'light');
  // A short side path leaves the main avenue unobstructed. It crosses the avenue's sideways slope, so it
  // is a strip draped over the drawn terrain (a vertex every ~0.75 m, 5 cm above it), not a flat slab.
  const path=new THREE.PlaneGeometry(4.5,40,6,54).rotateX(-Math.PI/2).translate(-344-103,0,-26);
  const at=path.attributes.position;
  for(let i=0;i<at.count;i++)at.setY(i,ground(at.getX(i),at.getZ(i))+.05);
  path.computeVertexNormals();
  const paving=road.clone();paving.polygonOffset=true;paving.polygonOffsetFactor=-2;paving.polygonOffsetUnits=-2;
  const pathMesh=new THREE.Mesh(path,paving);pathMesh.receiveShadow=true;root.add(pathMesh);
  add('disc',103,base+.035,-48,6.3,.07,6.3,'road');
  block(103,-48,3.2,3.2,2.6,base,'roof');
  add('orb',103,base+3.6,-48,.8,1.2,.8,'wisp');
  for(const side of [-1,1])for(const edge of [-1,1]){
    const u=103+side*5,v=-48+edge*5;
    block(u,v,1,1,4.4,base-2,'stone');
    // Four segmented chains sag between posts and the anchor, using one batch.
    for(let i=0;i<10;i++){
      const t=i/10,pu=u+(103-u)*t,pv=v+(-48-v)*t,py=base+2.2-.8*Math.sin(t*Math.PI);
      add('orb',pu,py,pv,.13,.13,.13,'trim');
      const middle=t+.05;
      add('box',u+(103-u)*middle,base+2.2-.8*Math.sin(middle*Math.PI),v+(-48-v)*middle,.09,.09,.74,'trim',Math.atan2(u-103,-48-v));
    }
  }
  label('BORDER ANCHOR · THE SETTLEMENT IS BOUND',103,base+6,-54,10,0);
  // Erased portraits and scraped plaques carry the memory theme into the hall.
  for(const u of [134,147,160]){
    block(u,14.84,2.8,.14,2.6,18.7,'wood');
    block(u,14.72,2.3,.06,2.1,18.95,'roof');
    for(let n=0;n<4;n++)block(u-.8+n*.5,14.65,.18,.06,1.5-n*.18,19.2,'house');
  }
  // Three distinct stolen currents: branching roots, stepped water channels and
  // angular prism sockets. Emissive strips add no point lights or shadow maps.
  // Rows stay below the archive gallery's slab (bottom 22.77); the prism row used to poke through it.
  for(const [i,material]of ['root','tide','prism'].entries()){
    const y=17.6+i*1.6;
    block(150,-14.7,43,.12,.13,y,material);
    for(let n=0;n<5;n++){
      const u=132+n*8;
      block(u,-14.68,.13,.14,i===0?1.3:.7,y,material);
      if(i===0)block(u+1,-14.68,2,.14,.12,y+1.2,material);
      else if(i===1)block(u+1,-14.68,2,.14,.12,y+.6,material);
      else add('orb',u,y+.5,-14.65,.3,.5,.12,material);
    }
  }
  // The Dark Triad's thrones (after Black Clover's Spade castle): black stone with spired backs, a
  // blood-crimson panel and a gold spade crest, under the observatory's 5.9 m ceiling. They face the
  // hall (+x). Name plaques sit on each dais front, readable on approach.
  for(const [i,v]of [-8,0,8].entries()){
    const floor=30.12,back=floor+3.6;
    block(173.6,v,3.4,3.4,.3,floor,'obsidian');                                   // dais
    block(175.3,v,.4,2.6,3.6,floor,'obsidian');                                   // backrest
    block(175.08,v,.06,1.9,2.7,floor+.75,'velvet');                               // crimson panel
    add('spade',175.0,floor+2.75,v,1.1,1.15,.1,'gold',Math.PI/2);                 // crest
    for(const [o,h]of [[-1,1.1],[0,1.6],[1,1.1]])add('cone',175.3,back+h/2,v+o*.95,.3,h,.3,'obsidian',Math.PI/4); // spires
    block(174,v,1.9,2.2,.45,floor+.3,'velvet');                                   // seat
    for(const side of [-1,1]){
      block(174,v+side*1.2,1.9,.3,.95,floor+.3,'obsidian');                       // arms
      add('spade',173.1,floor+1.45,v+side*1.2,.32,.36,.08,'gold',Math.PI/2);      // finials
    }
    label(['VEYR · THE BINDER','SILE · THE HARVESTER','MORCANT · THE GATEKEEPER'][i],171.85,floor+.55,v,3.4);
  }
  const uniforms={uTime:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float edge=pow(max(0.,1.-abs(r-.78)*24.),2.);float veins=pow(max(0.,sin(a*9.+sin(r*13.-uTime*.6))),14.);float mist=.5+.5*sin(r*19.-uTime*.8+a*3.);float mask=1.-smoothstep(.78,.95,r);vec3 color=mix(vec3(.06,.11,.24),vec3(.5,.38,.8),mist*.7+edge);gl_FragColor=vec4(color,(.18+veins*.14+edge*.55)*mask);}`});
  const gate=new THREE.Mesh(new THREE.PlaneGeometry(11,18),material);
  gate.position.set(-519.75,25.7,0);gate.rotation.y=Math.PI/2;root.add(gate);
  for(const side of [-1,1])block(175.8,side*6.2,.4,.8,18,16.4,'trim');
  block(175.8,0,.4,13.2,.6,34.4,'trim');
  label('THE HOLLOW GATE · SEALED BY THREE BINDINGS',175.6,35.4,0,15);
  const ward=new THREE.Mesh(new THREE.PlaneGeometry(5,5),material);
  ward.position.set(-344-BORDER_ANCHOR.u,base+4,-48);root.add(ward);
  // Neris and the border anchor speak through the chapter campaign (spadeCampaign.js).
  let seenGate=false;
  return {
    ward,insideRefuge,
    update(dt,player,state,notify){
      uniforms.uTime.value+=dt;
      if(!state.locked||state.chaos>.4)return;
      if(!seenGate&&player.position.x<-510&&player.position.x>-520&&Math.abs(player.position.z)<5&&player.position.y<22){seenGate=true;notify?.('THE HOLLOW GATE · Stolen currents feed the rift. Breaking the Triad’s defenses will require allies from three kingdoms.',7000);}
    },
    reset(){seenGate=false;},
  };
}
