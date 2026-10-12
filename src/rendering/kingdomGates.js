// Kingdom gates: each trail enters its kingdom through a gate themed by the kingdom's suit, so every
// region announces itself the way each district does in a city of themed quarters. The Clover Kingdom
// (the MVP's playable kingdom) gets a grand carved arch with banners; Heart, Diamond and Spade get
// minimal obelisk gates. Emblems are extruded 2D suit shapes. Everything is lit by emissive materials
// only (no extra lights), so the gates cost a handful of draw calls.
import { CLOVER_ENTRANCE } from '../models/cloverTerrain.js';
import { trailPoint } from './props.js';
import { fitText } from './canvasText.js';

// --- suit shapes (about 1 unit tall, centred) --------------------------------------------------------
function heartShape(s = 1) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.5 * s);
  h.bezierCurveTo(-0.15 * s, -0.32 * s, -0.55 * s, -0.12 * s, -0.55 * s, 0.15 * s);
  h.bezierCurveTo(-0.55 * s, 0.42 * s, -0.22 * s, 0.55 * s, 0, 0.3 * s);
  h.bezierCurveTo(0.22 * s, 0.55 * s, 0.55 * s, 0.42 * s, 0.55 * s, 0.15 * s);
  h.bezierCurveTo(0.55 * s, -0.12 * s, 0.15 * s, -0.32 * s, 0, -0.5 * s);
  return h;
}
function diamondShape(s = 1) {
  const d = new THREE.Shape();
  d.moveTo(0, 0.6 * s); d.lineTo(0.4 * s, 0); d.lineTo(0, -0.6 * s); d.lineTo(-0.4 * s, 0); d.closePath();
  return d;
}
function spadeShapes(s = 1) {
  const leaf = new THREE.Shape(); // an upside-down heart
  leaf.moveTo(0, 0.55 * s);
  leaf.bezierCurveTo(0.15 * s, 0.37 * s, 0.55 * s, 0.17 * s, 0.55 * s, -0.1 * s);
  leaf.bezierCurveTo(0.55 * s, -0.37 * s, 0.22 * s, -0.5 * s, 0, -0.25 * s);
  leaf.bezierCurveTo(-0.22 * s, -0.5 * s, -0.55 * s, -0.37 * s, -0.55 * s, -0.1 * s);
  leaf.bezierCurveTo(-0.55 * s, 0.17 * s, -0.15 * s, 0.37 * s, 0, 0.55 * s);
  const stem = new THREE.Shape();
  stem.moveTo(-0.06 * s, -0.25 * s); stem.lineTo(0.06 * s, -0.25 * s); stem.lineTo(0.22 * s, -0.6 * s); stem.lineTo(-0.22 * s, -0.6 * s); stem.closePath();
  return [leaf, stem];
}
// Four heart leaves around a centre, plus a stem: the clover of the Clover Kingdom.
function cloverShapes(s = 1) {
  const shapes = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const leaf = new THREE.Shape();
    const pts = heartShape(0.62 * s).getPoints(24).map(p => {
      const y = p.y + 0.31 * s; // leaf tip at the centre, lobes outward
      return new THREE.Vector2(p.x * Math.cos(a) - y * Math.sin(a), p.x * Math.sin(a) + y * Math.cos(a));
    });
    leaf.setFromPoints(pts.map(p => new THREE.Vector2(-p.x, -p.y)));
    shapes.push(leaf);
  }
  const stem = new THREE.Shape();
  stem.moveTo(-0.04 * s, 0); stem.quadraticCurveTo(0.05 * s, -0.4 * s, 0.22 * s, -0.68 * s);
  stem.lineTo(0.3 * s, -0.63 * s); stem.quadraticCurveTo(0.12 * s, -0.36 * s, 0.05 * s, 0); stem.closePath();
  shapes.push(stem);
  return shapes;
}
const extrude = (shapes, depth) => new THREE.ExtrudeGeometry(shapes, {
  depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: 0.04, bevelSegments: 2, curveSegments: 16,
}).translate(0, 0, -depth / 2);

