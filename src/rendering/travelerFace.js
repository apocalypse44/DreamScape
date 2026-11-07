import { createBlinker, talkOpen } from '../models/faceExpression.js';

// Anime face for the traveller, painted into a small canvas on the head's face shell
// (TravelerFace, built by tools/travelerBuilder.js). No image download: everything is drawn
// here, and the canvas is redrawn only when the expression, blink or mouth changes.
const W = 512, H = 384;              // the shell spans 1.9 rad across and 0.42 pi down; this keeps its aspect
// Eyes about a fifth of the face width each, one eye-width apart: chibi proportions for this head.
const EYE_Y = 172, EYE_DX = 112, MOUTH_Y = 292, MOUTH_X = W / 2;
const INK = '#2a1d2e', LIP = '#4a2630', MOUTH = '#7a2f3a', TONGUE = '#d97a83';
// eye: open | wide | arc (^^) | squeeze (><); lid 0 open .. 1 closed; brow lift (+ up) and tilt (+ angry, - worried).
const LOOKS = {
  neutral: { eye: 'open', lid: .1, lift: 0, tilt: 0, mouth: 'line', blush: .25 },
  smile: { eye: 'open', lid: .18, lift: .15, tilt: -.1, mouth: 'smile', blush: .5 },
  joy: { eye: 'arc', lift: .35, tilt: -.2, mouth: 'openSmile', blush: .85 },
  determined: { eye: 'open', lid: .3, lift: -.2, tilt: .6, mouth: 'line', blush: .15 },
  shout: { eye: 'open', lid: .22, lift: -.3, tilt: 1, mouth: 'shout', blush: .2 },
  surprised: { eye: 'wide', lid: 0, lift: .9, tilt: -.2, mouth: 'o', blush: .3 },
  effort: { eye: 'squeeze', lift: -.2, tilt: .7, mouth: 'grit', blush: .55 },
  hurt: { eye: 'squeeze', lift: .3, tilt: -.8, mouth: 'wavy', blush: .3 },
  focus: { eye: 'open', lid: .42, lift: -.1, tilt: .3, mouth: 'small', blush: .2 },
  sad: { eye: 'open', lid: .35, lift: .2, tilt: -.9, mouth: 'frown', blush: .2 },
};

function eye(g, cx, side, look, blink, style) {
  const cy = EYE_Y, wide = look.eye === 'wide', rx = wide ? 46 : 43, ry = wide ? 60 : 55;
  g.lineCap = g.lineJoin = 'round'; g.strokeStyle = INK;
  if (look.eye === 'arc') { // ^^ happy closed
    g.lineWidth = 8.5; g.beginPath(); g.arc(cx, cy + 20, 35, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return;
  }
  if (look.eye === 'squeeze') { // > <  (viewer-left eye points right)
    const d = side < 0 ? 1 : -1; g.lineWidth = 8.5; g.beginPath();
    g.moveTo(cx - 26 * d, cy - 23); g.lineTo(cx + 23 * d, cy); g.lineTo(cx - 26 * d, cy + 23); g.stroke(); return;
  }
  const lid = Math.max(look.lid ?? 0, look.eye === 'wide' ? 0 : style.restLid, blink);
  if (lid > .88) { // closed: a soft downward curve
    g.lineWidth = 7.5; g.beginPath(); g.moveTo(cx - rx, cy + 6); g.quadraticCurveTo(cx, cy + 20, cx + rx, cy + 6); g.stroke(); return;
  }
  const lidY = cy - ry + 2 * ry * lid;
  // The fringe hides the brows, so the lid carries the mood: angry lowers the inner corner, sad raises it.
  const slant = lid > .02 ? look.tilt : 0, inner = side < 0 ? 1 : -1; // +1: inner corner is on the right
  const yLeft = lidY + slant * (inner < 0 ? 16 : -8), yRight = lidY + slant * (inner > 0 ? 16 : -8);
  g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
  g.beginPath(); g.moveTo(cx - rx - 4, yLeft); g.lineTo(cx + rx + 4, yRight); g.lineTo(cx + rx + 4, cy + ry + 4); g.lineTo(cx - rx - 4, cy + ry + 4); g.closePath(); g.clip();
  g.fillStyle = style.sclera; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  const irx = wide ? 22 : 30, iry = wide ? 29 : 42, gradient = g.createLinearGradient(0, cy - iry, 0, cy + iry);
  gradient.addColorStop(0, style.iris[0]); gradient.addColorStop(.55, style.iris[1]); gradient.addColorStop(1, style.iris[2]);
  g.fillStyle = gradient; g.beginPath(); g.ellipse(cx + side * 2, cy + 4, irx, iry, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#150e22'; g.beginPath(); g.ellipse(cx + side * 2, cy + 3, irx * .45, iry * .5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx - 11 + side * 2, cy - 16, wide ? 8 : 11, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 11 + side * 2, cy + 16, 4.5, 0, Math.PI * 2); g.fill();
  g.restore();
  // Upper lash: along the lid when lowered, else the top of the eye, with an outer flick.
  g.lineWidth = 8.5;
  if (lid > .02) { // lash along the (slanted) lid, trimmed to just past the eye outline
    g.save(); g.beginPath(); g.ellipse(cx, cy, rx + 5, ry + 5, 0, 0, Math.PI * 2); g.clip();
    g.beginPath(); g.moveTo(cx - rx - 6, yLeft); g.lineTo(cx + rx + 6, yRight); g.stroke(); g.restore();
  } else { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.12, Math.PI * 1.88); g.stroke(); }
  const outer = cx - side * -rx; // outer corner is away from the face centre
  g.lineWidth = 5; g.beginPath(); g.moveTo(outer, Math.max(Math.min(yLeft, yRight), cy - ry * .55)); g.lineTo(outer + (outer > cx ? 9 : -9), Math.max(Math.min(yLeft, yRight), cy - ry * .55) - 7); g.stroke();
  g.globalAlpha = .7; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * .25, Math.PI * .75); g.stroke(); g.globalAlpha = 1;
}

