import { SKY, SKY_MAIN, SKY_PLATFORMS, SKY_JUMPS, SKY_LOOKOUT, SKY_SECRET, SKY_SHRINE,
  SKY_RAMP, SKY_BRIDGE, SUMMIT_DOOR, SKY_DOOR, createSkyJourney } from '../models/skyIsland.js';
import { loadModel } from './models.js';
import { cloverGroundTexture } from './cloverDressing.js';
import { createWaterSurface } from './waterfall.js';
import { createSkyGardenDetails, createStarlightTexture } from './skyGardenDetails.js';

export function createSkyIsland({ scene, world, onReady }) {
  const root = new THREE.Group(); root.name = 'Clover floating sky garden'; scene.add(root);
  const journey = createSkyJourney(), colliders = [];
  const details = createSkyGardenDetails({root,world,onReady});colliders.push(...details.colliders);
  const rock = new THREE.MeshStandardMaterial({ color: 0x53656c, roughness: 1, flatShading: true });
  const stone = new THREE.MeshStandardMaterial({ color: 0x9fae96, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x394d4b, roughness: 1 });
  const grass = new THREE.MeshStandardMaterial({ color: 0xc0daa4, map: cloverGroundTexture(world), roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x69543a, roughness: 1 });
  function mesh(geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z);
    m.castShadow = m.receiveShadow = true; root.add(m); return m;
  }
  function island(p, decorate = true) {
    const vertices = [], colors = [];
    const rings = [[p.top - 0.18, 1, 0], [p.top - (p.top - p.bottom) * 0.32, 0.87, 0.6], [p.bottom, 0.15, -1]];
    const point = (i,r) => [p.outline[i][0] * rings[r][1] + rings[r][2], rings[r][0], p.outline[i][1] * rings[r][1]];
    for (let r = 0; r < rings.length-1; r++) for (let i = 0; i < p.outline.length; i++) {
      const j = (i+1) % p.outline.length;
      const color = new THREE.Color(0x53656c).multiplyScalar(0.72 + world.hash(i,r+1220)*0.45);
      for (const pt of [point(i,r),point(j,r),point(i,r+1),point(j,r),point(j,r+1),point(i,r+1)]) {
        vertices.push(...pt); colors.push(color.r,color.g,color.b);
      }
    }
    // Close the pointed underside so the island is solid when seen from below.
    for (let i=0;i<p.outline.length;i++) {
      vertices.push(...point(i,2), ...point((i+1)%p.outline.length,2), -1,p.bottom-2,0);
      for (let k=0;k<3;k++) colors.push(0.2,0.27,0.29);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); geometry.computeVertexNormals();
    const cliff = rock.clone(); cliff.vertexColors = true; cliff.color.set(0xffffff); cliff.side = THREE.DoubleSide;
    mesh(geometry,cliff,p.x,0,p.z);
    const shape = new THREE.Shape(); p.outline.forEach(([x,z],i) => i ? shape.lineTo(x,-z) : shape.moveTo(x,-z)); shape.closePath();
    const cap = new THREE.ShapeGeometry(shape); cap.rotateX(-Math.PI/2);
    const pos = cap.attributes.position, uv = cap.attributes.uv;
    for(let i=0;i<pos.count;i++) uv.setXY(i,(p.x+pos.getX(i))/12,(p.z+pos.getZ(i))/12);
    mesh(cap,decorate ? grass : dark,p.x,p.top,p.z);
    if (decorate) {
      // Angular buttresses and hanging vegetation break up the cliff silhouette.
      p.outline.forEach(([x,z],i) => {
        const rib = mesh(new THREE.DodecahedronGeometry(1.1,0),rock,p.x+x*0.86,p.top-3-world.hash(i,1261)*3,p.z+z*0.86);
        rib.scale.set(1.5,2.8,1.4); rib.rotation.y=i;
        if (i%2===0) for(let k=0;k<4;k++) {
          const vine = mesh(new THREE.ConeGeometry(0.14,2.8+k*0.55,4),new THREE.MeshStandardMaterial({color:0x496831}),
            p.x+x*0.96+k*0.27,p.top-1.6-k*0.4,p.z+z*0.96);
          vine.rotation.z=Math.PI;
        }
      });
    }
  }
  [SKY_MAIN, SKY_LOOKOUT, SKY_SECRET, ...SKY_JUMPS].forEach(p => island(p));
  // Small unreachable fragments frame the island without offering a ground route.
  for (const [x,z,y,r] of [[-30,13,56,3],[-32,-18,72,2],[13,31,59,3],[30,22,49,2],[-10,-32,78,2.5]]) {
    const outline=Array.from({length:7},(_,i)=>[Math.cos(i*Math.PI*2/7)*r,Math.sin(i*Math.PI*2/7)*r]);
    island({x:SKY.x+x,z:SKY.z+z,top:y,bottom:y-8,outline},false);
  }
  mesh(new THREE.BoxGeometry(12,3.8,12),rock,SKY_SHRINE.x,66,SKY_SHRINE.z);
  mesh(new THREE.BoxGeometry(12,0.15,12),grass,SKY_SHRINE.x,67.925,SKY_SHRINE.z);
  const rampGeo=new THREE.BoxGeometry(5,0.22,10,1,1,16), rp=rampGeo.attributes.position;
  for(let i=0;i<rp.count;i++) rp.setY(i,rp.getY(i)+SKY_RAMP.topAt(0,SKY_RAMP.z+rp.getZ(i))-64);
  rampGeo.computeVertexNormals(); mesh(rampGeo,stone,SKY_RAMP.x,63.89,SKY_RAMP.z);
  const bridge = mesh(new THREE.BoxGeometry(12,0.35,3),wood,SKY_BRIDGE.x,63.825,SKY_BRIDGE.z);
  for(let i=0;i<20;i++) mesh(new THREE.BoxGeometry(0.51,0.03,3),wood,SKY.x+16.3+i*0.59,64.015,SKY.z+6);
  for(const side of [-1,1]) {
    mesh(new THREE.BoxGeometry(12,0.12,0.12),wood,bridge.position.x,65,bridge.position.z+side*1.4);
    for(let i=0;i<5;i++) {
      const x=SKY.x+16.3+i*2.8,z=SKY.z+6+side*1.4;
      mesh(new THREE.BoxGeometry(0.13,1,0.13),wood,x,64.5,z);
      colliders.push({x,z,radius:0.13,minY:63.5,maxY:65.1});
    }
  }
  // A continuous collision strip matches each bridge rail.
  const rails=[-1,1].map(side=>({x:SKY_BRIDGE.x,z:SKY_BRIDGE.z+side*1.4,width:12,depth:0.12,top:65,bottom:64,solid:true}));
  function obstacle(x,z,w,h,d,y=64) {
    mesh(new THREE.BoxGeometry(w,h,d),stone,SKY.x+x,y+h/2,SKY.z+z);
    colliders.push({x:SKY.x+x,z:SKY.z+z,radius:Math.hypot(w,d)/2,minY:y,maxY:y+h});
  }
  // Open ruins enclose a grove while keeping the portal and shrine approaches clear.
  for(const [x,z,h] of [[-13,11,2.5],[9,12,1.7],[-15,-12,3],[7,-14,2.2]]) obstacle(x,z,1,h,1);
  obstacle(-14,8,0.8,1.2,5); obstacle(11,12,4,0.9,0.8);
  for(let i=0;i<3;i++) { const b=mesh(new THREE.BoxGeometry(1.4,0.55,0.9),stone,SKY.x-12+i*1.6,64.275,SKY.z+5); b.rotation.y=i*0.4; }
  function trail(points) {
    for(let k=1;k<points.length;k++) {
      const a=points[k-1],b=points[k],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.3);
      for(let i=0;i<n;i++) {
        const t=i/n,x=SKY.x+a[0]+(b[0]-a[0])*t,z=SKY.z+a[1]+(b[1]-a[1])*t;
        let y=64;
        if(Math.abs(x-SKY_RAMP.x)<2.5 && z<=SKY.z+5 && z>=SKY.z-5) y=SKY_RAMP.topAt(x,z);
        else if(Math.abs(x-SKY_SHRINE.x)<6 && Math.abs(z-SKY_SHRINE.z)<6) y=68;
        const p=mesh(new THREE.CylinderGeometry(0.42,0.51,0.07,7),stone,x,y+0.045,z); p.rotation.y=i;
      }
    }
  }
  trail([[0,10],[-5,5],[-5,-11]]); trail([[0,7],[10,6],[16,6]]);
  trail([[0,7],[-12,2],[-15,-2]]); trail([[10,6],[17,-2],[20,-8]]);
  const crystals=[], gardenLights=[];
  function crystal(x,y,z,size,color) {
    const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.45,roughness:0.2,metalness:0.25});
    const m=mesh(new THREE.OctahedronGeometry(size),mat,x,y,z); m.scale.y=1.7;
    crystals.push({mesh:m,y}); return m;
  }
  mesh(new THREE.CylinderGeometry(1.9,2.3,0.6,12),dark,SKY_SHRINE.x,68.3,SKY_SHRINE.z);
  const shrineCrystal=crystal(SKY_SHRINE.x,71,SKY_SHRINE.z,1.6,0x83ecd8);
  const shrineGlow=new THREE.PointLight(0x8ef5da,0.45,15);
  shrineGlow.position.set(SKY_SHRINE.x,71,SKY_SHRINE.z);root.add(shrineGlow);
  const orbit=mesh(new THREE.TorusGeometry(2.3,0.065,6,48),new THREE.MeshBasicMaterial({color:0xd0fff1}),SKY_SHRINE.x,71,SKY_SHRINE.z);
  orbit.rotation.x=Math.PI/2.4;
  colliders.push({x:SKY_SHRINE.x,z:SKY_SHRINE.z,radius:2,minY:68,maxY:72});
  // Shrine trigger surrounds the pedestal, so the player never needs to enter it.
  for(let i=0;i<6;i++) {
    const a=i*Math.PI/3,x=SKY_SHRINE.x+Math.cos(a)*4.8,z=SKY_SHRINE.z+Math.sin(a)*4.8;
    mesh(new THREE.CylinderGeometry(0.35,0.5,0.8,6),stone,x,68.4,z);
    gardenLights.push(crystal(x,69.25,z,0.23,0x92ebc6));
  }
  crystal(SKY_SECRET.x,70,SKY_SECRET.z,0.8,0xdbb6ff);
  mesh(new THREE.BoxGeometry(2.8,0.25,0.8),wood,SKY_LOOKOUT.x,64.6,SKY_LOOKOUT.z+1.7);
  for(const x of [-1,1]) mesh(new THREE.BoxGeometry(0.2,0.6,0.6),wood,SKY_LOOKOUT.x+x,64.3,SKY_LOOKOUT.z+1.7);
  for(let i=0;i<5;i++) obstacle(29+Math.cos(i*Math.PI/4)*4.5,6+Math.sin(i*Math.PI/4)*4.5,0.35,0.8,0.35);
  // A sky spring feeds the waterfall through a shallow stream along the west rim.
  const poolMat=createWaterSurface('pool'), fallMat=createWaterSurface('fall');
  const pool=mesh(new THREE.CircleGeometry(3.2,48),poolMat,SKY.x-15,64.11,SKY.z-2); pool.rotation.x=-Math.PI/2;
  const stream=mesh(new THREE.PlaneGeometry(9,1.8,16,1),poolMat,SKY.x-19,64.12,SKY.z+1);
  stream.rotation.x=-Math.PI/2; stream.rotation.z=-0.48;
  const fall=mesh(new THREE.PlaneGeometry(3.2,36,12,48),fallMat,SKY.x-23,46.1,SKY.z+3.2);
  fall.rotation.y=Math.PI/2;
  const sprayGeo=new THREE.BufferGeometry(),sprayPositions=new Float32Array(80*3);
  sprayGeo.setAttribute('position',new THREE.BufferAttribute(sprayPositions,3));
  const spray=new THREE.Points(sprayGeo,new THREE.PointsMaterial({color:0xcce9e5,size:0.12,transparent:true,opacity:0.45,depthWrite:false})); root.add(spray);
  const placements=[];
  for(const [x,z,model,height] of [[-13,14,'CommonTree_2',7],[13,14,'CommonTree_3',6],[-18,-8,'CommonTree_1',6],
    [12,-15,'Pine_1',6],[7,-20,'Pine_2',5],[-18,7,'CommonTree_2',5]]) {
    placements.push({x,z,model,height}); colliders.push({x:SKY.x+x,z:SKY.z+z,radius:0.8,minY:64,maxY:64+height});
    for(let i=0;i<10;i++) {
      const a=i*2.4,r=1.6+world.hash(i,z+1660)*2;
      placements.push({x:x+Math.cos(a)*r,z:z+Math.sin(a)*r,model:['Flower_4_Group','Clover_2','Bush_Common','Rock_Medium_1'][i%4],height:[0.5,0.3,0.9,0.6][i%4]});
    }
  }
  // Rocks around the spring anchor its edge and keep the stream readable.
  for(let i=0;i<10;i++) { const a=i*Math.PI*2/10; placements.push({x:-15+Math.cos(a)*3.4,z:-2+Math.sin(a)*3.4,model:'Rock_Medium_2',height:0.6}); }
  for(const model of new Set(placements.map(p=>p.model))) loadModel(encodeURI(`assets/Stylized Nature MegaKit[Standard]/glTF/${model}.gltf`),1)
    .then(({object})=>{
      for(const p of placements.filter(p=>p.model===model && SKY_MAIN.contains(SKY.x+p.x,SKY.z+p.z))) {
        const copy=object.clone(true); copy.scale.setScalar(p.height); copy.position.set(SKY.x+p.x,63.98,SKY.z+p.z);
        copy.rotation.y=world.hash(p.x,p.z+1700)*Math.PI*2; root.add(copy);
      }
      onReady?.(root);
    }).catch(error=>console.warn(`Sky garden ${model} unavailable.`,error));
  const portalMaterial = new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0},uCharge:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float uTime,uCharge; varying vec2 vUv; void main(){
      vec2 p=(vUv-vec2(.5,.46))*vec2(1.,.9); float r=length(p); float a=atan(p.y,p.x);
      float swirl=.5+.5*sin(a*3.-r*24.+uTime*1.8); float rings=.5+.5*sin(r*65.-uTime*3.);
      vec3 col=mix(vec3(.035,.13,.18),vec3(.28,.85,.7),swirl*.55+rings*.2);
      float edge=smoothstep(.28,.48,r); col+=edge*vec3(.28,.5,.4);
      col+=uCharge*vec3(.22,.4,.32);
      gl_FragColor=vec4(col,.82);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }` });
  function doorway(p,frame) {
    if(frame) {
      for(const side of [-1,1]) mesh(new THREE.BoxGeometry(0.65,3.2,0.8),stone,p.x+side*4.05,p.top+1.6,p.z);
      mesh(new THREE.TorusGeometry(4.05,0.32,8,24,Math.PI),stone,p.x,p.top+3.2,p.z);
    }
    const s=new THREE.Shape(); s.moveTo(-3.7,0.05);s.lineTo(3.7,0.05);s.lineTo(3.7,3.2);
    s.absarc(0,3.2,3.7,0,Math.PI,false);s.lineTo(-3.7,0.05);
    const geo=new THREE.ShapeGeometry(s),uv=geo.attributes.uv,pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++) uv.setXY(i,(pos.getX(i)+3.7)/7.4,pos.getY(i)/6.9);
    const door=mesh(geo,portalMaterial,p.x,p.top,p.z); door.castShadow=false;
    const threshold=mesh(new THREE.BoxGeometry(7.4,0.08,1.6),dark,p.x,p.top+0.04,p.z);
    threshold.castShadow=false;
    if(frame) for(const side of [-1,1]) colliders.push({x:p.x+side*4.05,z:p.z,radius:0.5,minY:p.top,maxY:p.top+3.2});
  }
  doorway(SUMMIT_DOOR,false); doorway(SKY_DOOR,true);
  function sign(text,x,y,z,width=4) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#163a35';ctx.fillRect(0,0,512,128);
    ctx.strokeStyle='#91cab0';ctx.lineWidth=6;ctx.strokeRect(4,4,504,120);
    ctx.fillStyle='#e5f6d9';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,72);
    const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
    // Two front-facing panels keep text readable on either approach. Rendering
    // the reverse of one textured plane mirrors its lettering.
    const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide});
    mesh(new THREE.PlaneGeometry(width,1),material,x,y,z+.75);
    const back=mesh(new THREE.PlaneGeometry(width,1),material,x,y,z-.75);back.rotation.y=Math.PI;
  }
  sign('SKY GARDEN · PRESS E',SUMMIT_DOOR.x,25,SUMMIT_DOOR.z,4.5);
  sign('CLOVER SUMMIT · PRESS E',SKY_DOOR.x,65,SKY_DOOR.z,4.5);
  sign('STARLIGHT LEDGES →',SKY.x+17,65.4,SKY.z-5,3.3);
  const fade=document.createElement('div');fade.setAttribute('aria-hidden','true');
  Object.assign(fade.style,{position:'fixed',inset:'0',background:'#b2ffec',opacity:'0',pointerEvents:'none',zIndex:'1000'}); document.body.appendChild(fade);
  const hint=document.createElement('div');hint.setAttribute('role','status');
  Object.assign(hint.style,{position:'fixed',bottom:'18%',left:'50%',transform:'translateX(-50%)',padding:'12px 20px',
    background:'rgba(10,35,32,.88)',color:'#d8fbe6',border:'1px solid #81bda3',font:'bold 14px monospace',
    textAlign:'center',maxWidth:'80vw',pointerEvents:'none',zIndex:'20',display:'none'});document.body.appendChild(hint);
  const flightRoot=new THREE.Group();flightRoot.visible=false;scene.add(flightRoot);
  const auraMaterial=new THREE.MeshBasicMaterial({color:0xa3ffdf,transparent:true,opacity:.7,depthWrite:false});
  for(let i=0;i<3;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(1.5+i*.15,.04,6,48),auraMaterial);r.rotation.set(Math.PI/2,i*.7,i);flightRoot.add(r);}
  flightRoot.add(new THREE.PointLight(0xa3ffdf,.9,7));
  const sparkGeometry=new THREE.BufferGeometry(),sparkPositions=new Float32Array(40*3);
  sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
  const sparks=new THREE.Points(sparkGeometry,new THREE.PointsMaterial({map:createStarlightTexture(),color:0xd8fff0,size:.2,transparent:true,opacity:.9,depthWrite:false}));
  sparks.frustumCulled=false;flightRoot.add(sparks);
  const trailGeometry=new THREE.BufferGeometry(),trailPositions=new Float32Array(64*3);
  trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));
  const flightTrail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:0x9bffe0,transparent:true,opacity:.75,depthWrite:false}));flightTrail.frustumCulled=false;flightTrail.visible=false;scene.add(flightTrail);
  const pulseMaterial=new THREE.MeshBasicMaterial({color:0xbaffdf,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const pulse=new THREE.Mesh(new THREE.RingGeometry(.8,1,64),pulseMaterial);pulse.rotation.x=-Math.PI/2;scene.add(pulse);
  let time=0,pulseTime=0,trailHistory=[],travelFov=null;
  return {root,colliders,platforms:[...SKY_PLATFORMS,...rails],journey,
    update(dt,player,keys,state,onTravel) {
      time+=dt; const event=journey.update(dt,player.position,keys.has('KeyE'),state.locked);
      player.inFlight=Boolean(event.flight);
      if(event.flight){
        const p=event.flight;player.position.set(p.x,p.top+2.05,p.z);player.velocity.set(0,0,0);
        player.grounded=false;player.jumpBuffer=player.coyote=0;state.yaw=p.yaw;state.crouching=false;
        flightRoot.position.set(p.x,p.top+1,p.z);flightRoot.rotation.y+=dt*2;
        flightRoot.scale.setScalar(p.phase==='charge'?.6+.4*p.charge:1);
        for(let i=0;i<40;i++){const a=i*2.4+time,r=1.4+world.hash(i,2030)*.7;
          sparkPositions.set([Math.cos(a)*r,Math.sin(time*2+i)*1.2,Math.sin(a)*r],i*3);}
        sparkGeometry.attributes.position.needsUpdate=true;
        if(p.phase==='charge')trailHistory=[];
        trailHistory.unshift([p.x,p.top+1,p.z]);trailHistory.length=Math.min(trailHistory.length,64);
        for(let i=0;i<64;i++)trailPositions.set(trailHistory[Math.min(i,trailHistory.length-1)],i*3);
        trailGeometry.attributes.position.needsUpdate=true;
      }
      flightRoot.visible=flightTrail.visible=Boolean(event.flight);
      if(event.target){onTravel(event.target);pulseTime=1;pulse.position.set(event.target.x,event.target.top+.15,event.target.z);trailHistory=[];}
      pulseTime=Math.max(0,pulseTime-dt);pulseMaterial.opacity=pulseTime*.6;pulse.scale.setScalar(1+(1-pulseTime)*5);
      fade.style.opacity=String(event.fade);
      const text=state.locked ? event.hint : null;
      if(hint.textContent!==text) hint.textContent=text||'';hint.style.display=text?'block':'none';
      portalMaterial.uniforms.uTime.value=time;poolMat.uniforms.uTime.value=time;fallMat.uniforms.uTime.value=time;
      portalMaterial.uniforms.uCharge.value=event.flight?.phase==='charge'?event.flight.charge:0;
      details.update(time,journey.awakened,event.flight?.charge||0);
      for(const c of crystals) {c.mesh.rotation.y+=dt*.35;c.mesh.position.y=c.y+Math.sin(time*1.4+c.y)*.15;}
      shrineCrystal.material.emissiveIntensity=journey.awakened?1.3:0.45;
      shrineGlow.intensity=journey.awakened?1.4:0.45;
      gardenLights.forEach(m=>m.material.emissiveIntensity=journey.awakened?1.7:0.12);
      orbit.rotation.z+=dt*.25;
      for(let i=0;i<80;i++) {const t=(time*.34+world.hash(i,1810))%1;
        sprayPositions.set([SKY.x-23-world.hash(i,1811)*1.3,64-t*38,SKY.z+3.2+(world.hash(i,1812)-.5)*3],i*3);}
      sprayGeo.attributes.position.needsUpdate=true;
    },
    updateTravelCamera(camera,player){
      const pose=journey.cinematic;if(!pose)return 4.5;
      if(travelFov===null)travelFov=camera.fov;
      const fov=travelFov+7*Math.sin(pose.progress*Math.PI);
      if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix();}
      const settle=pose.arrival,distance=8-5*settle,height=3*(1-settle);
      camera.position.set(player.position.x+Math.sin(pose.yaw)*distance,player.position.y+height,player.position.z+Math.cos(pose.yaw)*distance);
      camera.lookAt(player.position.x,player.position.y-.3,player.position.z);return distance;
    },
    restoreTravelCamera(camera){if(travelFov!==null){camera.fov=travelFov;camera.updateProjectionMatrix();travelFov=null;}},
    reset(){journey.reset();fade.style.opacity='0';hint.style.display='none';flightRoot.visible=flightTrail.visible=false;pulseTime=0;pulseMaterial.opacity=0;trailHistory=[];time=0;}
  };
}
