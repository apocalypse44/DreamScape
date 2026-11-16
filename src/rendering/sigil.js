import { spadeOutline } from '../models/spade.js';
import { cloverShapes } from './kingdomGates.js';
import { SPELLS, SPELL_INK } from '../models/grimoireSpells.js';

// The Accord's four sigils as one family: a bevelled emblem in the kingdom's shape, a smaller glowing
// core of the same shape on each face, a thin orbiting ring with three beads, and a slow spin and bob.
// Procedural (no downloads). Lantern violet, Root green, Tide aqua, Prism white-gold.
export const SIGILS = {
  lantern: { color: 0x6a3fd0, glow: 0xd4bcff, shape: () => [spadeOutline()] },
  root: { color: 0x0c6b32, glow: 0x8dffb0, shape: () => cloverShapes(1) },
  tide: { color: 0x0b6580, glow: 0x8eeeff, shape: () => [heartShape()] },
  prism: { color: 0xa87a1c, glow: 0xfff0b8, shape: () => [diamondShape()] },
};

function heartShape() {
  const s = new THREE.Shape(); s.moveTo(0, -1);
  s.bezierCurveTo(-.4, -.55, -1, -.2, -1, .3); s.bezierCurveTo(-1, .75, -.55, 1, -.25, .95);
  s.bezierCurveTo(-.1, .92, 0, .8, 0, .62); s.bezierCurveTo(0, .8, .1, .92, .25, .95);
  s.bezierCurveTo(.55, 1, 1, .75, 1, .3); s.bezierCurveTo(1, -.2, .4, -.55, 0, -1);
  return s;
}
function diamondShape() {
  const s = new THREE.Shape(); s.moveTo(0, 1); s.lineTo(.7, 0); s.lineTo(0, -1); s.lineTo(-.7, 0); s.lineTo(0, 1); // a card diamond: widest at the middle, not a kite
  return s;
}
/** The kingdom outline(s) of a sigil, as THREE.Shapes (the grimoire's cover sockets and pages draw them too). */
export const sigilShapes = kind => SIGILS[kind].shape();
// Extrude, centre and scale so the emblem is `size` tall.
function emblem(shapes, size, depth) {
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: true, bevelThickness: .25, bevelSize: .12, bevelSegments: 2, curveSegments: 14 });
  geometry.computeBoundingBox(); const box = geometry.boundingBox, k = size / (box.max.y - box.min.y);
  return geometry.center().scale(k, k, depth / (box.max.z - box.min.z));
}

// kind: 'lantern' | 'root' | 'tide' | 'prism'. Returns a Group with tick(dt) for its idle motion;
// `size` is the emblem's height in metres.
// ornate: the grimoire version (movement lab for now): the spell rune it writes glows on both faces, a soft halo
// sits behind it, and the beads become motes of its element (flames, stones, droplets; four colours for the prism).
export function createSigil(kind, size = .7, { ornate = false } = {}) {
  const def = SIGILS[kind];
  if (!def) throw new Error(`Unknown sigil: ${kind}`);
  const group = new THREE.Group(); group.name = `${kind} sigil`;
  const spin = new THREE.Group(); group.add(spin);
  const body = new THREE.MeshLambertMaterial({ color: def.color, emissive: def.color, emissiveIntensity: .25, fog: false }); // dark base: bright tone-mapped daylight would wash it white // no fog: it reads as a glowing artifact
  const core = new THREE.MeshBasicMaterial({ color: def.glow, fog: false });
  const shapes = def.shape();
  spin.add(new THREE.Mesh(emblem(shapes, size, size * .22), body));
  for (const side of [-1, 1]) { // the glowing core shows on both faces
    const inner = new THREE.Mesh(emblem(shapes, size * .36, size * .05), core); inner.position.z = side * size * .12; spin.add(inner);
  }
  const orbit = new THREE.Group(); orbit.rotation.x = 1.15; group.add(orbit);
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(size * .78, size * .018, 6, 48), core));
  for (let i = 0; i < (ornate ? 0 : 3); i++) {
    const bead = new THREE.Mesh(new THREE.OctahedronGeometry(size * .06), core), a = i / 3 * Math.PI * 2;
    bead.position.set(Math.cos(a) * size * .78, Math.sin(a) * size * .78, 0); orbit.add(bead);
  }
  const motes = ornate ? ornament(kind, size, spin, orbit, def) : null;
  if (ornate) { const seen = new Set(); group.traverse(o => { const m = o.material; if (!m || seen.has(m)) return; seen.add(m); m.color?.convertSRGBToLinear(); m.emissive?.convertSRGBToLinear(); }); } // sRGB-output scenes (the lab)
  let time = Math.random() * 10;
  group.userData.tick = dt => {
    time += dt; spin.rotation.y += dt * .9; orbit.rotation.z += dt * 1.6;
    motes?.forEach((m, i) => { m.rotation.y += dt * 3; m.scale.setScalar(1 + .15 * Math.sin(time * 6 + i * 2)); });
    spin.position.y = Math.sin(time * 1.8) * size * .06;
  };
  return group;
}

