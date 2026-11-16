import { SPELLS, SPELL_INK } from '../models/grimoireSpells.js';

// The sigil-blade: the sword the grimoire forges from its four pages when Morcant falls (GRIMOIRE_SPELLS_PLAN.md).
// Built in the traveller sword's own frame (tools/travelerBuilder.js): origin at the grip, +Y toward the tip, flat on
// local Z, guard near y .08 and tip near y .9, so it can replace that sword without moving sockets, trail or tip.
//   blade:  a leaf-shaped steel blade with a dark fuller, and the four spell runes inlaid along it, glowing in their
//           colours (Gale, Flame Lance, Stone Wall, Tide Ward: the order the pages are written).
//   guard:  a gold crescent whose wings rise toward the blade, with the grimoire cover's ring at its heart: a pale
//           gem inside, four small gems around it in the four spell colours.
//   grip:   dark leather bound with gold rings; the pommel is a card-diamond for the Prism Sigil.
// setGlow(k) brightens the runes and an outline halo (0 = resting, 1 = just forged).
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
export function createSigilBlade({ linear = true } = {}) {
  const T = THREE, c = hex => linear ? lin(hex) : new T.Color(hex), group = new T.Group(); group.name = 'SigilBlade';
  const steel = new T.MeshStandardMaterial({ color: c(0xe9eef6), metalness: .45, roughness: .28, emissive: c(0x1c2433), emissiveIntensity: .35 }); // reads bright without an environment map
  const dark = new T.MeshStandardMaterial({ color: c(0x3a4256), metalness: .6, roughness: .4 });
  const gold = new T.MeshStandardMaterial({ color: c(0xd9ae4a), metalness: .9, roughness: .3 });
  const leather = new T.MeshStandardMaterial({ color: c(0x0b0a0d), roughness: .6 }); // black grip between the gold rings
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; group.add(m); return m; };
  // Blade: widest a third of the way up, then a long taper to the point; a bevel gives it a sharpened edge.
  const s = new T.Shape(); s.moveTo(-.036, .09);
  s.bezierCurveTo(-.05, .25, -.048, .4, -.04, .62); s.quadraticCurveTo(-.03, .8, 0, .95);
  s.quadraticCurveTo(.03, .8, .04, .62); s.bezierCurveTo(.048, .4, .05, .25, .036, .09); s.lineTo(-.036, .09);
  const blade = new T.ExtrudeGeometry(s, { depth: .004, bevelEnabled: true, bevelThickness: .007, bevelSize: .006, bevelSegments: 1, curveSegments: 16 });
  blade.translate(0, 0, -.002); add(blade, steel);
  for (const z of [-1, 1]) add(new T.BoxGeometry(.012, .5, .004), dark, 0, .4, z * .0075); // the fuller, on both faces
  // Runes inlaid along the fuller, both faces.
  const runes = [];
  ['wind', 'flame', 'earth', 'tide'].forEach((id, i) => {
    const mat = new T.MeshBasicMaterial({ map: runeTexture(SPELLS.find(x => x.id === id), SPELL_INK[id][1]), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
    for (const z of [-1, 1]) { const m = add(new T.PlaneGeometry(.05, .05), mat, 0, .19 + i * .11, z * .0105); if (z < 0) m.rotation.y = Math.PI; m.castShadow = false; }
    runes.push(mat);
  });
  // Guard: a crescent rising toward the blade, the cover's ring and gems at its heart.
  // A wide, shallow crescent (a slice of a large ring), so the wings sweep out more than up.
  const arc = Math.PI * .55, crescent = add(new T.TorusGeometry(.16, .013, 8, 40, arc), gold, 0, .235); crescent.rotation.z = -Math.PI / 2 - arc / 2;
  for (const x of [-1, 1]) { const tip = add(new T.ConeGeometry(.016, .045, 8), gold, x * Math.sin(arc / 2) * .16, .235 - Math.cos(arc / 2) * .16 + .012); tip.rotation.z = -x * .9; } // finials
  add(new T.BoxGeometry(.11, .02, .03), gold, 0, .078);
  const ring = add(new T.TorusGeometry(.03, .006, 8, 28), gold, 0, .085); ring.scale.z = 1.6;
  const heart = new T.MeshStandardMaterial({ color: c(0xfff0b8), emissive: c(0xfff0b8), emissiveIntensity: .8, roughness: .1 });
  add(new T.OctahedronGeometry(.018, 0), heart, 0, .085).scale.z = .7;
  const gems = ['wind', 'flame', 'earth', 'tide'].map((id, i) => {
    const a = i / 4 * Math.PI * 2 + Math.PI / 2, col = c(SPELL_INK[id][1]);
    const m = add(new T.OctahedronGeometry(.007, 0), new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .7 }), Math.cos(a) * .03, .085 + Math.sin(a) * .03, .01); return m;
  });
  // Grip and pommel.
  add(new T.CylinderGeometry(.018, .02, .15, 10), leather, 0, -.005);
  for (const y of [-.07, -.005, .06]) add(new T.TorusGeometry(.02, .004, 6, 16), gold, 0, y).rotation.x = Math.PI / 2;
  const diamond = new T.Shape(); diamond.moveTo(0, .032); diamond.lineTo(.024, 0); diamond.lineTo(0, -.032); diamond.lineTo(-.024, 0); diamond.lineTo(0, .032);
  const pommel = new T.ExtrudeGeometry(diamond, { depth: .012, bevelEnabled: true, bevelThickness: .005, bevelSize: .004, bevelSegments: 1 }); pommel.translate(0, -.108, -.006); add(pommel, gold);
  add(new T.OctahedronGeometry(.009, 0), heart, 0, -.108, .012);
  // Halo: a soft outline of the blade that shows while it glows.
  const halo = add(new T.ShapeGeometry(s, 16), new T.MeshBasicMaterial({ color: c(0xfff3d0), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false }));
  halo.scale.set(1.5, 1.04, 1); halo.position.y = -.01; halo.castShadow = false;
  group.userData.setGlow = k => {
    runes.forEach(m => { m.opacity = .55 + .45 * k; }); halo.material.opacity = .35 * Math.max(0, (k - .45) / .55); // only while freshly forged heart.emissiveIntensity = .8 + 2 * k;
    gems.forEach(g => { g.material.emissiveIntensity = .7 + 2 * k; });
  };
  group.userData.setGlow(0);
  return group;
}
function runeTexture(spell, glow) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64); g.scale(4.2, 4.2); g.translate(-12, -12); g.strokeStyle = glow; g.lineWidth = 2; g.lineCap = g.lineJoin = 'round'; g.shadowColor = glow; g.shadowBlur = 6;
  g.stroke(new Path2D(spell.icon));
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

