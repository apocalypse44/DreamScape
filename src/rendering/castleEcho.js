import { createCastleEcho, ECHO_FRAGMENTS, ECHO_ENTRY } from '../models/castleEcho.js';

export function buildCastleEcho({root,obstacles,notify}) {
  const model=createCastleEcho(),group=new THREE.Group();
  group.name='The Erased Castle · architectural memory';group.visible=false;root.add(group);
  const stone=new THREE.MeshStandardMaterial({color:0x60647e,roughness:.88,metalness:.05,emissive:0x241238,emissiveIntensity:.5});
  const trim=new THREE.MeshStandardMaterial({color:0xadb1c5,roughness:.6,emissive:0x4c266b,emissiveIntensity:.5});
  const glow=new THREE.MeshBasicMaterial({color:0xc9a4ff,transparent:true,opacity:.75,depthWrite:false});
  const phantom=new THREE.MeshBasicMaterial({color:0x9984c5,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide});
  const lineMat=new THREE.LineBasicMaterial({color:0xb193db,transparent:true,opacity:.65});
  function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
  function polygon(outline,depth){
    const s=new THREE.Shape();outline.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
    return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,steps:1,curveSegments:4}).rotateX(-Math.PI/2);
  }
  const linkTransforms=[],dummy=new THREE.Object3D();
  for(const p of ECHO_FRAGMENTS){
    const fragment=new THREE.Group();fragment.position.set(p.x,p.bottom,p.z);group.add(fragment);
    const cap=mesh(polygon(p.outline,.45),stone,fragment);
    // Identical geometry and pose for the camera proxy; hidden surfaces do not raycast.
    const proxy=new THREE.Mesh(cap.geometry,stone);proxy.position.copy(fragment.position);proxy.visible=false;
    const raycast=proxy.raycast;proxy.raycast=function(raycaster,hits){if(model.active)raycast.call(this,raycaster,hits);};obstacles.add(proxy);
    mesh(polygon(p.outline.map(([x,z])=>[x*.92,z*.92]),.08),trim,fragment,0,.22,0);
    const rim=p.outline.map(([x,z])=>new THREE.Vector3(x,.46,z));rim.push(rim[0]);
    fragment.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rim),lineMat));
    // Tapered, fluted capitals and the springing of a broken Gothic arch.
    if(p.kind!=='dais')mesh(new THREE.CylinderGeometry(.8,.38,.7,8),stone,fragment,0,-.35,0);
    if(p.kind==='arch'||p.kind==='rib'){
      const rib=new THREE.Shape();rib.moveTo(-1.25,0);rib.quadraticCurveTo(-.9,-.5,0,-1.05);rib.quadraticCurveTo(.9,-.5,1.25,0);
      rib.lineTo(.9,0);rib.quadraticCurveTo(.5,-.35,0,-.65);rib.quadraticCurveTo(-.5,-.35,-.9,0);rib.closePath();
      const g=new THREE.ExtrudeGeometry(rib,{depth:.22,bevelEnabled:false,curveSegments:5}).translate(0,0,-.11);
      for(const z of [-.6,.6])mesh(g,trim,fragment,0,0,z);
    }else{
      mesh(new THREE.CylinderGeometry(.95,.75,.15,8),trim,fragment,0,-.12,0);
    }
    // Carved radial tracery marks the landing centre; it adds no collision bump.
    const spokes=[];
    for(let n=0;n<8;n++){const a=n*Math.PI/4;spokes.push(new THREE.Vector3(Math.cos(a)*.35,.465,Math.sin(a)*.35),new THREE.Vector3(Math.cos(a)*.85,.465,Math.sin(a)*.85));}
    fragment.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes),lineMat));
    if(p.kind==='window'||p.kind==='dais'){
      const rose=mesh(new THREE.TorusGeometry(.8,.045,4,16),glow,fragment,0,.47,0);rose.rotation.x=-Math.PI/2;
    }
    // Broken chain ends explain why these stone fragments hang above the hall.
    for(const side of [-1,1])for(let link=0;link<3;link++){
      dummy.position.set(p.x+side,p.bottom-.25-link*.2,p.z+.45);
      dummy.rotation.set(0,link%2?Math.PI/2:0,0);dummy.updateMatrix();linkTransforms.push(dummy.matrix.clone());
    }
  }
  const links=new THREE.InstancedMesh(new THREE.TorusGeometry(.11,.025,3,6),trim,linkTransforms.length);
  linkTransforms.forEach((matrix,i)=>links.setMatrixAt(i,matrix));links.frustumCulled=false;group.add(links);
  const last=ECHO_FRAGMENTS.at(-1),vision=new THREE.Group();
  vision.position.set(last.x+.65,last.top,last.z+.55);group.add(vision);
  // Veyr's projection, drawn after Dante Zogratis of Black Clover's Dark Triad: tall, long dark hair swept
  // back past the shoulders, an open long coat with a high flared collar over a bare chest. It faces -z,
  // as the original apparition did. Coat pieces are open cylinders with the gap at the front (-z).
  const ghost=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
  const coat=ghost(0x3d2e66,.7),skin=ghost(0xe2d3f5,.55),hair=ghost(0x1a1230,.82),pants=ghost(0x2a2045,.65);
  const tones=[[coat,.7],[skin,.55],[hair,.82],[pants,.65]];
  const open=(top,bottom,height,y,material)=>{const m=mesh(new THREE.CylinderGeometry(top,bottom,height,14,1,true,Math.PI*1.2,Math.PI*1.6),material,vision,0,y,0);return m;};
  for(const side of [-1,1]){
    mesh(new THREE.CylinderGeometry(.1,.08,1.0,8),pants,vision,side*.12,.5,0);                    // legs
    const sleeve=mesh(new THREE.CylinderGeometry(.075,.095,.82,8),coat,vision,side*.36,1.42,0);   // sleeves
    sleeve.rotation.z=side*.18;
    mesh(new THREE.SphereGeometry(.07,10,8),skin,vision,side*.43,1.0,-.02);                       // hands
    mesh(new THREE.SphereGeometry(.12,10,8),coat,vision,side*.29,1.8,0);                          // shoulders
    mesh(new THREE.SphereGeometry(.022,8,6),glow,vision,side*.045,2.07,-.115);                    // eyes
  }
  open(.3,.48,1.05,.78,coat);                                                                     // coat tails
  mesh(new THREE.CylinderGeometry(.19,.16,.62,12),skin,vision,0,1.5,0);                           // bare chest
  open(.27,.25,.66,1.5,coat);                                                                     // coat body
  open(.36,.2,.42,2.0,coat);                                                                      // flared collar
  mesh(new THREE.CylinderGeometry(.06,.07,.14,8),skin,vision,0,1.9,0);                            // neck
  mesh(new THREE.SphereGeometry(.13,14,12),skin,vision,0,2.05,-.01);                              // head
  mesh(new THREE.SphereGeometry(.142,14,10,0,Math.PI*2,0,Math.PI*.55),hair,vision,0,2.07,.012);  // hair, swept back
  const mane=mesh(new THREE.CylinderGeometry(.15,.21,.82,10),hair,vision,0,1.68,.13);             // long hair down the back
  mane.scale.z=.45;
  const chains=[];
  for(const z of [-8,0,8]){
    const points=[new THREE.Vector3(last.x+.65,last.top+1.3,last.z+.55),new THREE.Vector3(-511,30.3,z/2),new THREE.Vector3(-518,31.2,z)];
    const chain=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lineMat);group.add(chain);chains.push(chain);
  }
  // A faint hooded witness kneels beside the projection, head bowed, rather than another enemy.
  mesh(new THREE.ConeGeometry(.3,.75,10),phantom,vision,-1.1,.38,-.45);
  mesh(new THREE.SphereGeometry(.13,12,10),skin,vision,-1.1,.8,-.38);
  mesh(new THREE.SphereGeometry(.16,12,8,0,Math.PI*2,0,Math.PI*.6),phantom,vision,-1.1,.83,-.42);
  // The existing scraped portrait frames regain their erased silhouettes.
  for(const u of [134,147,160]){
    const portrait=new THREE.Group();portrait.position.set(-344-u,19.15,14.45);group.add(portrait);
    mesh(new THREE.CylinderGeometry(.2,.48,1.25,12),phantom,portrait,0,.63,0);
    mesh(new THREE.SphereGeometry(.2,14,12),skin,portrait,0,1.5,0);
    const frame=[[-1.05,0],[1.05,0],[1.05,1.95],[-1.05,1.95],[-1.05,0]].map(([x,y])=>new THREE.Vector3(x,y,0));
    portrait.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(frame),lineMat));
  }

  // A quiet clue exists in calm; the actual path and projection do not.
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#111528';ctx.fillRect(0,0,768,128);
  ctx.fillStyle='#c8badb';ctx.font='25px Georgia';ctx.textAlign='center';
  ctx.fillText('THEY ERASED THE WITNESSES.',384,48);ctx.fillText('THEY COULD NOT ERASE THEIR FOOTSTEPS.',384,89);
  const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
  // Past the bookcases (which end at u 159), so it never sits behind a record's title plaque.
  mesh(new THREE.PlaneGeometry(6.2,1.03),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),root,ECHO_ENTRY.x-8.5,25.8,-14.7);
  let time=0;
  return {model,root:group,
    update(dt,player,state){
      const event=model.update(player,state.chaos,state.locked);
      if(event)notify?.(event.text,event.type==='memory'?11000:8500);
      group.visible=model.active;
      if(!model.active)return;
      time+=dt;glow.opacity=.65+Math.sin(time*1.7)*.1;
      // Only the apparition flickers; all physical landings stay fixed.
      const flicker=(state.chaos>.4?.7:1)+Math.sin(time*4)*.05;
      phantom.opacity=.72*flicker;
      for(const [material,base] of tones)material.opacity=base*flicker;
      chains.forEach((c,i)=>c.visible=state.chaos>.4||model.recovered||i===0);
    },
    reset(){model.reset();group.visible=false;time=0;},
  };
}