// A name board drawn on a canvas; readable from both sides.
function plaque(lines, { width, ink, ground, edge, height = width / 4 }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
  const g = canvas.getContext('2d');
  g.fillStyle = ground; g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = edge; g.lineWidth = 14; g.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  g.lineWidth = 3; g.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  const big = Math.round(canvas.height * (lines.length > 1 ? 0.36 : 0.5));
  g.font = `bold ${big}px Georgia, serif`;
  fitText(g, lines[0], 512, canvas.height * (lines.length > 1 ? 0.4 : 0.52), 900); // inside the inner border
  if (lines[1]) { g.font = `italic ${Math.round(big * 0.45)}px Georgia, serif`; fitText(g, lines[1], 512, canvas.height * 0.74, 900); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 4;
  const group = new THREE.Group();
  for (const flip of [0, Math.PI]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
    face.rotation.y = flip;
    face.position.z = flip ? -0.11 : 0.11;
    group.add(face);
  }
  group.add(new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x2a2116, roughness: 0.9 })));
  return group;
}

// Banner cloth with the clover emblem, hanging from its top edge.
function banner(colour) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 640;
  const g = canvas.getContext('2d');
  g.fillStyle = '#163f24'; g.fillRect(0, 0, 256, 640);
  g.fillStyle = colour; g.fillRect(0, 0, 256, 40); g.fillRect(0, 600, 256, 40);
  g.strokeStyle = '#d8b25a'; g.lineWidth = 6; g.strokeRect(16, 52, 224, 536);
  g.fillStyle = colour; g.font = 'bold 200px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('♣', 128, 300);
  g.fillStyle = '#d8b25a'; g.font = 'bold 34px Georgia, serif'; fitText(g, 'CLOVER', 128, 480, 200);
  // Swallow-tail cut at the bottom.
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 640); g.lineTo(128, 560); g.lineTo(256, 640); g.closePath(); g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  const geometry = new THREE.PlaneGeometry(1.5, 3.75, 1, 6).translate(0, -1.875, 0); // pivot at the top
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
}

