import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const source=readFileSync(new URL('../src/models/grimoireJournal.js',import.meta.url),'utf8');
const {grimoireQuests}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const fixture=()=>({quest:{stage:'companion',embers:[{taken:false},{taken:false},{taken:false}],houndCarrying:false},
  spade:{castle:{discovery:{count:0,complete:false}},echo:{recovered:false,progress:0,engaged:false},campaign:{stage:'meet',lit:0,strikes:0}}});
const ARCHIVE=2,WITNESS=3,CROWN=4;
test('grimoire hints follow the hound quest without marking an unfinished cure complete',()=>{
  const {quest,spade}=fixture();
  let tasks=grimoireQuests(quest,spade);assert.equal(tasks.length,7);assert.equal(tasks.some(t=>t.done),false);
  quest.stage='cursed';quest.houndCarrying=true;quest.embers[0].taken=true;
  const hound=grimoireQuests(quest,spade)[0];assert.equal(hound.done,false);assert.match(hound.hint,/calmly/);assert.match(hound.progress,/1\/3/);
  quest.stage='return';quest.embers.forEach(e=>e.taken=true);
  assert.equal(grimoireQuests(quest,spade)[0].done,false);assert.match(grimoireQuests(quest,spade)[0].hint,/offer/);
  quest.stage='cured';assert.equal(grimoireQuests(quest,spade)[0].done,true);assert.equal(grimoireQuests(quest,spade)[0].stamp,'PACT RESTORED');
  assert.equal(grimoireQuests(quest,spade)[0].destination,'spade-refuge');
  assert.match(grimoireQuests(quest,spade)[0].hint,/Neris/);
});
test('the swarm chapter waits for the hound cure',()=>{
  const {quest,spade}=fixture();
  const swarm=()=>grimoireQuests(quest,spade)[1];
  assert.equal(swarm().locked,true);assert.match(swarm().hint,/Ember Hound/);
  quest.stage='cured';
  assert.equal(swarm().locked,false);assert.match(swarm().hint,/Lantern Refuge/);
});
test('the swarm chapter follows the campaign stage and seals only with the Lantern Sigil',()=>{
  const {quest,spade}=fixture();quest.stage='cured';
  const swarm=()=>grimoireQuests(quest,spade)[1];
  assert.equal(swarm().done,false);assert.match(swarm().hint,/Lantern Refuge/);assert.equal(swarm().destination,'spade-refuge');
  Object.assign(spade.campaign,{stage:'lanterns',lit:2});assert.match(swarm().progress,/2\/3/);
  Object.assign(spade.campaign,{stage:'anchor',strikes:1});assert.match(swarm().progress,/1\/3/);assert.equal(swarm().destination,'spade-anchor');
  spade.campaign.stage='report';assert.equal(swarm().done,false);
  spade.campaign.stage='complete';assert.equal(swarm().done,true);
  assert.match(swarm().hint,/castle/);assert.equal(swarm().destination,'spade-castle'); // castle before Clover
  spade.castle.discovery.complete=true;assert.match(swarm().hint,/Clover/);assert.match(grimoireQuests(quest,spade)[CROWN].hint,/Clover/);
});
test('castle quests stay sealed until Neris’s chapter is complete',()=>{
  const {quest,spade}=fixture();
  for(const i of [ARCHIVE,WITNESS,CROWN]){assert.equal(grimoireQuests(quest,spade)[i].locked,true);assert.match(grimoireQuests(quest,spade)[i].hint,/sealed/);}
  spade.campaign.stage='complete';
  assert.equal(grimoireQuests(quest,spade)[ARCHIVE].locked,false);assert.equal(grimoireQuests(quest,spade)[WITNESS].locked,false);
});
test('archive, witness and observatory seals reflect independent actual discoveries',()=>{
  const {quest,spade}=fixture();spade.campaign.stage='complete';
  assert.equal(grimoireQuests(quest,spade)[CROWN].locked,true);
  spade.castle.discovery.count=3;
  let tasks=grimoireQuests(quest,spade);assert.equal(tasks[ARCHIVE].done,true);assert.equal(tasks[WITNESS].done,false);assert.equal(tasks[CROWN].locked,true);
  spade.echo.progress=5;assert.equal(grimoireQuests(quest,spade)[WITNESS].done,false);
  spade.echo.recovered=true;
  tasks=grimoireQuests(quest,spade);assert.equal(tasks[WITNESS].done,true);assert.equal(tasks[CROWN].locked,false);assert.equal(tasks[CROWN].done,false);
  spade.castle.discovery.complete=true;assert.equal(grimoireQuests(quest,spade)[CROWN].done,true);
  spade.echo.recovered=false;spade.echo.progress=0;spade.castle.discovery.count=0;spade.castle.discovery.complete=false;
  assert.equal(grimoireQuests(quest,spade).slice(ARCHIVE).some(t=>t.done),false);
});
test('active parkour hints and completion inscriptions remain useful without future campaign quests',()=>{
  const {quest,spade}=fixture();spade.campaign.stage='complete';spade.echo.engaged=true;spade.echo.objective='Be still on the witness seal.';
  const tasks=grimoireQuests(quest,spade);
  assert.equal(tasks[WITNESS].hint,spade.echo.objective);
  assert.equal(new Set(tasks.map(t=>t.stamp)).size,7);
  assert.ok(tasks.every(t=>['quest','spade-refuge','spade-anchor','spade-castle','clover-archive','clover-scar','clover-sky-chest','diamond-quarry','diamond-row'].includes(t.destination)));
  assert.equal(grimoireQuests(quest,undefined)[CROWN].done,false);
  assert.equal(grimoireQuests(quest,undefined)[1].done,false);
});

