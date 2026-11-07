import { spadeOutline } from '../models/spade.js';
import { cloverShapes } from './kingdomGates.js';

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
  const s = new THREE.Shape(); s.moveTo(0, 1); s.lineTo(.62, .25); s.lineTo(0, -1); s.lineTo(-.62, .25); s.lineTo(0, 1);
  return s;
}
// Extrude, centre and scale so the emblem is `size` tall.
function emblem(shapes, size, depth) {
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: true, bevelThickness: .25, bevelSize: .12, bevelSegments: 2, curveSegments: 14 });
  geometry.computeBoundingBox(); const box = geometry.boundingBox, k = size / (box.max.y - box.min.y);
  return geometry.center().scale(k, k, depth / (box.max.z - box.min.z));
}

// kind: 'lantern' | 'root' | 'tide' | 'prism'. Returns a Group with tick(dt) for its idle motion;
// `size` is the emblem's height in metres.
export function createSigil(kind, size = .7) {
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
  for (let i = 0; i < 3; i++) {
    const bead = new THREE.Mesh(new THREE.OctahedronGeometry(size * .06), core), a = i / 3 * Math.PI * 2;
    bead.position.set(Math.cos(a) * size * .78, Math.sin(a) * size * .78, 0); orbit.add(bead);
  }
  let time = Math.random() * 10;
  group.userData.tick = dt => {
    time += dt; spin.rotation.y += dt * .9; orbit.rotation.z += dt * 1.6;
    spin.position.y = Math.sin(time * 1.8) * size * .06;
  };
  return group;
}
