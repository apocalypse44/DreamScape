import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const cache=new Map();
function moduleUrl(file){if(!cache.has(file.href)){const s=readFileSync(file,'utf8').replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,p)=>`from ${q}${moduleUrl(new URL(p,file))}${q}`);cache.set(file.href,`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`);}return cache.get(file.href);}
const load=path=>import(moduleUrl(new URL(path,import.meta.url)));
const {createFixedStepper}=await load('../src/models/fixedStep.js');
const {createTravelerMotion}=await load('../src/models/travelerMotion.js');
const {createPlayerController}=await load('../src/controllers/player.js');

test('fixed movement advances equally at 30, 60, 120 and 144 rendered frames per second',()=>{
  for(const fps of [30,60,120,144]){let steps=0,time=0;const clock=createFixedStepper();for(let i=0;i<fps*2;i++){const alpha=clock.advance(1/fps,dt=>{steps++;time+=dt;});assert.ok(alpha>=0&&alpha<=1);}assert.equal(steps,120);assert.ok(Math.abs(time-2)<1e-8);}
});
test('fixed clock bounds catch-up and handles reset, invalid deltas and hidden-tab stalls',()=>{
  const clock=createFixedStepper();let steps=0;clock.advance(30,()=>steps++);assert.equal(steps,8);
  clock.advance(NaN,()=>assert.fail());clock.advance(-1,()=>assert.fail());clock.advance(.005,()=>steps++);clock.reset();
  assert.equal(clock.advance(0,()=>assert.fail()),0);
  assert.throws(()=>createFixedStepper({step:0}));assert.throws(()=>createFixedStepper({maxSteps:0}));
});
test('traveller transitions through takeoff, fall, land and locomotion without losing normalized weights',()=>{
  const motion=createTravelerMotion();
  const sample=(dt,props)=>{const result=motion.update(dt,{speed:0,grounded:true,...props});const sum=Object.values(result.weights).reduce((a,b)=>a+b,0);assert.ok(Math.abs(sum-1)<1e-8);return result;};
  assert.equal(sample(1/60,{}).name,'idle');
  assert.equal(sample(1/60,{speed:1}).name,'walking');assert.equal(sample(1/60,{speed:4.2}).name,'jogging');assert.equal(sample(1/60,{speed:7.8}).name,'running');
  assert.equal(sample(1/60,{grounded:false,verticalSpeed:10}).takeoff,true);
  assert.equal(sample(.1,{grounded:false,verticalSpeed:-1}).name,'falling');
  const landed=sample(1/60,{});assert.equal(landed.name,'landing');assert.equal(landed.landed,true);
  for(let i=0;i<30;i++)sample(1/60,{});assert.equal(sample(1/60,{crouching:true}).name,'crouching');
  assert.equal(sample(1/60,{casting:true}).name,'casting');motion.reset();assert.equal(sample(1/60,{}).name,'idle');
});
class Vector{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){Object.assign(this,{x,y,z});return this;}}
globalThis.THREE={MathUtils:{clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
function fixture(){const state={locked:true,chaos:.06,yaw:0,lastMoveAngle:0,hintTimer:0},keys=new Set(),player={position:new Vector(0,2.05,0),velocity:new Vector(),grounded:true};
 const movement=createPlayerController({state,keys,player,chunks:new Map(),terrainHeight:()=>0,staticColliders:[],platforms:[],locomotion:{walkSpeed:4.2,sprintSpeed:7.8,crouchSpeed:2,smooth:true,variableJump:true}});movement.reset();return{state,keys,player,movement};}
test('prototype locomotion accelerates, brakes, respects sprint speed and stops immediately when unlocked',()=>{
 const f=fixture();f.keys.add('KeyW');for(let i=0;i<120;i++)f.movement.update(1/60);assert.ok(Math.abs(-f.player.velocity.z-4.2)<.01);
 f.keys.add('ShiftLeft');for(let i=0;i<120;i++)f.movement.update(1/60);assert.ok(Math.abs(-f.player.velocity.z-7.8)<.01);
 f.keys.clear();f.movement.update(1/60);assert.ok(-f.player.velocity.z>0&&-f.player.velocity.z<7.8);
 f.state.locked=false;f.movement.update(1/60);assert.equal(f.player.velocity.z,0);
});
test('releasing jump early creates a lower arc and teleport clears buffered movement',()=>{
 function jump(releaseAt){const f=fixture();f.keys.add('Space');f.player.jumpBuffer=.15;let top=0;for(let i=0;i<100;i++){if(i===releaseAt)f.keys.delete('Space');f.movement.update(1/120);top=Math.max(top,f.player.position.y-2.05);}return top;}
 assert.ok(jump(100)>jump(4)+.7);
 const f=fixture();f.player.jumpBuffer=.15;f.player.velocity.z=7;f.movement.teleport({x:3,z:2,top:1});assert.equal(f.player.jumpBuffer,0);assert.equal(f.player.velocity.z,0);assert.equal(f.player.jumpCut,false);
});
test('included traveller asset is a compact GLB: body + sword, cape springs, sockets, combat clips, no textures',()=>{
 const bytes=readFileSync(new URL('../src/assets/traveler.glb',import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 assert.equal(json.meshes.length,3);assert.deepEqual(json.nodes.filter(n=>n.mesh!=null).map(n=>n.name).sort(),['Traveler','TravelerFace','TravelerSword']);assert.equal(json.images?.length||0,0);
 for(const mesh of json.meshes.filter(m=>m.primitives.length>1))assert.deepEqual(mesh.primitives.map(p=>json.materials[p.material].name),['TravelerPalette','TravelerGlow']);
 // The face shell: UV-mapped (the runtime paints expressions on it) and parented under the head.
 const face=json.meshes[json.nodes.find(n=>n.name==='TravelerFace').mesh].primitives[0];assert.ok(face.attributes.TEXCOORD_0!=null);assert.equal(json.materials[face.material].name,'TravelerFace');
 const names=new Set(json.nodes.map(n=>n.name));for(const n of ['socket_hand_r','socket_back','socket_face','cape_1','cape_2','cape_3'])assert.ok(names.has(n),n);
 for(const name of ['idle','walk','jog','run','jumpStart','fall','land','cast','crouchWalk','combatIdle','slash1','slash2','slash3','slash1End','slash2End','block','roll','dash','hit','knockback'])assert.ok(json.animations.some(a=>a.name===name),name);
 // Only rotations, pelvis/root translation: constant scale/translation tracks are stripped.
 for(const a of json.animations)for(const c of a.channels){const node=json.nodes[c.target.node].name;assert.notEqual(c.target.path,'scale');if(c.target.path==='translation')assert.ok(['root','pelvis'].includes(node),`${a.name}:${node}`);}
 const motion=json.nodes.find(n=>n.extras?.rootMotion)?.extras.rootMotion;assert.ok(motion?.slash1?.z.length>5&&motion.knockback.z.at(-1)<0);
 assert.ok(bytes.length<3.5*1024*1024);assert.ok(json.skins[0].joints.length>60);
});
const {createTravelerCombat,COMBAT_MOVES}=await load('../src/models/travelerCombat.js');
function duel(){const combat=createTravelerCombat({rootMotion:{slash1:{rate:30,z:Array.from({length:14},(_,i)=>i*.06)},knockback:{rate:30,z:Array.from({length:26},(_,i)=>-i*.12)}}});
 const ctx={grounded:true,speed:0,yaw:0,heading:Math.PI,position:{x:0,z:0},targets:[]};
 const run=(seconds,input={},each)=>{let s;for(let t=0;t<seconds-1e-9;t+=1/60){s=combat.update(1/60,input,ctx);input={...input,attack:false,dodge:false,sheathe:false};each?.(s);}return s;};return{combat,ctx,run};}
test('three buffered presses chain slash1 > slash2 > slash3; a lone press recovers to locomotion',()=>{
 const {run}=duel();const seen=[];let s=run(1/60,{attack:true});assert.equal(s.move,'slash1');assert.equal(s.drawn,true);
 run(.2,{},x=>seen.push(x.move));s=run(1/60,{attack:true});run(.6,{},x=>seen.push(x.move));s=run(1/60,{attack:true});run(.6,{},x=>seen.push(x.move));
 assert.ok(seen.includes('slash2')&&seen.includes('slash3'));
 const solo=duel();solo.run(1/60,{attack:true});const moves=[];solo.run(1.4,{},x=>moves.push(x.move));assert.ok(moves.includes('slash1End'));assert.equal(moves.at(-1),null);
});
test('hit frames open only inside the measured window and carry a unique swing id',()=>{
 const {run}=duel();const frames=[];run(1/60,{attack:true});run(.4,{},s=>{if(s.hit)frames.push(s.hit.id);});
 assert.ok(frames.length>3&&frames.length<16);assert.equal(new Set(frames).size,1);
});
test('attacks drive the body along baked root motion and freeze stick input',()=>{
 const {run}=duel();const s=run(.15,{attack:true});assert.equal(s.drive.moveScale,0);assert.ok(Math.hypot(s.drive.velocity.x,s.drive.velocity.z)>1);
 assert.ok(Math.abs(Math.hypot(s.drive.velocity.x,s.drive.velocity.z)-.06*30*COMBAT_MOVES.slash1.speed)<1e-6);
});
test('roll travels its distance with invulnerability, then blocks and blows resolve by facing',()=>{
 const {combat,ctx,run}=duel();let distance=0,inv=false;run(2,{dodge:true,moveZ:-1},s=>{if(s.drive)distance+=Math.hypot(s.drive.velocity.x,s.drive.velocity.z)/60;inv||=s.invulnerable;});
 assert.ok(Math.abs(distance-COMBAT_MOVES.roll.distance)<.25);assert.ok(inv);
 const guard=duel();guard.run(.3,{block:true}); // facing -z (heading pi)
 assert.equal(guard.combat.hurt({x:0,z:-3},{x:0,z:0}),'blocked');assert.equal(guard.combat.hurt({x:0,z:3},{x:0,z:0}),'hit');
 const s=guard.run(1/60);assert.equal(s.move,'hit');
 const rolling=duel();rolling.run(.2,{dodge:true});assert.equal(rolling.combat.hurt({x:0,z:2},{x:0,z:0}),'dodged');
});
test('sword sheathes itself after a quiet spell and on request',()=>{
 const {run}=duel();run(1/60,{attack:true});run(3);assert.equal(run(1/60).drawn,true);run(7);assert.equal(run(1/60).drawn,false);
 assert.equal(run(1/60,{sheathe:true}).drawn,true);assert.equal(run(1/60,{sheathe:true}).drawn,false);
});
test('controller follows a combat drive and suppresses jumping while acting',()=>{
 const f=fixture();let drive={velocity:{x:3,z:-1},moveScale:0,blockJump:true};f.movement.reset();
 const movement=createPlayerController({state:f.state,keys:f.keys,player:f.player,chunks:new Map(),terrainHeight:()=>0,staticColliders:[],platforms:[],locomotion:{walkSpeed:4.2,sprintSpeed:7.8,smooth:true,drive:()=>drive}});
 f.keys.add('KeyA');f.player.jumpBuffer=.15;movement.update(1/60);assert.equal(f.player.velocity.x,3);assert.equal(f.player.velocity.z,-1);assert.equal(f.player.jumpBuffer,0);
 drive=null;for(let i=0;i<60;i++)movement.update(1/60);assert.ok(f.player.velocity.x< -4);
});
test('swarm gestures clear when released: no clip keeps weight after Q or F (castShoot used to stick)',()=>{
 const motion=createTravelerMotion();
 for(const casting of ['push','recall','attract','push']){
  const held=motion.update(1/60,{speed:0,grounded:true,casting});assert.equal(Object.values(held.weights).reduce((a,b)=>a+b,0),1);
  const free=motion.update(1/60,{speed:0,grounded:true,casting:false});
  for(const [clip,w] of Object.entries(free.weights))assert.equal(w,clip==='idle'?1:0,`${clip} after releasing ${casting}`);
 }
});

test('air slashes start while jumping or swinging, never steer the body, chain, and end on landing', () => {
 const { combat, ctx, run } = duel(); ctx.grounded = false;
 let s = run(1 / 60, { attack: true }); assert.equal(s.move, 'airSlash'); assert.equal(s.clip, 'slash1'); assert.equal(s.air, true);
 assert.equal(s.drive, null, 'gravity and the grapple keep moving you');
 let hit = false, trail = false; run(.25, {}, x => { hit ||= Boolean(x.hit); trail ||= x.trail; }); assert.ok(hit && trail);
 s = run(1 / 60, { attack: true }); run(.05); assert.equal(combat.move, 'airSlash2'); assert.equal(combat.snapshot().clip, 'slash2');
 ctx.grounded = true; run(.4); assert.equal(combat.move, null, 'landing returns to the ground moveset');
 const ground = duel(); assert.equal(ground.run(1 / 60, { attack: true }).move, 'slash1', 'on the ground the normal combo starts');
});