test('the existing Living Road entry directs the player from the Scar through the teleporter to the Sky Garden chest',()=>{
  const {quest,spade}=fixture();
  const clover={available:false,generation:0,sigil:false,hook:false};
  const card=()=>grimoireQuests(quest,spade,clover).find(t=>t.id==='living-road');
  assert.equal(card().locked,true);assert.equal(card().done,false);
  clover.available=true;clover.generation=3;
  assert.equal(card().locked,false);assert.equal(card().done,false);assert.equal(card().destination,'clover-scar');
  clover.sigil=true;assert.equal(card().destination,'clover-sky-chest');assert.match(card().hint,/summit/);assert.equal(card().done,false);
  clover.hook=true;assert.equal(card().done,true);assert.match(card().hint,/Heart/);
});

test('Diamond journal follows actual fragment, relay and sigil progress and resets',async()=>{
  const {createDiamondCampaign,socketCenter}=await import('../src/models/diamondCampaign.js');
  const {quest,spade}=fixture();
  let tide=false;
  const diamond=createDiamondCampaign({ready:()=>tide});
  const card=()=>grimoireQuests(quest,spade,undefined,diamond).find(t=>t.id==='unbroken-pattern');
  assert.equal(card().locked,true);assert.match(card().hint,/Tide Sigil/);assert.equal(card().done,false);
  tide=true;
  assert.equal(card().locked,false);assert.match(card().hint,/Orin/);assert.equal(card().destination,'diamond-quarry');
  diamond.update(.1,diamond.layout.orin,0);
  assert.equal(card().destination,'diamond-row');assert.match(card().hint,/four workshops/);
  diamond.update(.1,diamond.layout.fragments[0],0);
  assert.match(card().progress,/1\/4/);
  for(const fragment of diamond.layout.fragments.slice(1))diamond.update(.1,fragment,0);
  assert.match(card().progress,/0\/4/);assert.match(card().hint,/numbers count possible shapes/);
  assert.equal(card().destination,'diamond-quarry');
  for(const [x,y] of [[0,0],[3,3],[1,2],[3,0]])diamond.fit(socketCenter(diamond.layout,x,y),0);
  assert.match(card().progress,/4\/4/);assert.match(card().hint,/Shift/);assert.equal(card().done,false);
  diamond.lift();assert.match(card().progress,/3\/4/);assert.match(card().hint,/press V/);
  diamond.fit(socketCenter(diamond.layout,3,0),0);
  diamond.update(.1,diamond.layout.center,.8);
  assert.equal(diamond.stage,'report');assert.equal(card().done,false);assert.match(card().hint,/return to Orin/);
  diamond.update(.1,diamond.layout.orin,0);
  assert.equal(card().done,true);assert.equal(card().stamp,'PRISM SIGIL');
  assert.equal(card().destination,'spade-castle');assert.match(card().hint,/all four sigils/);
  diamond.reset();assert.equal(card().done,false);assert.match(card().hint,/Orin/);
  tide=false;assert.equal(card().locked,true);
});

test('Diamond journal explains recovery from a jam without granting completion',()=>{
  const {quest,spade}=fixture();
  const diamond={stage:'repair',available:true,collected:4,fitted:4,jammed:true};
  const card=grimoireQuests(quest,spade,undefined,diamond).find(t=>t.id==='unbroken-pattern');
  assert.equal(card.done,false);assert.equal(card.locked,false);
  assert.match(card.progress,/jammed/);assert.match(card.hint,/X to lift/);assert.match(card.hint,/V to refit/);
});
