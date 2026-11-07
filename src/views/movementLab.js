import { createGameState } from '../models/state.js';
import { createFixedStepper } from '../models/fixedStep.js';
import { createPlayerController, createSurfaceAt } from '../controllers/player.js';
import { createCameraController } from '../controllers/camera.js';
import { createTravelerCharacter } from '../rendering/travelerCharacter.js';
import { createTravelerCombat } from '../models/travelerCombat.js';
import { createTrainingYard } from './trainingYard.js';
import { createCharacterGallery } from './characterGallery.js';
import { EXPRESSIONS } from '../models/faceExpression.js';

const canvas=document.querySelector('#labCanvas'),status=document.querySelector('#labStatus'),toastBox=document.querySelector('#labToast');
let toastTimer=0;function toast(text){if(!toastBox)return;toastBox.textContent=text;toastBox.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastBox.classList.remove('show'),700);}
async function start(){
  const T=THREE,scene=new T.Scene();scene.background=new T.Color(0xdce7de);scene.fog=new T.Fog(0xdce7de,30,105);
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const camera=new T.PerspectiveCamera(54,innerWidth/innerHeight,.1,130);
  scene.add(new T.HemisphereLight(0xe9f0df,0x7f907b,.95));
  const sun=new T.DirectionalLight(0xffebc8,1.4);sun.position.set(-14,25,12);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-32;sun.shadow.camera.right=sun.shadow.camera.top=32;sun.shadow.normalBias=.025;scene.add(sun);
  const {state,keys,pointerButtons,player}=createGameState();state.pitch=-.12;
  const surfaces=[],colliders=[],obstacles=new T.Group();scene.add(obstacles);
  let groundTime=0,living=false,groundDirty=false,inspect=true,portraitYaw=Math.PI+.5,portraitDistance=4.2,portraitHeight=.05,portraitAim=.8;
  function ground(x,z){
    if(x>13&&x<24&&z< -12&&z> -43)return -5;
    const hill=Math.max(0,1-Math.hypot((x-12)/8,(z-3)/9));
    const breathe=living?Math.max(0,1-Math.hypot((x+12)/6,(z-8)/6))*.55*Math.sin(groundTime*.8):0;
    return hill*hill*1.6+breathe;
  }
  const groundGeometry=new T.PlaneGeometry(100,100,120,120);groundGeometry.rotateX(-Math.PI/2);
  const groundPositions=groundGeometry.attributes.position,groundColors=[];
  const baseColor=new T.Color(),green=new T.Color(0x91ae83).convertSRGBToLinear(),sand=new T.Color(0xc9c2a0).convertSRGBToLinear();
  for(let i=0;i<groundPositions.count;i++){
    const x=groundPositions.getX(i),z=groundPositions.getZ(i);groundPositions.setY(i,ground(x,z));
    const path=Math.max(0,1-Math.abs(x)/4)*Math.max(0,1-Math.abs(z+12)/32);
    baseColor.copy(green).lerp(sand,path*.7).multiplyScalar(.97+.035*Math.sin(x*1.3+z*.7));groundColors.push(baseColor.r,baseColor.g,baseColor.b);
  }
  groundGeometry.setAttribute('color',new T.Float32BufferAttribute(groundColors,3));groundGeometry.computeVertexNormals();
  const floor=new T.Mesh(groundGeometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));floor.receiveShadow=true;scene.add(floor);
  const stone=new T.MeshStandardMaterial({color:0xc8c8b1,roughness:.95}),timber=new T.MeshStandardMaterial({color:0x8c7050,roughness:1});
  function block(x,z,w,d,top,bottom=0,material=stone){
    const mesh=new T.Mesh(new T.BoxGeometry(w,top-bottom,d),material);mesh.position.set(x,(top+bottom)/2,z);mesh.castShadow=mesh.receiveShadow=true;obstacles.add(mesh);
    const platform={x,z,width:w,depth:d,top,bottom,solid:true};surfaces.push(platform);return platform;
  }
  for(let i=0;i<5;i++)block(-3,-8-i*1.15,4.4,1.15,(i+1)*.3);
  block(-3,-14.5,4.4,3,1.5);
  // One continuous sloped box: its visual top and collision use the same rule.
  const ramp={x:-12,z:-15,width:5,depth:12,bottom:-.1,top:2.4,solid:true,topAt:(x,z)=>2.4*Math.max(0,Math.min(1,(-z-9)/12))};surfaces.push(ramp);
  const rampGeo=new T.BoxGeometry(5,1,12),rp=rampGeo.attributes.position;
  for(let i=0;i<rp.count;i++){const z=rp.getZ(i)-15;rp.setY(i,rp.getY(i)>0?ramp.topAt(-12,z):-.1);}rampGeo.computeVertexNormals();
  const rampMesh=new T.Mesh(rampGeo,stone);rampMesh.position.set(-12,0,-15);rampMesh.castShadow=rampMesh.receiveShadow=true;obstacles.add(rampMesh);
  block(-12,-23,5,4,2.4);
  block(7,-9,5,1,2.7);for(let x=5;x<=9;x+=.7)colliders.push({x,z:-9,radius:.58,minY:0,maxY:2.7});
  for(let i=0;i<4;i++)block(18,-16-i*7,4,4,1.8,-5);
  // Doorway and low posts test shoulder/camera collision.
  for(const x of [-1.8,1.8]){block(x,8,.65,.75,3.2);colliders.push({x,z:8,radius:.48});}
  block(0,8,4.2,.75,3.65,3.1);
  const treeMat=new T.MeshStandardMaterial({color:0x466d52,roughness:1,flatShading:true});
  for(const [x,z,s]of [[-22,-8,1],[-24,5,1.3],[-19,18,1.1],[25,9,1.3],[24,-25,.9],[-6,-31,1.5],[7,-30,1]]){
    const y=ground(x,z),trunk=new T.Mesh(new T.CylinderGeometry(.14*s,.23*s,2.7*s,7),timber);trunk.position.set(x,y+1.35*s,z);trunk.castShadow=true;scene.add(trunk);
    const crown=new T.Mesh(new T.IcosahedronGeometry(1.7*s,1),treeMat);crown.scale.y=1.2;crown.position.set(x,y+3.25*s,z);crown.castShadow=true;scene.add(crown);
    colliders.push({x,z,radius:.35*s});
  }
  function sign(text,x,z){
    const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.fillStyle='#f5efda';g.fillRect(0,0,512,96);g.fillStyle='#3f6454';g.font='24px Georgia';g.textAlign='center';g.fillText(text,256,57);
    const tex=new T.CanvasTexture(c);tex.encoding=T.sRGBEncoding;
    const mesh=new T.Mesh(new T.PlaneGeometry(3.8,.7),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));mesh.position.set(x,ground(x,z)+1.7,z);scene.add(mesh);
  }
  sign('THE STEPS',-3,-17);sign('THE LONG SLOPE',-12,-26);sign('THREE LITTLE LEAPS',18,-11);sign('LIVING GROUND',-12,12);
  const surfaceAt=createSurfaceAt(surfaces,ground),stepper=createFixedStepper();
  let combat=null,combatState=null,hitstop=0,shake=0;const pressed={attack:false,dodge:false,sheathe:false};
  const yard=createTrainingYard({scene,ground,colliders,onImpact:(heavy)=>{hitstop=heavy?.11:.065;shake=Math.max(shake,heavy?.16:.08);}});
  const movement=createPlayerController({state,keys,player,chunks:new Map(),terrainHeight:ground,staticColliders:colliders,platforms:surfaces,
    locomotion:{walkSpeed:4.2,sprintSpeed:7.8,crouchSpeed:2,smooth:true,variableJump:true,drive:()=>combatState?.drive},
    courseRecovery:p=>p.position.x>13&&p.position.x<24&&p.position.z< -12&&p.position.y<.5?{x:18,z:-16,top:1.8}:null});
  const previous=new T.Vector3(),renderPosition=new T.Vector3(),renderPlayer=Object.create(player);renderPlayer.position=renderPosition;
  const view=createCameraController({camera,state,player:renderPlayer,chunks:new Map(),terrainHeight:ground,staticObstacles:[obstacles]});
  const avatar=createTravelerCharacter({scene,state,player:renderPlayer,surfaceAt,status,walkSpeed:4.2});
  function reset(target={x:0,z:0,top:0}){
    keys.clear();pointerButtons.clear();combat?.reset();combatState=null;movement.teleport({...target,yaw:0});state.pitch=-.12;state.chaos=.06;state.mode='calm';previous.copy(player.position);renderPosition.copy(player.position);stepper.reset();avatar.reset();
  }
  reset();
  const explore=document.querySelector('#explore'),portrait=document.querySelector('#portrait');
  function release(){keys.clear();pointerButtons.clear();player.velocity.x=player.velocity.z=0;player.jumpBuffer=0;}
  document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===canvas;document.body.classList.toggle('playing',state.locked);release();});
  addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  explore.onclick=()=>{inspect=false;galleryTarget=null;canvas.requestPointerLock();};portrait.onclick=()=>{document.exitPointerLock();inspect=true;galleryTarget=null;portraitDistance=4.2;portraitYaw=avatar.root.rotation.y+.5;release();};
  document.querySelector('#reset').onclick=()=>reset();document.querySelector('#gaps').onclick=()=>{reset({x:18,z:-16,top:1.8});inspect=false;};
  document.querySelector('#livingGround').onchange=e=>{living=e.target.checked;groundDirty=true;};
  canvas.onclick=()=>{if(!inspect&&avatar.loaded&&!state.locked)canvas.requestPointerLock();};
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('mousedown',e=>{if(!state.locked)return;pointerButtons.add(e.button);if(e.button===0)pressed.attack=true;});
  addEventListener('mouseup',e=>pointerButtons.delete(e.button));
  document.addEventListener('mousemove',e=>{if(state.locked){state.yaw-=e.movementX*.0022;state.pitch=T.MathUtils.clamp(state.pitch-e.movementY*.002,-.85,.6);}else if(inspect&&e.buttons===1)portraitYaw-=e.movementX*.008;});
  addEventListener('keydown',e=>{if(!state.locked)return;keys.add(e.code);if(e.code==='Space'&&!e.repeat)player.jumpBuffer=.15;if(e.code==='KeyR'&&!e.repeat)reset();if(e.code==='KeyF'&&!e.repeat)pressed.dodge=true;if(e.code==='KeyX'&&!e.repeat)pressed.sheathe=true;if(e.code==='KeyJ'&&!e.repeat)pressed.attack=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
  addEventListener('keyup',e=>keys.delete(e.code));
  const resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};addEventListener('resize',resize);resize();
  function combatInput(){
    const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),sd=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    const len=Math.hypot(f,sd)||1,sin=Math.sin(state.yaw),cos=Math.cos(state.yaw);
    const input={attack:pressed.attack,dodge:pressed.dodge,sheathe:pressed.sheathe,block:pointerButtons.has(2)||keys.has('KeyK'),
      moveX:state.locked?(-sin*f+cos*sd)/len:0,moveZ:state.locked?(-cos*f-sin*sd)/len:0,sprinting:keys.has('ShiftLeft')||keys.has('ShiftRight')};
    pressed.attack=pressed.dodge=pressed.sheathe=false;return input;
  }
  window.travelerLab={scene,renderer,camera,player,state,keys,movement,avatar,reset,ground,stepper,renderPosition,surfaces,yard,pressed,pointerButtons,get combat(){return combat;},get combatState(){return combatState;},
    inspect:()=>{inspect=true;document.exitPointerLock();},explore:()=>{inspect=false;},portrait:(yaw,distance=4.2,height=.05,aim=.8)=>{inspect=true;portraitYaw=yaw;portraitDistance=distance;portraitHeight=height;portraitAim=aim;}};
  let last=performance.now(),frameCount=0,frameTime=0,groundRefresh=0;
  function frame(now){
    requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;
    const simDt=hitstop>0?0:dt;hitstop=Math.max(0,hitstop-dt);
    const alpha=stepper.advance(simDt,step=>{
      previous.copy(player.position);groundTime+=step;
      if(combat){combatState=combat.update(step,combatInput(),{grounded:player.grounded,speed:Math.hypot(player.velocity.x,player.velocity.z),yaw:state.yaw,heading:avatar.heading,position:player.position,targets:yard.targets});}
      movement.update(step);
      if(combat)yard.step(step,{player,combat,combatState,toast});
    });
    renderPosition.lerpVectors(previous,player.position,alpha);
    if(inspect){const at=galleryTarget||renderPosition;portraitYaw+=dt*.07;camera.position.set(at.x+Math.sin(portraitYaw)*portraitDistance,at.y+portraitHeight,at.z+Math.cos(portraitYaw)*portraitDistance);camera.lookAt(at.x,at.y-portraitAim,at.z);}
    else view.update(dt);
    gallery.update(dt);
    if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt*.9);}
    yard.render(dt);
    const castAt=keys.has('KeyE')?new T.Vector3(player.position.x,player.position.y,player.position.z-8):null;
    avatar.update(simDt,inspect?4.2:camera.position.distanceTo(renderPosition),castAt,combatState);
    groundRefresh+=dt;
    if(groundRefresh>.1&&(living||groundDirty)){groundRefresh=0;groundDirty=false;for(let i=0;i<groundPositions.count;i++){const x=groundPositions.getX(i),z=groundPositions.getZ(i);if(Math.hypot(x+12,z-8)<7)groundPositions.setY(i,ground(x,z));}groundPositions.needsUpdate=true;groundGeometry.computeVertexNormals();}
    renderer.render(scene,camera);frameCount++;frameTime+=dt;
    if(frameTime>.4){document.querySelector('#pose').textContent=avatar.pose;document.querySelector('#speed').textContent=Math.hypot(player.velocity.x,player.velocity.z).toFixed(1);document.querySelector('#frames').textContent=String(Math.round(frameCount/frameTime));document.querySelector('#hits').textContent=String(yard.hits);frameCount=frameTime=0;}
  }
  // Character gallery: every character in a row at the back of the clearing; orbit one at a time.
  const gallery=createCharacterGallery({scene,ground});let galleryTarget=null,galleryIndex=1;
  const pick=document.querySelector('#galleryPick'),clipPick=document.querySelector('#galleryClip'),facePick=document.querySelector('#galleryFace');
  pick.innerHTML=gallery.items.map((item,i)=>`<option value="${i}">${item.label}</option>`).join('');
  facePick.innerHTML=EXPRESSIONS.map(e=>`<option>${e}</option>`).join('');
  function showCharacter(i){
    galleryIndex=(i+gallery.items.length)%gallery.items.length;const item=gallery.items[galleryIndex];pick.value=String(galleryIndex);
    gallery.build();document.exitPointerLock();inspect=true;release();
    galleryTarget=item.id==='player'?null:gallery.focus(item);portraitDistance=item.distance||4.2;portraitYaw=.5;
    const clips=item.id==='player'?[]:item.clips();clipPick.innerHTML=clips.length?clips.map(c=>`<option>${c}</option>`).join(''):'<option>(idle)</option>';
    clipPick.disabled=!clips.length;facePick.disabled=item.id!=='player'&&!item.setExpression;
  }
  document.querySelector('#galleryOpen').onclick=()=>showCharacter(galleryIndex);
  document.querySelector('#galleryPrev').onclick=()=>showCharacter(galleryIndex-1);
  document.querySelector('#galleryNext').onclick=()=>showCharacter(galleryIndex+1);
  pick.onchange=()=>showCharacter(Number(pick.value));
  clipPick.onfocus=()=>{const item=gallery.items[galleryIndex],clips=item.clips?.()||[];if(clips.length&&clipPick.options.length!==clips.length)clipPick.innerHTML=clips.map(c=>`<option>${c}</option>`).join('');}; // clips arrive once loaded
  clipPick.onchange=()=>gallery.items[galleryIndex].play?.(clipPick.value);
  facePick.onchange=()=>{const item=gallery.items[galleryIndex];if(item.id==='player')avatar.setExpression(facePick.value,1e9);else item.setExpression?.(facePick.value);};
  window.travelerLab.gallery={gallery,show:showCharacter};
  requestAnimationFrame(frame);await avatar.ready;
  if(!avatar.loaded)throw new Error('The traveller asset did not load.');
  combat=createTravelerCombat({rootMotion:avatar.rootMotion,scale:avatar.modelScale});
  explore.disabled=portrait.disabled=false;document.querySelector('#galleryOpen').disabled=false;status.textContent='Ready. Inspect the character, then explore the course.';
}
start().catch(error=>{status.textContent=`Playground could not start: ${error.message}`;console.error(error);});