// The sigil-blade's sheath, in the same sword frame (it is placed where the sword rests on the back): dark leather
// following the blade's outline a little wider, a gold throat at the mouth, a gold chape at the tip, and four thin
// gold bands. setShow(k) grows it in from the throat down with a gold flash (0 = gone, 1 = there).
export function createSigilSheath({ linear = true } = {}) {
  const T = THREE, c = hex => linear ? lin(hex) : new T.Color(hex), group = new T.Group(); group.name = 'SigilSheath';
  const leather = new T.MeshStandardMaterial({ color: c(0x2a1620), roughness: .75, emissive: c(0xd9ae4a), emissiveIntensity: 0 });
  const gold = new T.MeshStandardMaterial({ color: c(0xd9ae4a), metalness: .9, roughness: .3, emissive: c(0xd9ae4a), emissiveIntensity: 0 });
  const body = new T.Group(); group.add(body); // scaled from the throat as it grows in
  const add = (geo, mat, y = 0) => { const m = new T.Mesh(geo, mat); m.position.y = y; m.castShadow = true; body.add(m); return m; };
  const s = new T.Shape(); s.moveTo(-.05, .08);
  s.bezierCurveTo(-.062, .25, -.06, .42, -.052, .63); s.quadraticCurveTo(-.04, .82, 0, .99);
  s.quadraticCurveTo(.04, .82, .052, .63); s.bezierCurveTo(.06, .42, .062, .25, .05, .08); s.lineTo(-.05, .08);
  const geo = new T.ExtrudeGeometry(s, { depth: .02, bevelEnabled: true, bevelThickness: .008, bevelSize: .006, bevelSegments: 2, curveSegments: 16 }); geo.translate(0, 0, -.01);
  add(geo, leather);
  add(new T.BoxGeometry(.13, .035, .05), gold, .095); // throat
  const chape = add(new T.ConeGeometry(.028, .09, 8), gold, .955); chape.rotation.z = Math.PI; chape.scale.z = .6;
  for (const y of [.28, .45, .62, .78]) { const band = add(new T.BoxGeometry(.118 - (y - .28) * .05, .008, .046), gold, y); band.scale.x = 1; }
  body.position.y = .08; body.children.forEach(m => { m.position.y -= .08; }); // grow from the throat
  group.userData.setShow = k => {
    group.visible = k > 0; body.scale.set(1, Math.max(.001, k), 1);
    const flash = k > 0 && k < 1 ? 1 - k : 0; leather.emissiveIntensity = flash * .8; gold.emissiveIntensity = flash * 2;
  };
  return group;
}