export function createKingdomGates({ scene, world, onReady }) {
  const root = new THREE.Group();
  root.name = 'Kingdom gates';
  scene.add(root);
  const colliders = [], gates = [], animated = [];

  // Place a gate group at (x, z), its front facing the Grimoire Tower; pillars become colliders.
  function place(group, name, x, z, pillarX, pillarRadius) {
    group.position.set(x, world.terrainHeight(x, z), z);
    group.rotation.y = Math.atan2(-x, -z); // local +z toward the centre
    root.add(group);
    const c = Math.cos(group.rotation.y), s = Math.sin(group.rotation.y);
    for (const side of [-1, 1]) colliders.push({ x: x + c * side * pillarX, z: z - s * side * pillarX, radius: pillarRadius });
    gates.push({ group, name, x, z });
  }

  // --- Clover Kingdom: the grand arch -----------------------------------------------------------------
  {
    const gate = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x5d6a5a, roughness: 0.95, flatShading: true });
    const trim = new THREE.MeshStandardMaterial({ color: 0x2f6b3c, roughness: 0.7, emissive: 0x0f3a18, emissiveIntensity: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.6, roughness: 0.35, emissive: 0x3a2a08 });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x8fe36b, emissive: 0x4bd23a, emissiveIntensity: 1.3, roughness: 0.4 });
    const span = 5.5;
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 12, 8), stone); // runs 4 m below ground for slopes
      pillar.position.set(side * span, 2, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.2, 2.3), stone);
      base.position.set(side * span, 0.4, 0);
      const band = (y, r) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 24), trim); m.rotation.x = Math.PI / 2; m.position.set(side * span, y, 0); return m; };
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 0.6, 8), stone);
      cap.position.set(side * span, 8.3, 0);
      const lantern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), leaf);
      lantern.position.set(side * span, 9.05, 0);
      gate.add(pillar, base, band(2.2, 0.86), band(5.2, 0.8), band(7.6, 0.78), cap, lantern);
      animated.push({ object: lantern, bob: 0.12, phase: side });
      const flag = banner('#8fe36b');
      flag.position.set(side * span, 7.4, 1.05); // hangs on the pillar's front face
      gate.add(flag);
      animated.push({ object: flag, sway: 0.08, phase: side * 1.7 });
    }
    // The arch: half a torus spanning the pillars, with a gold inner rim.
    const arch = new THREE.Mesh(new THREE.TorusGeometry(span, 0.6, 8, 32, Math.PI), stone);
    arch.position.y = 7.8;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(span - 0.55, 0.12, 6, 32, Math.PI), gold);
    rim.position.y = 7.8;
    gate.add(arch, rim);
    // Keystone emblem: a big glowing four-leaf clover in a gold ring.
    const emblem = new THREE.Group();
    emblem.add(new THREE.Mesh(extrude(cloverShapes(2.6), 0.35), leaf));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.13, 8, 40), gold);
    emblem.add(ring);
    emblem.position.y = 7.8 + span + 0.4;
    gate.add(emblem);
    animated.push({ object: emblem, spin: 0.35, bob: 0.15 });
    const board = plaque(['CLOVER KINGDOM', 'Cliff Terraces · Sky Garden'], { width: 6.6, ink: '#e9d28c', ground: '#173a22', edge: '#d8b25a', height: 1.55 });
    board.position.y = 6.3;
    gate.add(board);
    const threshold = new THREE.Mesh(new THREE.BoxGeometry(2 * span + 2.6, 0.35, 3.2), stone);
    threshold.position.y = -0.05;
    gate.add(threshold);
    for (const object of gate.children) object.castShadow = true;
    const at = { x: CLOVER_ENTRANCE.x, z: CLOVER_ENTRANCE.z + 18 }; // on the approach path, before the terraces rise
    place(gate, 'CLOVER KINGDOM', at.x, at.z, span, 1.1);
  }

  // --- Heart, Diamond, Spade: minimal obelisk gates --------------------------------------------------
  const MINIMAL = [
    { road: 1, name: 'HEART KINGDOM', shapes: () => heartShape(1.6), colour: 0xff6b6b, glow: 0xd8262b, stone: 0x5e2a2a, ink: '#ffd7d2', ground: '#3a1416' },
    { road: 2, name: 'DIAMOND KINGDOM', shapes: () => diamondShape(1.6), colour: 0xffd36b, glow: 0xd89a1a, stone: 0x8a7550, ink: '#fff1c6', ground: '#3d2e12' },
    { road: 3, name: 'SPADE KINGDOM', shapes: () => spadeShapes(1.6), colour: 0xb9a6ff, glow: 0x6a4bd8, stone: 0x3a3352, ink: '#e6ddff', ground: '#1e1a33' },
  ];
  for (const k of MINIMAL) {
    const gate = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: k.stone, roughness: 0.9, flatShading: true });
    const glow = new THREE.MeshStandardMaterial({ color: k.colour, emissive: k.glow, emissiveIntensity: 1.2, roughness: 0.4 });
    const half = 3.6;
    for (const side of [-1, 1]) {
      const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.7, 10, 4), stone); // 4 m sunk for slopes
      obelisk.position.set(side * half, 1, 0);
      obelisk.rotation.y = Math.PI / 4;
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), glow);
      tip.position.set(side * half, 6.25, 0);
      gate.add(obelisk, tip);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2 * half + 0.8, 0.35, 0.5), stone);
    lintel.position.y = 4.9;
    const sign = plaque([k.name], { width: 5, ink: k.ink, ground: k.ground, edge: `#${k.colour.toString(16).padStart(6, '0')}`, height: 0.8 });
    sign.position.y = 4.25;
    const emblem = new THREE.Mesh(extrude(k.shapes(), 0.25), glow);
    emblem.position.y = 6.3;
    gate.add(lintel, sign, emblem);
    animated.push({ object: emblem, spin: 0.6, bob: 0.12 });
    for (const object of gate.children) object.castShadow = true;
    const at = trailPoint(world.noise, k.road, world.kingdomStart - 6);
    place(gate, k.name, at.x, at.z, half, 0.75);
  }
  onReady?.(root);

  let time = 0;
  const baseY = new Map(animated.map(a => [a.object, a.object.position.y]));
  return {
    root, colliders,
    gates: gates.map(({ name, x, z }) => ({ name, x, z })), // Clover, Heart, Diamond, Spade
    update(dt) {
      time += dt;
      for (const g of gates) g.group.position.y = world.terrainHeight(g.x, g.z); // chaos moves the ground
      for (const a of animated) {
        if (a.spin) a.object.rotation.y = time * a.spin;
        if (a.bob) a.object.position.y = baseY.get(a.object) + Math.sin(time * 1.6 + (a.phase || 0)) * a.bob;
        if (a.sway) a.object.rotation.x = Math.sin(time * 1.3 + a.phase) * a.sway;
      }
    }
  };
}
