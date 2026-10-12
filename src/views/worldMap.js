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

export function createWorldMap({ world, player, state, quest, companion, navigation, gates = [] }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

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
  overlay.innerHTML = `<div class="atlas">
    <header><canvas class="seal" width="44" height="44" aria-hidden="true" style="border:0"></canvas>
      <div><h2>GRIMOIRE ATLAS</h2><small>THE FOUR KINGDOMS · SEED DS-${world.seed}</small></div>
      <button type="button" aria-label="Close map">✕</button></header>
    <canvas class="map"></canvas>
    <footer><span><i style="background:${GOLD}"></i>LANDMARK</span><span><i style="background:#ff8a2a"></i>EMBER</span>
      <span><i style="background:#ff4a3a"></i>HOUND</span><span><i style="background:#2f9bff"></i>ROUTE</span>
      <span><i style="background:#fff"></i>YOU</span><span>⌂ GATE</span><span class="hint">M / ESC · CLOSE</span></footer></div>`;
  document.body.appendChild(overlay);
  const canvas = overlay.querySelector('canvas.map');
  const ctx = canvas.getContext('2d');
  const sealCanvas = overlay.querySelector('canvas.seal');
  drawClover(sealCanvas.getContext('2d'), 22, 24, 21, '#0b0a07', GOLD);

  let open = false, relief = null, size = 0, lastDraw = 0;

  // --- relief layer: generated once from the calm height field -------------------------------------
  function buildRelief() {
    const cell = (HALF * 2) / RES;
    const heights = new Float32Array(RES * RES);
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
      heights[j * RES + i] = world.heightAt(CENTER.x - HALF + (i + 0.5) * cell, CENTER.z - HALF + (j + 0.5) * cell, CALM);
    }
    const image = new ImageData(RES, RES);
    const light = [-0.55, 0.7, -0.45]; // from the north-west, above (x, y, z)
    const ll = Math.hypot(...light);
    const tint = new THREE.Color(), paper = new THREE.Color(0x2b2416);
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
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
    relief = document.createElement('canvas');
    relief.width = relief.height = RES;
    relief.getContext('2d').putImageData(image, 0, 0);
  }

  // --- drawing ------------------------------------------------------------------------------------------
  const toMap = (x, z) => [((x - CENTER.x + HALF) / (2 * HALF)) * size, ((z - CENTER.z + HALF) / (2 * HALF)) * size];

  function resize() {
    const css = Math.floor(Math.min(innerHeight - 170, innerWidth - 120, 860));
    const dpr = Math.min(devicePixelRatio, 2);
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
    ctx.drawImage(relief, 0, 0, size, size);

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
      ctx.strokeStyle = GOLD;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3 * u, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
      const lx = x + l.side * 16 * u, align = l.side > 0 ? 'left' : 'right';
      label(l.name, lx, y - (l.note ? 6 * u : 0), { font: `bold ${17 * u}px Georgia, serif`, color: '#f3e3b5', align });
      if (l.note) label(l.note, lx, y + 13 * u, { font: `italic ${13 * u}px Georgia, serif`, color: 'rgba(243,227,181,.75)', align });
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

  function setOpen(next) {
    if (next === open) return;
    open = next;
    overlay.classList.toggle('open', open);
    if (!open) return;
    if (!relief) buildRelief(); // ~100k height samples, once per page
    resize();
    draw(performance.now() / 1000);
    if (!state.locked) overlay.querySelector('header button').focus({ preventScroll: true });
  }

  button.addEventListener('click', () => {
    document.exitPointerLock?.();
    setOpen(!open);
  });
  overlay.querySelector('header button').addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', event => { if (event.target === overlay) setOpen(false); });
  addEventListener('keydown', event => {
    if (event.code === 'KeyM' && !event.repeat) setOpen(!open);
    else if (event.code === 'Escape' && open) setOpen(false);
  });
  addEventListener('resize', () => { if (open) resize(); });

  return {
    get open() { return open; },
    toggle() { setOpen(!open); },
    update() {
      if (!open) return;
      const now = performance.now();
      if (now - lastDraw < 66) return; // ~15 fps is plenty for a map
      lastDraw = now;
      draw(now / 1000);
    }
  };
}