// The ornate extras: rune faces, a halo and element motes on the orbit. Returns the motes (they flicker in tick).
const ELEMENT = { lantern: 'flame', root: 'earth', tide: 'tide' };
function ornament(kind, size, spin, orbit, def) {
  const spell = SPELLS.find(x => x.id === ELEMENT[kind]), ink = spell ? SPELL_INK[spell.id][0] : '#7a5a12';
  // The rune is engraved dark into the glowing core, so it reads crisply against the light.
  const rune = new THREE.MeshBasicMaterial({ map: runeTexture(spell, ink), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  for (const side of [-1, 1]) { const face = new THREE.Mesh(new THREE.PlaneGeometry(size * .3, size * .3), rune); face.position.z = side * size * .16; face.rotation.y = side < 0 ? Math.PI : 0; spin.add(face); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: def.glow, transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(size * 2.2); spin.parent.add(halo);
  const r = size * .78, motes = [];
  const make = i => {
    if (kind === 'lantern') return new THREE.Mesh(new THREE.ConeGeometry(size * .05, size * .16, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd27a : 0xff7a2a, fog: false }));
    if (kind === 'root') return new THREE.Mesh(new THREE.DodecahedronGeometry(size * .06), new THREE.MeshLambertMaterial({ color: 0x8a6a3a, emissive: 0x2a5a1a, fog: false }));
    if (kind === 'tide') { const d = new THREE.Mesh(new THREE.SphereGeometry(size * .05, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: .85, fog: false })); d.scale.y = 1.4; return d; }
    return new THREE.Mesh(new THREE.OctahedronGeometry(size * .06), new THREE.MeshBasicMaterial({ color: [0xff9a4a, 0x7fe0ff, 0xc9fff4, 0xe8c27a][i], fog: false })); // prism: the four elements
  };
  const n = 4; // four motes on every sigil, one for each kingdom of the Accord (the prism's are the four element colours)
  for (let i = 0; i < n; i++) { const m = make(i), a = i / n * Math.PI * 2; m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); m.rotation.x = Math.PI / 2; orbit.add(m); motes.push(m); }
  return motes;
}
// The rune: the spell's icon stroked in its glow colour (the prism's is a four-point star).
function runeTexture(spell, glow) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.translate(128, 128); g.strokeStyle = glow; g.fillStyle = glow; g.lineCap = g.lineJoin = 'round'; g.shadowColor = glow; g.shadowBlur = 4;
  if (spell) { g.scale(7.5, 7.5); g.translate(-12, -12); g.lineWidth = 2.2; g.stroke(new Path2D(spell.icon)); }
  else { g.font = '150px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✦', 0, 8); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
let halo = null;
function haloTexture() {
  if (halo) return halo;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.35, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return halo = new THREE.CanvasTexture(c);
}
