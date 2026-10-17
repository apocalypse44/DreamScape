// Grimoire Atlas: the world map (M, or the map button top right). Styled as a page of a Black Clover
// grimoire: dark leather, gold ink, a five-leaf clover seal and the four kingdoms by their suits.
//
// The base layer is generated from the terrain itself: the calm height field is sampled once on a
// grid, hill-shaded with a light from the north-west (Lambert term of the finite-difference normal),
// tinted by kingdom, and given contour lines every 2.5 m. Landmarks, embers, the hound, the quest
// route and the player are drawn on top while the map is open.
import { WATERFALL } from '../models/waterfall.js';
import { RIDGE } from '../models/ridge.js';
import { CLOVER_ENTRANCE } from '../models/cloverTerrain.js';
import { SKY, SUMMIT_DOOR } from '../models/skyIsland.js';
import { SHRINE } from '../models/quest.js';
import { SPADE_MAP_LOCATIONS } from '../models/spadeStory.js';
import { grimoireQuests } from '../models/grimoireJournal.js';

const CENTER = { x: 0, z: -90 }; // shifted north so the Clover terraces and Sky Garden fit
const HALF = 650;                // metres from the centre to the map edge
const RES = 320;                 // relief samples per side
const CALM = 0.06;
const GOLD = '#d8b25a';
const KINGDOMS = [
  { name: 'CLOVER KINGDOM', suit: '♣', color: '#8fe36b', angle: -Math.PI / 2 - 0.5 }, // off-axis: the Clover landmarks sit due north
  { name: 'HEART KINGDOM', suit: '♥', color: '#ff6b6b', angle: 0 },
  { name: 'DIAMOND KINGDOM', suit: '♦', color: '#ffd36b', angle: Math.PI / 2 },
  { name: 'SPADE KINGDOM', suit: '♠', color: '#b9a6ff', angle: Math.PI },
];
const LANDMARKS = [
  { name: 'GRIMOIRE TOWER', note: 'Shrine', x: SHRINE.x, z: SHRINE.z, side: 1 },
  { name: 'GRIMOIRE FALLS', x: WATERFALL.x, z: WATERFALL.z, side: -1 },
  { name: 'GRIMOIRE RIDGE', x: RIDGE.x, z: RIDGE.z, side: 1 },
  { name: 'CLOVER TERRACES', x: CLOVER_ENTRANCE.x, z: CLOVER_ENTRANCE.z, side: 1 },
  { name: 'CLOVER SUMMIT', note: 'Sky gateway', x: SUMMIT_DOOR.x, z: SUMMIT_DOOR.z, side: -1 },
  { name: 'SKY GARDEN', note: 'Heavenly Falls below', x: SKY.x, z: SKY.z, side: 1, floating: true },
  ...SPADE_MAP_LOCATIONS.map(p=>({...p,side:1,color:'#c5afff',callout:true})),
];