function brow(g, cx, side, look) {
  const inner = cx + side * -16, outer = cx + side * 32, base = EYE_Y - 60 - look.lift * 14;
  g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(inner, base + look.tilt * 12); g.quadraticCurveTo((inner + outer) / 2, base - 6, outer, base - look.tilt * 4); g.stroke();
}

function mouth(g, look, open) {
  // Drawn at 1.5x around its centre so it reads at gameplay distance.
  g.save(); g.translate(MOUTH_X, MOUTH_Y); g.scale(1.5, 1.5); g.translate(-MOUTH_X, -MOUTH_Y);
  drawMouth(g, look, open); g.restore();
}
function drawMouth(g, look, open) {
  const x = MOUTH_X, y = MOUTH_Y;
  g.strokeStyle = LIP; g.lineWidth = 4.5; g.lineCap = g.lineJoin = 'round'; g.fillStyle = MOUTH;
  let kind = look.mouth;
  if (open > .08 && ['line', 'smile', 'small'].includes(kind)) kind = 'talk';
  switch (kind) {
    case 'line': g.beginPath(); g.moveTo(x - 13, y); g.quadraticCurveTo(x, y + 2, x + 13, y); g.stroke(); break;
    case 'small': g.beginPath(); g.moveTo(x - 7, y + 1); g.lineTo(x + 7, y + 1); g.stroke(); break;
    case 'smile': g.beginPath(); g.arc(x, y - 14, 18, Math.PI * .25, Math.PI * .75); g.stroke(); break;
    case 'frown': g.beginPath(); g.arc(x, y + 16, 15, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); break;
    case 'talk': g.beginPath(); g.ellipse(x, y + 2, 9, 3 + open * 9, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
    case 'o': g.beginPath(); g.ellipse(x, y + 3, 8, 11, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
    case 'openSmile': {
      g.beginPath(); g.moveTo(x - 24, y - 6); g.quadraticCurveTo(x, y - 2, x + 24, y - 6); g.quadraticCurveTo(x + 18, y + 24, x, y + 25); g.quadraticCurveTo(x - 18, y + 24, x - 24, y - 6);
      g.save(); g.fill(); g.clip(); g.fillStyle = TONGUE; g.beginPath(); g.ellipse(x, y + 22, 15, 9, 0, 0, Math.PI * 2); g.fill(); g.restore(); g.stroke(); break;
    }
    case 'shout': {
      g.beginPath(); g.moveTo(x - 22, y - 8); g.lineTo(x + 22, y - 8); g.lineTo(x + 14, y + 22); g.lineTo(x - 14, y + 22); g.closePath();
      g.save(); g.fill(); g.clip(); g.fillStyle = '#fffaf4'; g.fillRect(x - 24, y - 9, 48, 7); g.fillStyle = TONGUE; g.beginPath(); g.ellipse(x, y + 22, 12, 7, 0, 0, Math.PI * 2); g.fill(); g.restore(); g.stroke(); break;
    }
    case 'grit': {
      g.fillStyle = '#fffaf4'; g.beginPath(); g.rect(x - 20, y - 6, 40, 14); g.fill(); g.stroke();
      g.lineWidth = 2; for (const dx of [-10, 0, 10]) { g.beginPath(); g.moveTo(x + dx, y - 6); g.lineTo(x + dx, y + 8); g.stroke(); }
      g.beginPath(); g.moveTo(x - 20, y + 1); g.lineTo(x + 20, y + 1); g.stroke(); break;
    }
    case 'wavy': g.beginPath(); g.moveTo(x - 18, y + 2); for (let i = 1; i <= 6; i++) g.lineTo(x - 18 + i * 6, y + (i % 2 ? -3 : 3)); g.stroke(); break;
  }
}

function blush(g, amount) {
  if (amount <= 0) return;
  for (const side of [-1, 1]) {
    const cx = W / 2 + side * 128, cy = 238, r = g.createRadialGradient(cx, cy, 2, cx, cy, 30);
    r.addColorStop(0, `rgba(236, 120, 128, ${.42 * amount})`); r.addColorStop(1, 'rgba(236, 120, 128, 0)');
    g.fillStyle = r; g.beginPath(); g.ellipse(cx, cy, 30, 13, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `rgba(214, 92, 104, ${.45 * amount})`; g.lineWidth = 2;
    for (const dx of [-9, 0, 9]) { g.beginPath(); g.moveTo(cx + dx - 3, cy + 4); g.lineTo(cx + dx + 3, cy - 4); g.stroke(); }
  }
}

// style: { iris: [top, middle, bottom] colours, restLid: resting lid 0..1 } - each character's eyes.
// sclera: eye-white colour (villains use a dark one); mood: the resting expression (person.js).
export const DEFAULT_STYLE = { iris: ['#2b2052', '#5a43a8', '#a58cf0'], restLid: 0, sclera: '#fbf7f2' };
export function drawFace(g, expression = 'neutral', { blink = 0, open = 0, style = DEFAULT_STYLE } = {}) {
  const look = LOOKS[expression] || LOOKS.neutral;
  g.clearRect(0, 0, W, H);
  blush(g, look.blush);
  for (const side of [-1, 1]) { const cx = W / 2 + side * EYE_DX; brow(g, cx, side, look); eye(g, cx, side, look, blink, style); }
  mouth(g, look, open);
}

// mesh: a face-shell mesh (TravelerFace / PersonFace); gradientMap: the toon ramp shared with the body.
export function createTravelerFace(mesh, gradientMap, style = DEFAULT_STYLE) {
  style = { ...DEFAULT_STYLE, ...style };
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding; texture.anisotropy = 4;
  mesh.material = new THREE.MeshToonMaterial({ map: texture, gradientMap, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mesh.renderOrder = 1; mesh.castShadow = false;
  const blinker = createBlinker();
  let key = '', time = 0;
  return {
    update(dt, expression, talking = false) {
      time += dt;
      const blink = blinker.update(dt, expression), open = talkOpen(time, talking);
      const next = `${expression}|${Math.round(blink * 4)}|${Math.round(open * 4)}`;
      if (next === key) return; // nothing visible changed: no redraw, no upload
      key = next; drawFace(g, expression, { blink: Math.round(blink * 4) / 4, open: Math.round(open * 4) / 4, style }); texture.needsUpdate = true;
    },
    dispose() { texture.dispose(); mesh.material.dispose(); },
  };
}
