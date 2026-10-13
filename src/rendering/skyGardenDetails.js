import { SKY, SKY_MAIN, SKY_SHRINE, SUMMIT_DOOR } from '../models/skyIsland.js';
import { loadModel } from './models.js';

export function createStarlightTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.2,'rgba(220,255,241,.9)');
  g.addColorStop(.55,'rgba(160,255,218,.25)');g.addColorStop(1,'rgba(160,255,218,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);
}

export function createSkyGardenDetails({root,world,onReady}) {
  const colliders=[],runes=[],orbitals=[];
  const masonry=new THREE.MeshStandardMaterial({color:0x61746b,roughness:1,flatShading:true});
  const paving=new THREE.MeshStandardMaterial({color:0x4b605a,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const gold=new THREE.MeshStandardMaterial({color:0xb3aa73,roughness:.7});
  const runeMaterial=new THREE.MeshBasicMaterial({color:0x8aeacc,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  function add(g,m,x,y,z){const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;}
  function ring(x,y,z,radius,material=runeMaterial){const m=add(new THREE.RingGeometry(radius-.035,radius+.035,64),material,x,y,z);m.rotation.x=-Math.PI/2;return m;}
  function rune(x,y,z,size=.3){const m=add(new THREE.RingGeometry(size*.5,size,4),runeMaterial,x,y,z);m.rotation.x=-Math.PI/2;runes.push(m);return m;}
  // An inset stone courtyard in front of the summit gateway.
  const courtyard=add(new THREE.CircleGeometry(5.5,24),paving,SUMMIT_DOOR.x,24.08,SUMMIT_DOOR.z);
  courtyard.rotation.x=-Math.PI/2;
  for(let i=0;i<16;i++){
    const mat=paving.clone();mat.color.multiplyScalar(i%2?.9:1.12);
    const tile=add(new THREE.RingGeometry(4.1,5.6,1,1,i*Math.PI/8+.015,Math.PI/8-.03),mat,2,24.095,-499);tile.rotation.x=-Math.PI/2;
    const a=i*Math.PI/8;rune(2+Math.cos(a)*4.7,24.115,-499+Math.sin(a)*4.7,.23);
  }
  ring(2,24.12,-499,3.65);ring(2,24.12,-499,4.05);
  // Glyphs follow the arch rather than obscuring its opening.
  for(let i=0;i<11;i++){
    const a=i*Math.PI/10;
    const m=add(new THREE.RingGeometry(.10,.19,4),runeMaterial,2+Math.cos(a)*4.5,27.2+Math.sin(a)*4.5,-498.54);
    m.rotation.z=a;runes.push(m);
  }
  for(const x of [-2.5,6.5]) for(let i=0;i<4;i++){
    const m=add(new THREE.RingGeometry(.07,.15,4),runeMaterial,x,24.6+i*.6,-498.34);runes.push(m);
  }
  function pillar(x,z,height,y=64){
    add(new THREE.BoxGeometry(.8,height,.9),masonry,x,y+height/2,z);
    add(new THREE.BoxGeometry(1.1,.2,1.2),gold,x,y+height-.1,z);
    colliders.push({x,z,radius:.65,minY:y,maxY:y+height});
  }
  // Broken archways frame the eastern garden and the waterfall resting place.
  for(const [cx,cz,r] of [[SKY.x+10,SKY.z-4,2.7],[SKY.x-14,SKY.z+10,2.2]]){
    for(const side of [-1,1])pillar(cx+side*r,cz,3.2);
    const arch=add(new THREE.TorusGeometry(r,.35,6,16,Math.PI*.8),masonry,cx,67.2,cz);arch.rotation.z=.1;
    for(let i=0;i<4;i++)add(new THREE.DodecahedronGeometry(.3),masonry,cx+r+i*.35,64.2,cz+1.2);
  }
  // Rings and satellite crystals give the high shrine a distinct silhouette.
  ring(SKY_SHRINE.x,68.1,SKY_SHRINE.z,4.9);ring(SKY_SHRINE.x,68.11,SKY_SHRINE.z,3.7);
  const orbitMat=new THREE.MeshBasicMaterial({color:0xc1f9e8,transparent:true,opacity:.65});
  for(let i=0;i<2;i++){
    const m=add(new THREE.TorusGeometry(2.4+i*.55,.035,6,72),orbitMat,SKY_SHRINE.x,71,SKY_SHRINE.z);
    m.rotation.set(.65+i*.9,.3,i*.7);orbitals.push(m);
  }
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rune(SKY_SHRINE.x+Math.cos(a)*4.3,68.14,SKY_SHRINE.z+Math.sin(a)*4.3,.3);}
  for(const [x,z] of [[-13,12],[10,11],[-17,8],[15,-9]]){
    const m=add(new THREE.CylinderGeometry(.25,.4,.55,6),masonry,SKY.x+x,64.275,SKY.z+z);
    rune(m.position.x,64.6,m.position.z,.24);
  }
  // Stone seating above the spring is tucked beside the route.
  add(new THREE.BoxGeometry(3,.25,1),masonry,SKY.x-11,64.7,SKY.z+8);
  for(const side of [-1,1])add(new THREE.BoxGeometry(.35,.65,.8),masonry,SKY.x-11+side,64.325,SKY.z+8);
  const plants=[];
  for(const [cx,cz,floor,isSummit] of [[-6,-494,24,true],[10,-496,24,true],[-7,-515,24,true],
    [SKY.x-10,SKY.z+13,64,false],[SKY.x+13,SKY.z+10,64,false],[SKY.x-17,SKY.z+5,64,false],[SKY.x+12,SKY.z-10,64,false]]){
    for(let i=0;i<12;i++){
      const a=i*2.4,r=1+world.hash(i,cz)*1.8,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;
      if(!isSummit&&!SKY_MAIN.contains(x,z))continue;
      plants.push({x,z,y:floor-.02,height:i%4===0?.85:.35,model:i%4===0?'Bush_Common_Flowers':i%3===0?'Clover_1':'Flower_3_Group'});
    }
  }
  for(const model of new Set(plants.map(p=>p.model)))loadModel(encodeURI(`assets/Stylized Nature MegaKit[Standard]/glTF/${model}.gltf`),1).then(({object})=>{
    for(const p of plants.filter(p=>p.model===model)){
      const m=object.clone(true);m.scale.setScalar(p.height);m.position.set(p.x,p.y,p.z);m.rotation.y=world.hash(p.x,p.z)*Math.PI*2;root.add(m);
    }onReady?.(root);
  }).catch(e=>console.warn(`Sky garden border ${model} unavailable.`,e));
  const moteGeometry=new THREE.BufferGeometry(),positions=new Float32Array(90*3);
  moteGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const motes=new THREE.Points(moteGeometry,new THREE.PointsMaterial({color:0xc8f6c5,map:createStarlightTexture(),size:.16,transparent:true,opacity:.6,depthWrite:false}));
  motes.frustumCulled=false;root.add(motes);
  return {colliders,update(time,awakened,charging){
    runeMaterial.opacity=.35+(awakened?.4:.1)+Math.sin(time*1.4)*.1+charging*.1;
    orbitals.forEach((m,i)=>{m.rotation.y=time*.18*(i?1:-1);m.material.opacity=awakened?.85:.4;});
    for(let i=0;i<90;i++){
      const summit=i<25,cx=summit?2:SKY.x,cz=summit?-499:SKY.z,floor=summit?24:64;
      const a=world.hash(i,1911)*Math.PI*2+time*.06,r=(summit?5:8)+world.hash(i,1912)*(summit?2:12);
      positions.set([cx+Math.cos(a)*r,floor+.5+((time*.15+world.hash(i,1913))%1)*3.5,cz+Math.sin(a)*r],i*3);
    }moteGeometry.attributes.position.needsUpdate=true;
  }};
}