const CSS = `
#mapButton { position: fixed; z-index: 6; top: 16px; right: 3vw; width: 38px; height: 38px; padding: 0;
  display: grid; place-items: center; border: 1px solid rgba(216,178,90,.7); border-radius: 50%;
  background: rgba(14,12,8,.7); color: ${GOLD}; cursor: pointer; transition: .2s; }
#mapButton:hover, #mapButton:focus-visible { background: rgba(216,178,90,.18); box-shadow: 0 0 18px rgba(216,178,90,.35); outline: none; }
#mapButton svg { width: 22px; height: 22px; }
#mapButton kbd { position: absolute; right: -4px; bottom: -4px; padding: 1px 4px; border-radius: 3px;
  background: ${GOLD}; color: #16120a; font: 700 8px 'DM Mono', monospace; }
.hud-top .world-state { margin-right: 54px; }
#resumeHint { position: fixed; z-index: 29; left: 50%; top: 50%; transform: translate(-50%, -50%); display: none;
  padding: 14px 22px; border: 1px solid rgba(216,178,90,.7); border-radius: 4px; background: rgba(14,12,8,.82);
  color: ${GOLD}; font: 600 11px 'DM Mono', monospace; letter-spacing: .2em; cursor: pointer; }
#resumeHint.on { display: block; }
#worldMap { position: fixed; inset: 0; z-index: 30; display: none; place-items: center;
  background: radial-gradient(circle at center, rgba(20,16,8,.55), rgba(3,5,4,.88)); backdrop-filter: blur(6px); }
#worldMap.open { display: grid; }
#worldMap .atlas { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 18px 22px 16px;
  border: 1px solid rgba(216,178,90,.55); border-radius: 6px;
  background: linear-gradient(160deg, #1c1710, #0e0c08 60%, #18130b);
  box-shadow: 0 0 0 6px #0b0906, 0 0 0 7px rgba(216,178,90,.35), 0 30px 80px rgba(0,0,0,.7); }
#worldMap header { display: flex; align-items: center; gap: 12px; color: ${GOLD}; }
#worldMap header h2 { margin: 0; font: 400 22px Georgia, serif; letter-spacing: .28em; }
#worldMap header small { display: block; margin-top: 3px; color: rgba(216,178,90,.6); font: 9px 'DM Mono', monospace; letter-spacing: .2em; }
#worldMap header button { margin-left: auto; width: 30px; height: 30px; border: 1px solid rgba(216,178,90,.5); border-radius: 50%;
  background: none; color: ${GOLD}; font: 16px Georgia, serif; cursor: pointer; }
#worldMap header button:hover { background: rgba(216,178,90,.15); }
#worldMap canvas { display: block; border: 1px solid rgba(216,178,90,.45); border-radius: 3px; }
#worldMap .spade-destinations { display:flex;flex-wrap:wrap;gap:6px; }
#worldMap .spade-destinations button { background:#191426;border:1px solid #746386;color:#e2d4ff;padding:7px 9px;cursor:pointer;font:10px 'DM Mono',monospace; }
#worldMap .spade-destinations button:focus-visible,#worldMap .spade-destinations button[aria-pressed="true"] { outline:2px solid #c5afff;outline-offset:1px; }
#worldMap .map-location-detail { max-width:860px;margin:0;color:#dbd2bf;font:11px/1.5 'DM Mono',monospace;min-height:3em; }
#worldMap footer { display: flex; flex-wrap: wrap; gap: 16px; color: rgba(240,230,200,.75); font: 9px 'DM Mono', monospace; letter-spacing: .12em; }
#worldMap footer i { display: inline-block; width: 9px; height: 9px; margin-right: 6px; vertical-align: -1px; border-radius: 50%; }
#worldMap footer .hint { margin-left: auto; color: rgba(216,178,90,.6); }`;

// Five-leaf clover seal: five heart-shaped leaves rotated 72° apart.
function drawClover(ctx, x, y, size, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * 2 * Math.PI) / 5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * 0.55, -size * 0.35, -size * 0.55, -size * 1.05, 0, -size * 0.78);
    ctx.bezierCurveTo(size * 0.55, -size * 1.05, size * 0.55, -size * 0.35, 0, 0);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
  ctx.restore();
}

