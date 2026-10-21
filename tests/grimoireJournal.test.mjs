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
  let tasks=grimoireQuests(quest,spade);assert.equal(tasks.length,5);assert.equal(tasks.some(t=>t.done),false);
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
  assert.equal(new Set(tasks.map(t=>t.stamp)).size,5);
  assert.ok(tasks.every(t=>['quest','spade-refuge','spade-anchor','spade-castle'].includes(t.destination)));
  assert.equal(grimoireQuests(quest,undefined)[CROWN].done,false);
  assert.equal(grimoireQuests(quest,undefined)[1].done,false);
});
