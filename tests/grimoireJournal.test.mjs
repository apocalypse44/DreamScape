import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const source=readFileSync(new URL('../src/models/grimoireJournal.js',import.meta.url),'utf8');
const {grimoireQuests}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const fixture=()=>({quest:{stage:'companion',embers:[{taken:false},{taken:false},{taken:false}],houndCarrying:false},
  spade:{castle:{discovery:{count:0,complete:false}},echo:{recovered:false,progress:0,engaged:false}}});
test('grimoire hints follow the hound quest without marking an unfinished cure complete',()=>{
  const {quest,spade}=fixture();
  let tasks=grimoireQuests(quest,spade);assert.equal(tasks.length,4);assert.equal(tasks.some(t=>t.done),false);
  quest.stage='cursed';quest.houndCarrying=true;quest.embers[0].taken=true;
  const hound=grimoireQuests(quest,spade)[0];assert.equal(hound.done,false);assert.match(hound.hint,/calmly/);assert.match(hound.progress,/1\/3/);
  quest.stage='return';quest.embers.forEach(e=>e.taken=true);
  assert.equal(grimoireQuests(quest,spade)[0].done,false);assert.match(grimoireQuests(quest,spade)[0].hint,/offer/);
  quest.stage='cured';assert.equal(grimoireQuests(quest,spade)[0].done,true);assert.equal(grimoireQuests(quest,spade)[0].stamp,'PACT RESTORED');
  assert.equal(grimoireQuests(quest,spade)[0].destination,'spade-refuge');
  assert.match(grimoireQuests(quest,spade)[0].hint,/Neris/);
});
test('archive, witness and observatory seals reflect independent actual discoveries',()=>{
  const {quest,spade}=fixture();
  assert.equal(grimoireQuests(quest,spade)[3].locked,true);
  spade.castle.discovery.count=3;
  let tasks=grimoireQuests(quest,spade);assert.equal(tasks[1].done,true);assert.equal(tasks[2].done,false);assert.equal(tasks[3].locked,true);
  spade.echo.progress=5;assert.equal(grimoireQuests(quest,spade)[2].done,false);
  spade.echo.recovered=true;
  tasks=grimoireQuests(quest,spade);assert.equal(tasks[2].done,true);assert.equal(tasks[3].locked,false);assert.equal(tasks[3].done,false);
  spade.castle.discovery.complete=true;assert.equal(grimoireQuests(quest,spade)[3].done,true);
  spade.echo.recovered=false;spade.echo.progress=0;spade.castle.discovery.count=0;spade.castle.discovery.complete=false;
  assert.equal(grimoireQuests(quest,spade).some(t=>t.done),false);
});
test('active parkour hints and completion inscriptions remain useful without future campaign quests',()=>{
  const {quest,spade}=fixture();spade.echo.engaged=true;spade.echo.objective='Be still on the witness seal.';
  const tasks=grimoireQuests(quest,spade);
  assert.equal(tasks[2].hint,spade.echo.objective);
  assert.equal(new Set(tasks.map(t=>t.stamp)).size,4);
  assert.ok(tasks.every(t=>t.destination==='quest'||t.destination==='spade-castle'));
  assert.equal(grimoireQuests(quest,undefined)[3].done,false);
});