// canvas: the game's canvas, used to free and recapture the mouse around the map.
export function createWorldMap({ world, player, state, quest, spade, companion, navigation, gates = [], canvas: gameCanvas }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  // Baseline atlas rules precede the responsive grimoire stylesheet.
  document.head.prepend(style);

  const button = document.createElement('button');
  button.id = 'mapButton';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open the world map (M)');
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg><kbd>M</kbd>';
  document.body.appendChild(button);

  const overlay = document.createElement('div');
  overlay.id = 'worldMap';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'World map');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert=true;
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls','worldMap');
  overlay.innerHTML = `<div class="atlas">
    <header><canvas class="seal" width="44" height="44" aria-hidden="true" style="border:0"></canvas>
      <div><h2>GRIMOIRE ATLAS</h2><small>THE FOUR KINGDOMS · SEED DS-${world.seed}</small></div>
      <button type="button" aria-label="Close map">✕</button></header>
    <div class="book-spread"><section class="map-page" aria-label="World atlas">
    <p class="page-kicker">I · THE KNOWN WORLD</p><div class="map-frame"><canvas class="map" aria-label="Map of the four kingdoms"></canvas></div><p class="map-loading" role="status">The atlas is tracing the land…</p>
    <nav class="spade-destinations" aria-label="Spade destinations">${SPADE_MAP_LOCATIONS.map(p=>`<button type="button" data-spade="${p.id}" aria-pressed="false">${p.name}</button>`).join('')}<button type="button" data-quest-route>QUEST ROUTE</button></nav>
    <p class="map-location-detail" aria-live="polite">Choose a Spade location to show its route and directions.</p>
    <button type="button" class="page-turn" data-book-page="quests" aria-label="Open the grimoire to your quests">OPEN QUESTS <span aria-hidden="true">➜</span></button>
    <footer><span><i style="background:${GOLD}"></i>LANDMARK</span><span><i style="background:#ff8a2a"></i>EMBER</span>
      <span><i style="background:#ff4a3a"></i>HOUND</span><span><i style="background:#2f9bff"></i>ROUTE</span>
      <span><i style="background:#fff"></i>YOU</span><span>⌂ GATE</span></footer></section>
    <section class="quest-page" aria-labelledby="grimoireQuestHeading" inert><button type="button" class="page-turn" data-book-page="atlas" aria-label="Close the grimoire to the world map"><span aria-hidden="true">←</span> WORLD MAP</button><p class="page-kicker">II · YOUR UNWRITTEN STORY</p><h3 id="grimoireQuestHeading">Oaths &amp; Echoes</h3><p class="quest-intro">Explore in stillness. Discover in chaos.</p><p class="journal-summary" role="status"></p><div class="quest-list"></div><p class="quest-colophon">Every fulfilled oath leaves its seal upon the grimoire.</p></section></div>
    <div class="book-bottom"><span>THE FOURFOLD GRIMOIRE</span><span>M / ESC · CLOSE THE BOOK</span></div>
    </div>`;
  overlay.dataset.page='atlas';
  document.body.appendChild(overlay);
  const resumeHint = document.createElement('button');
  resumeHint.id = 'resumeHint';
  resumeHint.type = 'button';
  resumeHint.textContent = 'CLICK TO RESUME';
  document.body.appendChild(resumeHint);
  const resume = () => { resumeHint.classList.remove('on'); gameCanvas?.requestPointerLock(); };
  resumeHint.addEventListener('click', resume);
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) resumeHint.classList.remove('on'); });
  const canvas = overlay.querySelector('canvas.map');
  const ctx = canvas.getContext('2d');
  const sealCanvas = overlay.querySelector('canvas.seal');
  drawClover(sealCanvas.getContext('2d'), 22, 24, 21, '#0b0a07', GOLD);

  let open = false, relief = null, size = 0, lastDraw = 0, reliefBuilding=false;
  let closeTimer=null,returnFocus=button,questSignature='';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const questList=overlay.querySelector('.quest-list'),questCards=new Map();
  function updateQuests(){
    const tasks=grimoireQuests(quest,spade),signature=JSON.stringify(tasks);
    if(signature===questSignature)return;
    questSignature=signature;
    overlay.querySelector('.journal-summary').textContent=`${tasks.filter(t=>t.done).length} / ${tasks.length} OATHS SEALED`;
    for(const task of tasks){
      let card=questCards.get(task.id);
      if(!card){
        card=document.createElement('article');card.className='quest-card';card.dataset.quest=task.id;
        card.innerHTML='<span class="quest-chapter"></span><h4></h4><p class="quest-progress"></p><p class="quest-hint"></p><button type="button" class="quest-route"></button><span class="quest-state"></span><span class="completion-seal"><canvas width="72" height="72" aria-hidden="true"></canvas><span></span></span>';
        drawClover(card.querySelector('canvas').getContext('2d'),36,37,28,'#829052','#315d43');
        questCards.set(task.id,card);questList.appendChild(card);
      }
      card.dataset.status=task.done?'complete':task.locked?'locked':'active';
      card.querySelector('.quest-chapter').textContent=task.chapter;
      card.querySelector('h4').textContent=task.title;
      card.querySelector('.quest-progress').textContent=task.progress;
      card.querySelector('.quest-hint').textContent=task.hint;
      card.querySelector('.quest-state').textContent=task.done?'OATH FULFILLED':task.locked?'AWAITING REVELATION':'UNSEALED';
      card.querySelector('.completion-seal span').textContent=task.stamp;
      const route=card.querySelector('.quest-route');route.dataset.journalRoute=task.destination;
      route.textContent=task.destination==='quest'?'FOLLOW THE EMBER QUEST':'MARK CASTLE ENTRANCE';
    }
  }
  function setPage(page){
    overlay.dataset.page=page;
    overlay.querySelector('.map-page').inert=page!=='atlas';
    overlay.querySelector('.quest-page').inert=page!=='quests';
    if(page==='atlas'){resize();draw(performance.now()/1000);}
    overlay.querySelector(`[data-book-page="${page==='atlas'?'quests':'atlas'}"]`).focus({preventScroll:true});
  }
  overlay.addEventListener('click',event=>{
    const tab=event.target.closest('[data-book-page]');if(tab)setPage(tab.dataset.bookPage);
  });
  questList.addEventListener('click',event=>{
    const route=event.target.closest('[data-journal-route]');if(!route)return;
    const target=route.dataset.journalRoute==='quest'?overlay.querySelector('[data-quest-route]')
      :overlay.querySelector(`[data-spade="${route.dataset.journalRoute}"]`);
    target?.click();setPage('atlas');
  });
  let selected=null;
  const locationDetail=overlay.querySelector('.map-location-detail');
  overlay.querySelector('.spade-destinations').addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.hasAttribute('data-quest-route')){
      selected=null;navigation.clearDestination?.();locationDetail.textContent='Quest navigation restored.';
    }else{
      selected=SPADE_MAP_LOCATIONS.find(p=>p.id===target.dataset.spade);if(!selected)return;
      navigation.setDestination?.({...selected.destination,id:selected.id});
      locationDetail.textContent=`${selected.name} · X ${Math.round(selected.x)} / Z ${selected.z}. ${selected.directions}`;
    }
    overlay.querySelectorAll('[data-spade]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spade===selected?.id)));
    draw(performance.now()/1000);
  });

  // Relief layer: generated once from the calm height field
  async function buildRelief() {
    if(relief||reliefBuilding)return;
    reliefBuilding=true;
    const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    await nextFrame();
    let deadline=performance.now()+3;
    const cell = (HALF * 2) / RES;
    const heights = new Float32Array(RES * RES);
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
      heights[j * RES + i] = world.heightAt(CENTER.x - HALF + (i + 0.5) * cell, CENTER.z - HALF + (j + 0.5) * cell, CALM);
      }
      if(performance.now()>=deadline){await nextFrame();deadline=performance.now()+3;}
    }
    const image = new ImageData(RES, RES);
    const light = [-0.55, 0.7, -0.45]; // from the north-west, above (x, y, z)
    const ll = Math.hypot(...light);
    const tint = new THREE.Color(), paper = new THREE.Color(0x2b2416);
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
      const h = heights[j * RES + i];
      const hx = heights[j * RES + Math.min(RES - 1, i + 1)] - heights[j * RES + Math.max(0, i - 1)];
      const hz = heights[Math.min(RES - 1, j + 1) * RES + i] - heights[Math.max(0, j - 1) * RES + i];
      // Normal of a height field: (-dh/dx, 1, -dh/dz), with differences over 2 cells.
      const nx = -hx / (2 * cell), nz = -hz / (2 * cell), nl = Math.hypot(nx, 1, nz);
      const lambert = Math.max(0, (nx * light[0] + light[1] + nz * light[2]) / (nl * ll));
      const x = CENTER.x - HALF + (i + 0.5) * cell, z = CENTER.z - HALF + (j + 0.5) * cell;
      tint.set(world.biomeAt(x, z).ground).lerp(paper, 0.35);
      const shade = 0.45 + 0.75 * lambert + Math.max(0, h) * 0.012;
      // Contour every 2.5 m: darken where the band index changes toward the right or bottom neighbour.
      const band = Math.floor(h / 2.5);
      const contour = (i < RES - 1 && Math.floor(heights[j * RES + i + 1] / 2.5) !== band) ||
        (j < RES - 1 && Math.floor(heights[(j + 1) * RES + i] / 2.5) !== band);
      const k = shade * (contour ? 0.72 : 1);
      const o = (j * RES + i) * 4;
      image.data[o] = Math.min(255, tint.r * 255 * k);
      image.data[o + 1] = Math.min(255, tint.g * 255 * k);
      image.data[o + 2] = Math.min(255, tint.b * 255 * k);
      image.data[o + 3] = 255;
      }
      if(performance.now()>=deadline){await nextFrame();deadline=performance.now()+3;}
    }
    relief = document.createElement('canvas');
    relief.width = relief.height = RES;
    relief.getContext('2d').putImageData(image, 0, 0);
    reliefBuilding=false;
    overlay.querySelector('.map-loading').hidden=true;
    if(open)draw(performance.now()/1000);
  }

  // Drawing
  const toMap = (x, z) => [((x - CENTER.x + HALF) / (2 * HALF)) * size, ((z - CENTER.z + HALF) / (2 * HALF)) * size];

  function resize() {
    const frame=overlay.querySelector('.map-frame');
    const css=Math.max(1,Math.floor(Math.min(frame.clientWidth,frame.clientHeight)));
    const dpr = Math.min(devicePixelRatio, 2);
    if(canvas.width===Math.round(css*dpr)&&canvas.style.width===`${css}px`)return;
    canvas.style.width = canvas.style.height = `${css}px`;
    canvas.width = canvas.height = Math.round(css * dpr);
    size = canvas.width;
  }

  function label(text, x, y, { font, color, align = 'center', stroke = 'rgba(8,6,3,.85)' }) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.006;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function draw(time) {
    const u = size / 1000; // drawing unit
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    if(relief)ctx.drawImage(relief, 0, 0, size, size);
    else {ctx.fillStyle='#211d13';ctx.fillRect(0,0,size,size);}

    // Vignette: the page darkens toward its edges.
    const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(8,5,2,.65)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    // Kingdom border (350 m ring) and the diagonal frontiers beyond it.
    const [cx, cy] = toMap(0, 0);
    const ring = (world.kingdomStart / (2 * HALF)) * size;
    ctx.save();
    ctx.strokeStyle = 'rgba(216,178,90,.85)';
    ctx.lineWidth = 2.2 * u;
    ctx.setLineDash([10 * u, 7 * u]);
    ctx.beginPath();
    ctx.arc(cx, cy, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([4 * u, 8 * u]);
    ctx.lineWidth = 1.4 * u;
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring);
      ctx.lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size);
      ctx.stroke();
    }
    ctx.restore();

    // Kingdom names with their suits, just outside the border.
    for (const k of KINGDOMS) {
      const r = ring + 95 * u;
      const x = cx + Math.cos(k.angle) * r, y = cy + Math.sin(k.angle) * r;
      if (x < 40 * u || x > size - 40 * u || y < 30 * u || y > size - 30 * u) continue;
      label(k.suit, x, y - 24 * u, { font: `${46 * u}px Georgia, serif`, color: k.color });
      label(k.name, x, y + 14 * u, { font: `bold ${21 * u}px Georgia, serif`, color: k.color });
    }

    // Kingdom gates: a small arch in the kingdom's colour where each trail enters its kingdom.
    for (const g of gates) {
      const [x, y] = toMap(g.x, g.z);
      const colour = world.biomeAt(g.x * 1.06, g.z * 1.06).banner;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(g.x, -g.z)); // arch opens toward the tower
      ctx.lineWidth = 3.5 * u;
      ctx.strokeStyle = '#0f0c07';
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(-9 * u, 6 * u); ctx.lineTo(-9 * u, -2 * u); ctx.arc(0, -2 * u, 9 * u, Math.PI, 0); ctx.lineTo(9 * u, 6 * u);
      ctx.lineTo(5 * u, 6 * u); ctx.lineTo(5 * u, -2 * u); ctx.arc(0, -2 * u, 5 * u, 0, Math.PI, true); ctx.lineTo(-5 * u, 6 * u); ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    // Quest route.
    const points = navigation.points;
    if (points?.length > 1) {
      ctx.save();
      ctx.lineCap = ctx.lineJoin = 'round';
      for (const [width, colour] of [[9 * u, 'rgba(255,255,255,.75)'], [5 * u, '#2f9bff']]) {
        ctx.lineWidth = width;
        ctx.strokeStyle = colour;
        ctx.beginPath();
        points.forEach((p, i) => { const [x, y] = toMap(p.x, p.z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      }
      ctx.restore();
    }

    // Landmarks.
    for (const l of LANDMARKS) {
      const [x, y] = toMap(l.x, l.z);
      if (l.floating) { // the Sky Garden floats: a dashed halo
        ctx.save();
        ctx.setLineDash([5 * u, 5 * u]);
        ctx.strokeStyle = 'rgba(216,178,90,.8)';
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.arc(x, y, 22 * u, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(x, y, 8 * u, 0, Math.PI * 2);
      ctx.fillStyle = '#0f0c07';
      ctx.fill();
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = l.color||GOLD;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3 * u, 0, Math.PI * 2);
      ctx.fillStyle = l.color||GOLD;
      ctx.fill();
      const lx = l.callout?size*.04:x+l.side*16*u,ly=l.callout?size*l.labelY:y,align=l.callout?'left':l.side>0?'left':'right';
      if(l.callout){
        ctx.strokeStyle=l.color;ctx.lineWidth=u;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,ly+24*u);ctx.lineTo(lx,ly+24*u);ctx.stroke();
        if(selected?.id===l.id){ctx.beginPath();ctx.arc(x,y,14*u,0,Math.PI*2);ctx.stroke();}
      }
      label(l.name, lx, ly - (l.note ? 6 * u : 0), { font: `bold ${17 * u}px Georgia, serif`, color: l.color||'#f3e3b5', align });
      if (l.note) label(l.note, lx, ly + 13 * u, { font: `italic ${13 * u}px Georgia, serif`, color: 'rgba(243,227,181,.75)', align });
    }

    // Embers, the hound / dog.
    const cursed = quest.stage === 'cursed' || quest.stage === 'return';
    if (quest.stage === 'cursed') {
      quest.embers.forEach(e => {
        if (e.taken || (e.challenge === 'hound' && quest.houndCarrying)) return;
        const [x, y] = toMap(e.x, e.z);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 22 * u);
        glow.addColorStop(0, 'rgba(255,170,60,.95)');
        glow.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 22 * u * (0.85 + 0.15 * Math.sin(time * 4)), 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ff8a2a';
        ctx.strokeStyle = '#fff1d6';
        ctx.lineWidth = 2 * u;
        ctx.fillRect(-6 * u, -6 * u, 12 * u, 12 * u);
        ctx.strokeRect(-6 * u, -6 * u, 12 * u, 12 * u);
        ctx.restore();
      });
    }
    const [dx, dy] = toMap(companion.position.x, companion.position.z);
    ctx.beginPath();
    ctx.arc(dx, dy, (cursed ? 8 : 6) * u, 0, Math.PI * 2);
    ctx.fillStyle = cursed ? '#ff4a3a' : '#c79a6a';
    ctx.fill();
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    if (cursed && quest.houndCarrying) label('HOUND', dx, dy - 18 * u, { font: `bold ${13 * u}px 'DM Mono', monospace`, color: '#ff9a7a' });

    // Player: a pulsing ring and an arrow along the facing direction. Forward is (-sin yaw, -cos yaw).
    const [px, py] = toMap(player.position.x, player.position.z);
    ctx.beginPath();
    ctx.arc(px, py, (14 + 10 * ((time * 0.8) % 1)) * u, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - ((time * 0.8) % 1))})`;
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(-Math.sin(state.yaw), Math.cos(state.yaw)));
    ctx.beginPath();
    ctx.moveTo(0, -15 * u);
    ctx.lineTo(10 * u, 11 * u);
    ctx.lineTo(0, 5 * u);
    ctx.lineTo(-10 * u, 11 * u);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2.5 * u;
    ctx.strokeStyle = '#0f0c07';
    ctx.stroke();
    ctx.restore();

    // Compass and scale bar.
    const ox = size - 60 * u, oy = 64 * u;
    drawClover(ctx, ox, oy, 26 * u, 'rgba(11,10,7,.85)', GOLD);
    label('N', ox, oy - 44 * u, { font: `bold ${20 * u}px Georgia, serif`, color: GOLD });
    const bar = (100 / (2 * HALF)) * size;
    ctx.fillStyle = '#f3e3b5';
    ctx.fillRect(40 * u, size - 46 * u, bar, 4 * u);
    ctx.fillRect(40 * u, size - 52 * u, 2 * u, 16 * u);
    ctx.fillRect(40 * u + bar - 2 * u, size - 52 * u, 2 * u, 16 * u);
    label('100 m', 40 * u + bar / 2, size - 26 * u, { font: `${14 * u}px 'DM Mono', monospace`, color: '#f3e3b5' });
  }

  // viaGesture: closed by M, ✕ or a click, which may recapture the mouse. Escape can't: browsers
  // reserve it for leaving pointer lock, so it shows a one-click resume prompt instead of the intro.
  function setOpen(next, viaGesture = true) {
    if (next === open) return;
    clearTimeout(closeTimer);
    open = next;
    button.setAttribute('aria-expanded',String(open));
    state.mapOpen = open;
    if (!open) {
      overlay.classList.add('closing');
      closeTimer=setTimeout(()=>{
        if(open)return;
        overlay.classList.remove('open','closing');overlay.inert=true;overlay.setAttribute('aria-hidden','true');document.body.classList.remove('grimoire-open');
        if(!state.awaitResume&&!state.locked)returnFocus?.focus({preventScroll:true});
      },reducedMotion.matches?0:430);
      if (state.awaitResume) {
        // Keep recapture inside the initiating click/key gesture, not an animation timer.
        if (viaGesture) resume();
        else resumeHint.classList.add('on');
      }
      return;
    }
    returnFocus=document.activeElement;
    overlay.inert=false;overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('grimoire-open');
    overlay.classList.remove('closing');overlay.classList.add('open');
    setPage('atlas');
    if (state.locked) { // opened while playing: free the mouse for the map, stay in play mode
      state.awaitResume = true;
      document.exitPointerLock();
    }
    if (!relief) buildRelief().catch(error=>{
      reliefBuilding=false;overlay.querySelector('.map-loading').textContent='Terrain shading unavailable. Landmarks and quest hints remain available.';
      console.error('Could not shade the atlas.',error);
    });
    updateQuests();
    resize();
    draw(performance.now() / 1000);
    overlay.querySelector('header button').focus({ preventScroll: true });
  }

  button.addEventListener('click', () => setOpen(!open));
  overlay.querySelector('header button').addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', event => { if (event.target === overlay) setOpen(false); });
  addEventListener('keydown', event => {
    if(event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable)return;
    if (event.code === 'KeyM' && !event.repeat) {event.preventDefault();setOpen(!open);}
    else if (event.code === 'Escape' && open) {event.preventDefault();setOpen(false, false);}
    else if(event.code==='Tab'&&open){
      const focusable=[...overlay.querySelectorAll('button:not(:disabled)')].filter(b=>!b.closest('[inert]')&&b.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){event.preventDefault();first?.focus();}
    }
  });
  addEventListener('resize', () => { if (open) resize(); });
  new ResizeObserver(()=>{if(open){resize();draw(performance.now()/1000);}}).observe(overlay.querySelector('.map-frame'));

  return {
    get open() { return open; },
    toggle() { setOpen(!open); },
    update() {
      if (!open) return;
      const now = performance.now();
      if (now - lastDraw < 66) return; // ~15 fps is plenty for a map
      lastDraw = now;
      updateQuests();
      if(overlay.dataset.page==='atlas')draw(now / 1000);
    }
  };
}
