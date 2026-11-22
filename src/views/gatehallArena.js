import { createPerson } from '../rendering/person.js';
import { createBeam } from '../controllers/flashback.js';
import { createMorcantFight, MORCANT_FIGHT } from '../models/morcantFight.js';
import { createArenaHud, createBursts, createFlash } from './citadelArena.js';
import { createSigilBlade } from '../rendering/sigilBlade.js';
import { createGrimoireBook } from './grimoireReveal.js';
import { SPELL_INK } from '../models/grimoireSpells.js';
import { voice as recorded } from './voice.js';
import { settings } from '../models/settings.js';

// The Gatehall: Morcant's own pocket hall, a sealed drum hung in the void. Not Sile's open mesa:
// a closed charcoal drum ringed by eight bone gate-frames, gold inlay on the floor, four bone pillars
// that feed his armour, and the Hollow Gate's great ring turning overhead. His own gate is the far frame.
// Draws models/morcantFight.js: his bone magic (spears from gates, spiders, the spike lane, the claw, the jaw)
// and the traveller's runes (gale, flame lance, tide ward, stone wall). Primitives only, plus the existing
// Morcant person; nothing new downloads. Lives in the movement lab for now (views/movementLab.js).
export const GATEHALL = { radius: 16, wall: 12 };
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const GOLD = 0xe8b04a, VIOLET = 0x7a3cff, BONE = 0xe9e0cc, CHARCOAL = 0x2b2833, FLAME = 0xff8a2a, CRIMSON = 0xff3355, TIDE = 0x5fc8ff;
const FOG = new THREE.Color(0x1a1226), FOG_CHAOS = new THREE.Color(0x3a0f1c);
const M = MORCANT_FIGHT;
const FORGE_AT = 9.8; // ending time the camera cuts to the traveller for the sigil-blade's forging
// The forging, in seconds after the forge event (ending time 10): four rune lights spiral in, the blade forms with a
// flash, hovers point-down while Sera speaks, then flies to the traveller's back.
const FORGE = { start: 10 };
const FORGE_BACK = 17; // the camera moves behind the traveller to see the sheath and the blade arrive
const EYE_Y = 3.4; // height of the black eye in his portal's swirl
// A gate's opening: straight sides up to h, then a half-circle, in the frame's own coordinates (x across, y up).
function archShape(half, h) { const s = new THREE.Shape(); s.moveTo(-half, 0); s.lineTo(half, 0); s.lineTo(half, h); s.absarc(0, h, half, 0, Math.PI, false); s.lineTo(-half, 0); return s; }
// His portal: a log-spiral swirl with a black eye, filling the arch. Opaque, so whatever is behind it stays hidden until it
// steps through. uShow 0 is a sleeping gate (dull violet); 1 is fully open.
function createArchPortal(half, h) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uShow: { value: 0 }, uEye: { value: EYE_Y } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime, uShow, uEye; varying vec2 vP;
      void main() {
        vec2 p = vP - vec2(0.0, uEye); float r = length(p), a = atan(p.y, p.x);
        float arm = 0.5 + 0.5 * sin(a * 3.0 - log(r + 0.3) * 5.0 + uTime * 2.2);   // three arms spiralling in
        float lit = smoothstep(0.35, 1.0, arm);
        vec3 deep = vec3(0.10, 0.03, 0.25), pink = vec3(0.95, 0.25, 0.65), hot = vec3(1.0, 0.55, 0.25);
        vec3 col = mix(deep, mix(pink, hot, smoothstep(0.75, 1.0, arm)), lit * (0.25 + 0.75 * smoothstep(8.0, 1.5, r)));
        float eye = 1.0 - smoothstep(0.6 + uShow * 1.4, 1.4 + uShow * 2.6, r);   // the black eye
        float floorDark = 1.0 - smoothstep(uEye * 0.9, uEye + 1.8, vP.y);        // solid black from the floor up past his head
        col = mix(col, vec3(0.0), max(eye, floorDark) * uShow);
        gl_FragColor = vec4(mix(vec3(0.12, 0.05, 0.28), col, uShow), 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.ShapeGeometry(archShape(half, h), 24), material);
}

/** center: {x, z} of the hall in the world; floor: its walkable height; toast(text, ms).
 *  obstacles: the caller's camera-blocker group (gets an invisible copy of the drum wall). */
export function createGatehall({ scene, center, floor, toast = () => {}, obstacles = null }) {
  const T = THREE, R = GATEHALL.radius, C = { x: center.x, z: center.z }, group = new T.Group(); group.visible = false; scene.add(group);
  group.name = 'Morcant’s Gatehall';
  const at = (a, r) => ({ x: C.x + Math.sin(a) * r, z: C.z + Math.cos(a) * r }); // angle 0 faces the entry (+z)
  const entry = { x: C.x, z: C.z + 11, top: floor, yaw: 0 };
  const pillarAt = [at(.785, 9.5), at(-.785, 9.5), at(2.356, 9.5), at(-2.356, 9.5)];
  const fight = createMorcantFight({ center: C, floor, radius: R, pylons: pillarAt });
  // Known up front: the controller indexes colliders once. The ring keeps everyone inside.
  const colliders = [];
  for (let i = 0, n = Math.ceil(Math.PI * 2 * (R + .5) / 1.1); i < n; i++) { const p = at(i / n * Math.PI * 2, R + .5); colliders.push({ x: p.x, z: p.z, radius: .8, minY: floor - 3 }); }
  for (const p of pillarAt) colliders.push({ x: p.x, z: p.z, radius: .8, minY: floor - 3 });
  const platforms = [{ name: 'gatehall-floor', x: C.x, z: C.z, top: floor, bottom: floor - 1, solid: false,
    contains: (x, z, pad = 0) => group.visible && Math.hypot(x - C.x, z - C.z) < R + 1 + pad }]; // only while the hall exists

  let built = false, morcant = null, aura, shieldMesh, fists = [], pillars = [], portal, bursts, flash, overhead, voice = null, hud = null;
  let spearGates = [], spearPool = [], spiderPool = [], spikePool = [], lane, groveMarks = [], claw, jaw, lancePool = [], wallPool = [], ward, gale, lanceLight;
  let lastPose = '', shake = 0, saved = null, haveShot = false, exitCam = null, baseFov = null;
  const camPos = new T.Vector3(), camLook = new T.Vector3(), chest = new T.Vector3(), look = new T.Vector3();
  const daylight = []; // the page's sun and sky light, dimmed inside the void

  function build() {
    if (built) return; built = true;
    const std = (color, extra = {}) => new T.MeshStandardMaterial({ color: lin(color), roughness: .85, flatShading: true, ...extra });
    const glow = (color, opacity = 1, extra = {}) => new T.MeshBasicMaterial({ color: lin(color), transparent: true, opacity, depthWrite: false, toneMapped: false, side: T.DoubleSide, ...extra });
    const add = (geometry, material, x, y, z, parent = group) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m; };
    const charcoal = std(CHARCOAL), bone = std(BONE, { roughness: .7 }), gold = std(GOLD, { metalness: .6, roughness: .35, emissive: lin(GOLD), emissiveIntensity: .15 });
    // Floor: a charcoal drum top with gold inlay rings and eight spokes running to the gates.
    add(new T.CylinderGeometry(R + 1.6, R + 1, 2, 48), charcoal, C.x, floor - 1, C.z).receiveShadow = true;
    for (const r of [5, 10, 14]) add(new T.RingGeometry(r - .14, r, 64), glow(GOLD, .7), C.x, floor + .02, C.z).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, mid = at(a, 9.5); add(new T.PlaneGeometry(.12, 9), glow(GOLD, .45), mid.x, floor + .02, mid.z).rotation.set(-Math.PI / 2, 0, a); }
    // The drum wall, and eight bone gate-frames set into it, each a sleeping void. His is the far one, in gold.
    const wall = add(new T.CylinderGeometry(R + 1.5, R + 1.5, GATEHALL.wall, 48, 1, true), std(0x332e3d, { side: T.BackSide }), C.x, floor + GATEHALL.wall / 2, C.z);
    if (obstacles) { const blocker = wall.clone(); blocker.visible = false; obstacles.add(blocker); } // camera collision only: raycasts ignore visibility
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, p = at(a, R + 1.2), big = i === 4, w = big ? 3.4 : 2.2, h = big ? 8.5 : 6.5;
      const frame = new T.Group(); frame.position.set(p.x, floor, p.z); frame.rotation.y = a + Math.PI; group.add(frame);
      for (const k of [-1, 1]) add(new T.BoxGeometry(.7, h, .7), big ? gold : bone, k * w, h / 2, 0, frame);
      add(new T.TorusGeometry(w, .35, 6, 20, Math.PI), big ? gold : bone, 0, h, 0, frame);
      if (big) { portal = createArchPortal(w - .35, h); portal.position.z = .05; frame.add(portal); } // his gate: the portal fills the arch exactly
      else add(new T.ShapeGeometry(archShape(w - .35, h), 16), glow(VIOLET, .22), 0, 0, .05, frame);
      for (let r = 0; r < 3; r++) add(new T.BoxGeometry(.9, .18, .9), big ? bone : gold, (r % 2 ? 1 : -1) * w, 1.2 + r * 1.9, 0, frame);
    }
    // Overhead: the Hollow Gate's ring turning in the void, chained to the wall top.
    overhead = add(new T.TorusGeometry(13, .5, 8, 64), gold, C.x, floor + 26, C.z); overhead.rotation.x = Math.PI / 2;
    add(new T.TorusGeometry(9, .2, 6, 48), glow(VIOLET, .6), 0, 0, 0, overhead);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, top = at(a, R + 1.2), ring = at(a, 13), from = new T.Vector3(top.x, floor + GATEHALL.wall, top.z), to = new T.Vector3(ring.x, floor + 26, ring.z);
      const chain = add(new T.CylinderGeometry(.08, .08, from.distanceTo(to), 5), std(0x6b5a3a, { metalness: .5 }), (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      chain.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    }
    // Four bone pillars: stacked vertebrae with spurs and a gold core. Beams run from each to his core.
    for (const p of pillarAt) {
      const body = new T.Group(); body.position.set(p.x, floor, p.z); group.add(body);
      for (let k = 0; k < 6; k++) {
        add(new T.CylinderGeometry(.42 - k * .03, .5 - k * .03, .55, 8), bone, 0, .3 + k * .7, 0, body);
        add(new T.CylinderGeometry(.3, .3, .18, 8), std(0xb7a98c), 0, .66 + k * .7, 0, body);
        const spur = add(new T.ConeGeometry(.12, .9, 5), bone, Math.sin(k * 2.1) * .5, .4 + k * .7, Math.cos(k * 2.1) * .5, body); spur.rotation.set(Math.cos(k * 2.1) * 1.1, 0, -Math.sin(k * 2.1) * 1.1);
      }
      const core = add(new T.OctahedronGeometry(.5, 0), new T.MeshStandardMaterial({ color: lin(GOLD), emissive: lin(GOLD), emissiveIntensity: 1.4, flatShading: true }), p.x, floor + 4.9, p.z);
      core.scale.y = 1.5;
      pillars.push({ body, core, beam: createBeam(group, GOLD, .08), at: new T.Vector3(p.x, floor + 4.9, p.z) });
    }
    // Light: gold from the ring, violet from his gate.
    const sky = new T.HemisphereLight(lin(0xb8a0ff), lin(0x2a1f18), .55); group.add(sky);
    const top = new T.PointLight(lin(GOLD), 1.3, 46, 1.4); top.position.set(C.x, floor + 14, C.z); group.add(top);
    const gateLight = new T.PointLight(lin(VIOLET), .8, 30, 1.5); gateLight.position.set(fight.gateAt.x, floor + 5, fight.gateAt.z + 2); group.add(gateLight);
    // Morcant: the people-kit warden, scaled up for weight. Gate rings orbit his fists.
    morcant = createPerson({ name: 'morcant' }); morcant.root.scale.setScalar(1.3); group.add(morcant.root);
    for (const k of [-1, 1]) {
      const ring = new T.Mesh(new T.TorusGeometry(.26, .045, 6, 24), glow(GOLD, .95)); ring.position.set(k * .5, 1.0, .3); morcant.root.add(ring); fists.push(ring);
      ring.add(new T.Mesh(new T.CircleGeometry(.22, 20), glow(0x120a22, .9)));
    }
    aura = add(new T.SphereGeometry(1.5, 16, 12), new T.MeshBasicMaterial({ color: lin(GOLD), transparent: true, opacity: .07, side: T.BackSide, depthWrite: false }), 0, 0, 0);
    shieldMesh = add(new T.IcosahedronGeometry(2.1, 1), new T.MeshBasicMaterial({ color: lin(BONE), wireframe: true, transparent: true, opacity: .4, depthWrite: false }), 0, 0, 0);
    // --- His bone magic ---
    const smallGate = () => { const g = new T.Group(); g.add(new T.Mesh(new T.TorusGeometry(.6, .06, 6, 28), glow(GOLD, .95)), new T.Mesh(new T.CircleGeometry(.56, 24), glow(0x120a22, .92))); g.visible = false; group.add(g); return g; };
    for (let i = 0; i < 3; i++) spearGates.push(smallGate());
    for (let i = 0; i < 6; i++) { const s = add(new T.ConeGeometry(.16, 2.4, 6), bone, 0, 0, 0); s.geometry.rotateX(Math.PI / 2); s.visible = false; spearPool.push(s); } // points along +z
    for (let i = 0; i < 2; i++) spiderPool.push(makeSpider(bone, std(0x8f8268)));
    for (let i = 0; i < 32; i++) { const s = add(new T.ConeGeometry(.42, 2.8, 6), bone, 0, 0, 0); s.visible = false; s.castShadow = true; spikePool.push(s); }
    lane = add(new T.PlaneGeometry(2.2, 1), glow(BONE, 0), 0, 0, 0); lane.geometry.rotateX(-Math.PI / 2); lane.geometry.translate(0, 0, .5);
    for (let i = 0; i < 3; i++) { const g = add(new T.RingGeometry(M.grove.radius - .15, M.grove.radius, 40), glow(BONE, 0), 0, 0, 0); g.rotation.x = -Math.PI / 2; groveMarks.push(g); }
    claw = makeClaw(bone, smallGate);
    jaw = new T.Group(); group.add(jaw); jaw.visible = false;
    add(new T.CircleGeometry(M.maw.radius, 40), glow(0x120a22, .85), 0, 0, 0, jaw).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, t = add(new T.ConeGeometry(.2, 1.3, 5), bone, Math.sin(a) * M.maw.radius, 0, Math.cos(a) * M.maw.radius, jaw); t.userData.a = a; }
    // --- The traveller's runes ---
    for (let i = 0; i < 6; i++) {
      const l = new T.Group(); l.visible = false; group.add(l);
      l.add(new T.Mesh(new T.SphereGeometry(.28, 12, 8), glow(0xfff1c0)), new T.Mesh(new T.SphereGeometry(.6, 12, 8), glow(FLAME, .45, { blending: T.AdditiveBlending })));
      const tail = new T.Mesh(new T.ConeGeometry(.45, 2.2, 10), glow(FLAME, .35, { blending: T.AdditiveBlending })); tail.geometry.rotateX(-Math.PI / 2); tail.geometry.translate(0, 0, -1.2); l.add(tail);
      lancePool.push(l);
    }
    lanceLight = new T.PointLight(lin(FLAME), 0, 10); group.add(lanceLight);
    for (let i = 0; i < 1; i++) { // a jagged row of five rocks, low enough to see over
      const w = new T.Group(); w.visible = false; group.add(w); const rock = std(0x8a7f6c);
      for (let r = 0; r < 5; r++) { const h = 1.4 + ((r * 7) % 5) * .14, m = add(new T.DodecahedronGeometry(.62, 0), rock, (r - 2) * .2, h / 2, 0, w); m.scale.set(1.15, h / 1.2, .8); m.rotation.y = r * 1.3; m.castShadow = true; }
      wallPool.push(w);
    }
    ward = add(new T.SphereGeometry(1.5, 20, 14), new T.MeshStandardMaterial({ color: lin(TIDE), emissive: lin(TIDE), emissiveIntensity: .4, transparent: true, opacity: .3, roughness: .1, depthWrite: false }), 0, 0, 0);
    gale = add(new T.RingGeometry(.6, M.spells.wind.range, 32, 1, -Math.PI / 2 - M.spells.wind.arc / 2, M.spells.wind.arc), glow(0xdff6ff, 0), 0, 0, 0); gale.geometry.rotateX(-Math.PI / 2);
    bursts = createBursts(group); flash = createFlash(group);
    scene.traverse(o => { if ((o.isHemisphereLight || o.isDirectionalLight) && o !== sky) daylight.push([o, o.intensity]); });
  }
  // A bone spider: a ribbed abdomen, a skull head with two red eyes, eight jointed legs.
  // A bone spider, built like the real thing: a head-chest (cephalothorax) with eight red eyes, fangs and two small
  // front feelers (pedipalps), a waist, and a big ribbed abdomen with a spine ridge. Eight legs of three segments
  // (femur up, tibia down, tarsus to the floor), so the knees arch above the body. Faces +z.
  // Leg joints are groups whose +z runs along the segment; rotation.x pitches it (negative = up).
  const LEG = { femur: [.95, -.9], tibia: [1.05, 2.05], tarsus: [.55, .32] }; // [length, pitch relative to the previous segment]
  function makeSpider(bone, joint) {
    const T = THREE, g = new T.Group(); g.visible = false; group.add(g);
    const body = new T.Group(); g.add(body); // bobs as it walks
    const mesh = (geo, mat, x, y, z, parent = body) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const segment = (length, r0, r1, mat, parent) => { const geo = new T.CylinderGeometry(r1, r0, length, 6); geo.rotateX(Math.PI / 2); geo.translate(0, 0, length / 2); const m = new T.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
    // Head-chest, with a ridge down its middle.
    mesh(new T.SphereGeometry(.42, 14, 10), bone, 0, .78, .3).scale.set(1, .55, 1.15);
    mesh(new T.BoxGeometry(.06, .08, .6), joint, 0, 1.0, .3);
    // Eyes: two large at the front, six small around them.
    const eye = new T.MeshBasicMaterial({ color: 0xff2030 });
    for (const [x, y, z, r] of [[-.08, .93, .72, .055], [.08, .93, .72, .055], [-.17, .92, .66, .035], [.17, .92, .66, .035], [-.11, 1.0, .64, .03], [.11, 1.0, .64, .03], [-.05, 1.02, .58, .025], [.05, 1.02, .58, .025]]) mesh(new T.SphereGeometry(r, 8, 6), eye, x, y, z);
    // Fangs: thick bases with curved points.
    const fangs = [];
    for (const k of [-1, 1]) {
      const base = new T.Group(); base.position.set(k * .1, .72, .72); body.add(base); fangs.push(base);
      segment(.22, .07, .05, bone, base).rotation.x = .9;
      const point = new T.Mesh(new T.ConeGeometry(.035, .22, 5), joint); point.position.set(0, -.2, .12); point.rotation.set(-.3, 0, -k * .35); base.add(point);
    }
    // Pedipalps: two short feelers that twitch.
    const palps = [];
    for (const k of [-1, 1]) {
      const root = new T.Group(); root.position.set(k * .2, .74, .66); root.rotation.y = k * .35; body.add(root); palps.push(root);
      const a = new T.Group(); a.rotation.x = -.5; root.add(a); segment(.28, .04, .035, bone, a);
      const b = new T.Group(); b.position.z = .28; b.rotation.x = 1.2; a.add(b); segment(.22, .035, .02, bone, b);
    }
    // Waist and abdomen: bone rib bands around a pale core, spines along the top.
    mesh(new T.CylinderGeometry(.09, .09, .25, 6), joint, 0, .85, -.12).rotation.x = Math.PI / 2;
    const abdomen = new T.Group(); abdomen.position.set(0, 1.0, -.82); body.add(abdomen);
    mesh(new T.SphereGeometry(.58, 16, 12), joint, 0, 0, 0, abdomen).scale.set(1, .82, 1.3);
    for (let r = 0; r < 5; r++) { const z = -.55 + r * .27, k = Math.cos(z / .75 * Math.PI / 2);
      const rib = mesh(new T.TorusGeometry(.6 * k, .045, 6, 18), bone, 0, 0, z, abdomen); rib.scale.y = .82; }
    for (let r = 0; r < 4; r++) mesh(new T.ConeGeometry(.05, .26, 5), bone, 0, .5 - r * .03, .35 - r * .25, abdomen).rotation.x = -.5;
    mesh(new T.ConeGeometry(.08, .3, 6), bone, 0, -.05, -.8, abdomen).rotation.x = -Math.PI / 2; // spinnerets
    // Legs: angles from straight ahead on each side; the front pair reaches forward, the back pair trails.
    const legs = [];
    [.55, 1.05, 1.75, 2.35].forEach((angle, n) => {
      for (const side of [-1, 1]) {
        const hip = new T.Group(); hip.position.set(side * Math.sin(angle) * .34, .78, .3 + Math.cos(angle) * .34); hip.rotation.y = side * angle; body.add(hip);
        const femur = new T.Group(); hip.add(femur); segment(LEG.femur[0], .065, .05, bone, femur);
        const knee = new T.Group(); knee.position.z = LEG.femur[0]; femur.add(knee); mesh(new T.SphereGeometry(.07, 8, 6), joint, 0, 0, 0, knee);
        segment(LEG.tibia[0], .05, .035, bone, knee);
        const ankle = new T.Group(); ankle.position.z = LEG.tibia[0]; knee.add(ankle); mesh(new T.SphereGeometry(.045, 6, 5), joint, 0, 0, 0, ankle);
        const tip = new T.Mesh(new T.ConeGeometry(.035, LEG.tarsus[0], 5), bone); tip.geometry.rotateX(Math.PI / 2); tip.geometry.translate(0, 0, LEG.tarsus[0] / 2); tip.castShadow = true; ankle.add(tip);
        // Alternating tetrapod gait: left 1 and 3 with right 2 and 4, then the other four.
        legs.push({ hip, femur, knee, ankle, base: side * angle, side, n, phase: ((n % 2) ^ (side > 0 ? 1 : 0)) ? Math.PI : 0 });
      }
    });
    g.scale.setScalar(.9);
    g.userData = { body, abdomen, legs, fangs, palps };
    return g;
  }
  // Walk, rest and leap. step: gait clock (radians); leap: 0..1 arc of the pounce.
  function poseSpider(g, step, leap, moving, now) {
    const { body, abdomen, legs, fangs, palps } = g.userData;
    body.position.y = moving ? Math.abs(Math.sin(step)) * .05 : Math.sin(now * .003) * .015;
    abdomen.rotation.x = Math.sin(now * .004) * .05 + (moving ? Math.sin(step * 2) * .04 : 0);
    for (const leg of legs) {
      const c = step + leg.phase, swing = moving ? Math.sin(c) * .3 : 0, lift = moving ? Math.max(0, Math.cos(c)) : 0;
      const front = leg.n === 0 ? leap : 0; // the front legs rear up for the pounce
      leg.hip.rotation.y = leg.base + swing * leg.side;
      leg.femur.rotation.x = LEG.femur[1] - lift * .35 - front * .9 - leap * .2;
      leg.knee.rotation.x = LEG.tibia[1] - lift * .25 + front * .4;
      leg.ankle.rotation.x = LEG.tarsus[1];
    }
    for (const f of fangs) f.rotation.x = -.2 - leap * .5 + Math.sin(now * .02) * .05;
    palps.forEach((p, i) => { p.rotation.x = Math.sin(now * .011 + i * 2) * .25 - leap * .4; });
  }
  // The claw: a gate behind the traveller, and a bone forearm with three talons that reaches out and sweeps.
  function makeClaw(bone, smallGate) {
    const g = new THREE.Group(); g.visible = false; group.add(g);
    const gate = smallGate(); group.remove(gate); gate.visible = true; gate.scale.setScalar(2.6); gate.position.y = 1.6; g.add(gate);
    const arm = new THREE.Group(); arm.position.y = 1.6; g.add(arm);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, 3, 7), bone); fore.geometry.rotateX(Math.PI / 2); fore.geometry.translate(0, 0, 1.5); arm.add(fore);
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(.12, 1.4, 5), bone); t.geometry.rotateX(Math.PI / 2); t.position.set((i - 1) * .3, -.1, 3.4); t.rotation.y = (i - 1) * .35; arm.add(t); }
    g.userData = { gate, arm }; return g;
  }

  // ---- sound: a deep spoken voice, a rumble, bone cracks, a metal clang, spell sounds (Web Audio, no files) ----
  function createVoice() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ctx = new AC(), dest = ctx.createGain(); dest.connect(ctx.destination); // dest: the effects setting
    const tone = (type, f0, f1, len, gain, delay = 0) => {
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + len); o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + .02);
    };
    return {
      resume() { dest.gain.value = settings.get('effects'); ctx.resume?.(); },
      rumble() { tone('sine', 46, 28, 2.8, .8); },
      clang() { for (const [f, d] of [[880, 0], [1320, .01], [520, .02]]) tone('square', f, f * .96, 1.1, .12, d); tone('sine', 70, 40, .6, .7); },
      crack() { tone('square', 1400, 300, .06, .25); tone('triangle', 180, 60, .18, .3, .01); },
      whoosh(f = 300) { tone('sawtooth', f, f * 3, .25, .12); },
      hit(pitch = 1) { tone('triangle', 520 * pitch, 120 * pitch, .16, .4); },
      say(text) { // his recorded line (and Sera's), after any line still playing (never cut off); speech voice only without a recording
        if (recorded.say(text, { next: true }) || !window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text), voices = speechSynthesis.getVoices();
        u.voice = voices.find(v => /david|guy|mark|george|daniel|male/i.test(v.name) && !/female/i.test(v.name)) || null; u.pitch = .55; u.rate = .82; u.volume = 1;
        speechSynthesis.speak(u);
      },
    };
  }

  function handle(events, io) {
    const m = morcant.root.position;
    for (const e of events) {
      const spot = e.x !== undefined ? { x: e.x, y: e.y ?? floor + .5, z: e.z } : m;
      if (e.type === 'rumble') { voice?.rumble(); shake = Math.max(shake, .3); }
      else if (e.type === 'clang') { voice?.clang(); shake = Math.max(shake, .2); bursts.at(chest, GOLD, 0, 24); }
      else if (e.type === 'line') voice?.say(e.text);
      else if (e.type === 'fight') toast('MORCANT THE GATEKEEPER');
      else if (e.type === 'blocked') { toast(e.kind === 'spear' ? 'SPEAR CAUGHT +CHARGE' : 'WARDED +CHARGE'); bursts.at(io.player, TIDE); voice?.hit(1.4); }
      else if (e.type === 'dodged') { toast('DODGED +CHARGE'); bursts.at(io.player, 0x5fb8e8); voice?.hit(1.4); }
      else if (e.type === 'wardBreak') toast('THE WARD BREAKS');
      else if (e.type === 'playerHit') { toast({ forest: 'IMPALED', grove: 'IMPALED', maw: 'THE JAW BITES', bite: 'BITTEN', claw: 'CLAWED' }[e.kind] || 'HIT'); shake = Math.max(shake, .16); bursts.at(io.player, 0xe0553a); voice?.hit(.6); }
      else if (e.type === 'spike') { voice?.crack(); shake = Math.max(shake, .05); }
      else if (e.type === 'grove' || e.type === 'maw') { voice?.crack(); shake = Math.max(shake, .25); bursts.at(spot, BONE, 0, 20); }
      else if (e.type === 'claw') { voice?.whoosh(120); shake = Math.max(shake, .2); }
      else if (e.type === 'spider') { toast('A BONE SPIDER CLIMBS OUT'); voice?.crack(); }
      else if (e.type === 'spiderShattered' || e.type === 'spearShattered') { toast(e.type === 'spiderShattered' ? 'SPIDER SHATTERED +CHARGE' : 'SPEAR SHATTERED +CHARGE'); bursts.at(spot, BONE, .5, 22); voice?.crack(); }
      else if (e.type === 'spiderCrumble') bursts.at(spot, BONE, .3, 12);
      else if (e.type === 'wallStop') { toast('THE WALL HOLDS +CHARGE'); bursts.at(spot, 0xb7a98c, .8, 16); voice?.crack(); }
      else if (e.type === 'staggered') { toast('STAGGERED · FLAME LANCE NOW'); bursts.at(m, 0xdff6ff, 1.5, 20); }
      else if (e.type === 'open') { toast('OPEN · BURN HIM'); voice?.hit(1.6); }
      else if (e.type === 'pushback') io.push?.(e.from);
      else if (e.type === 'cast') { const r = e.rune; voice?.whoosh(r === 'wind' ? 500 : r === 'flame' ? 220 : r === 'tide' ? 340 : 90); if (r === 'earth') shake = Math.max(shake, .15); }
      else if (e.type === 'cooling') toast('THAT SPELL IS STILL COOLING');
      else if (e.type === 'deflect') { toast(fight.phase === 'seal' ? 'HIS ARMOUR HOLDS · BURN THE PILLARS' : 'DEFLECTED'); bursts.at(spot, FLAME, 0, 10); }
      else if (e.type === 'strike') { bursts.at(m, e.chaos ? CRIMSON : FLAME, 1.6, 20); shake = Math.max(shake, .1); voice?.hit(e.chaos ? .8 : 1.1); }
      else if (e.type === 'needChaos') { toast('THE BONE WON’T BURN · ENTER CHAOS (G)'); bursts.at(pillars[e.index].at, FLAME, -2, 8); }
      else if (e.type === 'crack') { toast('PILLAR SCORCHED'); bursts.at(pillars[e.index].at, CRIMSON, -1.5, 18); voice?.crack(); }
      else if (e.type === 'pillarBroken') { toast('PILLAR BURNED THROUGH'); bursts.at(pillars[e.index].at, BONE, -1, 30); shake = Math.max(shake, .2); voice?.crack(); }
      else if (e.type === 'shieldShatter') { toast('HIS ARMOUR SHATTERS'); bursts.at(m, BONE, 1.5, 40); shake = .35; }
      else if (e.type === 'reseal') { toast('A PILLAR REGROWS'); bursts.at(pillars[e.index].at, GOLD, 0, 24); }
      else if (e.type === 'land') { shake = .4; voice?.crack(); bursts.at(m, GOLD, 0, 30); }
      else if (e.type === 'chaos') toast('CHAOS · YOUR RUNES BURN CRIMSON');
      else if (e.type === 'calm') toast(e.knocked ? 'KNOCKED BACK TO CALM' : 'CALM');
      else if (e.type === 'noCharge') toast('NO CHARGE · WARD, WALL, ROLL OR SHATTER SOMETHING FIRST');
      else if (e.type === 'down') { toast('YOU FALL… TRY AGAIN'); io.onDown?.(); }
      else if (e.type === 'done') toast('MORCANT RETREATS · THE TRIAD STILL STANDS');
      else if (e.type === 'forge') { toast('THE GRIMOIRE FORGES THE SIGIL-BLADE'); voice?.clang(); }
      else if (e.type === 'gateFlash') { flash.fire({ x: fight.gateAt.x, y: floor + 4.6, z: fight.gateAt.z }); hud.flash(); shake = Math.max(shake, .3); voice?.rumble(); }
    }
  }

  function playPose(pose) {
    if (pose === lastPose) return; lastPose = pose;
    const clip = { walk: 'Walk_Loop', exit: 'Walk_Loop', talk: 'Idle_Talking_Loop', cast: 'Spell_Simple_Shoot', reach: 'Spell_Simple_Shoot', flinch: 'Hit_Chest',
      open: 'Hit_Knockback', kneel: 'Crouch_Idle_Loop', stomp: 'Spell_Simple_Idle_Loop', leap: 'Jump_ToIdle', clang: 'Spell_Simple_Shoot' }[pose] || 'Idle_FoldArms_Loop';
    morcant.play(clip, .2, ['cast', 'flinch', 'open', 'clang'].includes(pose));
    morcant.setExpression({ talk: 'determined', open: 'surprised', flinch: 'hurt', kneel: 'hurt', stomp: 'shout', reach: 'effort', cast: 'focus' }[pose] || 'determined', 1.2);
  }
  const place = (mesh, x, y, z) => mesh.position.set(x, y, z);
  // The forging (seconds after the forge event at ending time 10). The grimoire appears and opens flat before the
  // traveller; the four spells rise out of it as streams of wind; its pages turn into the Hollow Gate's black void,
  // which drips black onto the floor; the sigil-blade rises slowly out of the void, pommel first; a sheath grows on the
  // traveller's back and the blade flies into it; the book closes and fades.
  const forgeSpot = pp => { const g = fight.gateAt, dx = g.x - pp.x, dz = g.z - pp.z, d = Math.hypot(dx, dz) || 1; return { x: pp.x + dx / d * 1.6, y: floor + .95, z: pp.z + dz / d * 1.6, dx: dx / d, dz: dz / d, yaw: Math.atan2(dx / d, dz / d) }; };
  let forge = null;
  function buildForge() {
    const T = THREE, book = createGrimoireBook(), holder = new T.Group(); book.group.rotation.x = -Math.PI / 2; book.paint(3); holder.add(book.group); holder.visible = false; group.add(holder);
    const blade = createSigilBlade(), clip = new T.Plane(new T.Vector3(0, 1, 0), 0); // the void's surface: the blade below it is unseen
    blade.traverse(o => { if (o.material) o.material.clippingPlanes = [clip]; }); blade.visible = false; group.add(blade);
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, '#fff'); r.addColorStop(.35, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const dot = new T.CanvasTexture(c);
    const streams = ['wind', 'flame', 'earth', 'tide'].map(id => Array.from({ length: 18 }, () => {
      const m = new T.Sprite(new T.SpriteMaterial({ map: dot, color: new T.Color(SPELL_INK[id][1]).convertSRGBToLinear(), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); m.visible = false; group.add(m); return m;
    }));
    const dropMat = new T.MeshStandardMaterial({ color: 0x000000, roughness: .12, metalness: .4 }), dropGeo = new T.SphereGeometry(.022, 10, 8);
    const drops = Array.from({ length: 36 }, () => { const m = new T.Mesh(dropGeo, dropMat); m.visible = false; group.add(m); return { m, v: 0, hang: 0, live: false }; });
    const puddle = new T.Mesh(new T.CircleGeometry(.55, 32), new T.MeshStandardMaterial({ color: 0x000000, roughness: .08, metalness: .5 })); puddle.rotation.x = -Math.PI / 2; puddle.visible = false; group.add(puddle);
    return { book, holder, blade, clip, streams, drops, puddle, nextDrop: 0, splashes: 0 };
  }
  const BOOK_SCALE = 1.15; // the open book clears the traveller's knees at this distance
  const F2 = { appear: .8, open: [.8, 1.8], streams: [1.6, 6.4], void: [2.4, 3.6], rise: [3.6, 6.8], sheath: [7.2, 8.0], fly: [7.6, 8.4], close: [8.6, 9.3], gone: 9.8 };
  const forgeK = () => { const s = fight.snapshot(); return s.phase === 'ending' ? s.time - FORGE.start : -1; };
  function forgeStep(s, pp, dt) {
    forge ||= buildForge();
    const k = forgeK(), F = forge, ease = x => x * x * (3 - 2 * x), clamp = x => Math.min(1, Math.max(0, x)), span = ([a, b]) => clamp((k - a) / (b - a));
    const on = k >= 0 && k < F2.gone;
    F.holder.visible = on; F.puddle.visible = on && k > F2.void[0]; F.blade.visible = on && k >= F2.rise[0] && k < F2.fly[1];
    if (!on) { F.streams.flat().forEach(m => { m.visible = false; }); F.drops.forEach(d => { d.m.visible = false; d.live = false; }); F.book.setVoid(0); return; }
    const c = forgeSpot(pp);
    // The book: springs up flat, opens, and later closes and fades away.
    const grow = clamp(k / F2.appear), show = k < F2.close[1] ? 1 + 2.2 * (grow - 1) ** 3 + 1.2 * (grow - 1) ** 2 : 1 - ease(clamp((k - F2.close[1]) / (F2.gone - F2.close[1])));
    F.holder.position.set(c.x, c.y + Math.sin(k * 1.5) * .01, c.z); F.holder.rotation.y = c.yaw + Math.PI; F.holder.scale.setScalar(Math.max(.001, show * BOOK_SCALE));
    F.book.setOpen(ease(span(F2.open)) * (1 - ease(span(F2.close))), 0);
    const voidK = ease(span(F2.void)) * (1 - ease(span(F2.close)));
    F.book.setVoid(voidK, dt);
    // The four spells rise as streams of wind, circle the book, then pour into the blade as it rises.
    const q = ease(clamp((k - 4.6) / 1.6)), fade = 1 - clamp((k - 5.8) / .6);
    F.streams.forEach((trail, i) => trail.forEach((m, j) => {
      const tau = k - F2.streams[0] - j * .04; m.visible = tau > 0 && fade > 0; if (!m.visible) return;
      const r = (.12 + .38 * Math.min(1, tau / 1.2)) * (1 - q * .9), h = Math.min(tau * .8, 1) * (1 - q) + q * .7, a = i * Math.PI / 2 + tau * 4.2;
      m.position.set(c.x + Math.cos(a) * r, c.y + .05 + h, c.z + Math.sin(a) * r); m.scale.setScalar(.16 * (1 - j / 18)); m.material.opacity = (1 - j / 18) * fade;
    }));
    // The void drips: black drops swell on the book's edges, let go, fall and splash into a growing pool.
    if (voidK > .5 && k < F2.close[0] && (F.nextDrop -= dt) <= 0) {
      F.nextDrop = .05 + Math.random() * .08; const d = F.drops.find(x => !x.live);
      if (d) {
        const W2 = .5 * BOOK_SCALE, H2 = .34 * BOOK_SCALE, side = Math.floor(Math.random() * 4), t = Math.random() * 2 - 1;
        const lx = side < 2 ? (side ? W2 : -W2) : t * W2, lz = side < 2 ? t * H2 : (side === 2 ? H2 : -H2);
        const ca = Math.cos(F.holder.rotation.y), sa = Math.sin(F.holder.rotation.y);
        d.m.position.set(c.x + lx * ca + lz * sa, c.y - .02, c.z - lx * sa + lz * ca); d.v = 0; d.hang = .25 + Math.random() * .3; d.live = true; d.m.visible = true; d.m.scale.set(.3, .3, .3);
      }
    }
    for (const d of F.drops) {
      if (!d.live) continue;
      if (d.hang > 0) { d.hang -= dt; const g = 1 - Math.max(0, d.hang) / .5; d.m.scale.set(.6 + .4 * g, .6 + 1.2 * g, .6 + .4 * g); continue; } // swelling, stretching
      d.v += 9.8 * dt; d.m.position.y -= d.v * dt; d.m.scale.set(.8, 1.9, .8);
      if (d.m.position.y <= floor + .02) { d.live = false; d.m.visible = false; F.splashes++; } // each drop feeds the pool
    }
    F.puddle.position.set(c.x, floor + .012, c.z); F.puddle.scale.setScalar(Math.min(1.25, .2 + F.splashes * .03) * (1 - ease(clamp((k - F2.close[1]) / (F2.gone - F2.close[1])))));
    // The blade rises out of the void, pommel first and slowly, then flies to the traveller's back.
    const SCALE = 1.4, rise = ease(span(F2.rise)), fly = ease(span(F2.fly));
    F.clip.constant = -(c.y + .006); // keep only what is above the page
    const backX = pp.x - c.dx * .3, backZ = pp.z - c.dz * .3, hoverY = c.y - .16 + rise * (1.06 * SCALE + .25);
    F.blade.position.set(c.x + (backX - c.x) * fly, hoverY + (pp.y - .55 - hoverY) * fly + (rise >= 1 ? Math.sin(k * 2) * .03 : 0), c.z + (backZ - c.z) * fly);
    F.blade.rotation.set(0, c.yaw + k * .45 + fly * 2, Math.PI); F.blade.scale.setScalar(SCALE * (1 - fly * .55));
    if (fly > 0) F.clip.constant = 99; // free of the page now
    F.blade.userData.setGlow(rise < 1 ? 1 : Math.max(.4, 1 - (k - F2.rise[1]) / 1.2));
    if (k - dt < F2.rise[0] && k >= F2.rise[0]) { bursts.at({ x: c.x, y: c.y + .05, z: c.z }, 0x6a2cff, 0, 24); shake = Math.max(shake, .12); voice?.rumble(); }
    if (k - dt < F2.sheath[0] && k >= F2.sheath[0]) bursts.at({ x: pp.x - c.dx * .25, y: pp.y - .5, z: pp.z - c.dz * .25 }, GOLD, 0, 30);
    if (k - dt < F2.fly[1] && k >= F2.fly[1]) { bursts.at({ x: pp.x - c.dx * .25, y: pp.y - .4, z: pp.z - c.dz * .25 }, 0xfff0b8, 0, 30); voice?.clang(); shake = Math.max(shake, .1); }
  }

  return {
    fight, entry, colliders, platforms, group,
    get active() { return fight.active; }, get cinematic() { return fight.cinematic; }, get chaos() { return fight.chaos; },
    get done() { return fight.phase === 'done'; },
    /** The traveller's sword and sheath during the Gatehall: no blade before it is forged; the sheath grows in, then the blade lands. */
    get forgeShow() { if (!fight.active) return { sword: true, sheath: 1 }; const k = forgeK(); return { sword: k >= F2.fly[1], sheath: k < 0 ? 0 : Math.min(1, Math.max(0, (k - F2.sheath[0]) / (F2.sheath[1] - F2.sheath[0]))) }; }, get targets() { return fight.targets; },
    /** Seconds of cooldown left per rune, and each rune's full cooldown, for the rune bar. */
    get runes() { const s = fight.snapshot(); return { cooldown: s.cooldown, max: s.cooldownMax, chaos: s.chaos }; },
    begin(charge = 0) {
      build(); hud ||= createArenaHud(document); group.visible = true; voice ||= createVoice(); voice?.resume(); recorded.preload('morcant-fight'); fight.start(charge); lastPose = ''; haveShot = false;
      const label = document.querySelector('#bossBar span');
      saved = { fog: scene.fog.color.clone(), background: scene.background?.isColor ? scene.background.clone() : null, label: label?.textContent };
      if (label) label.textContent = 'MORCANT THE GATEKEEPER';
      hud.show(true);
    },
    exit() {
      fight.stop(); group.visible = false; hud?.show(false); window.speechSynthesis?.cancel(); recorded.stop(); recorded.release('morcant-fight');
      for (const [light, base] of daylight) light.intensity = base;
      if (!saved) return; // put the page's sky and the shared HUD's name back
      scene.fog.color.copy(saved.fog); if (saved.background) scene.background.copy(saved.background);
      const label = document.querySelector('#bossBar span'); if (label && saved.label) label.textContent = saved.label; saved = null;
    },
    skip() { fight.skip(); window.speechSynthesis?.cancel(); recorded.stop(); },
    /** io: { player, feet, grounded, chaosPress, invulnerable, cast, hurt, push, onDown } */
    step(dt, io) { if (!fight.active) return; fight.update(dt, io); handle(fight.takeEvents(), io); },
    /** Visuals, once per frame. */
    render(dt, now, { camera, player }) {
      if (!built || !group.visible) return;
      const s = fight.snapshot(), p = s.morcant, pp = player.position;
      const k = Math.min(1, dt * 3); scene.fog.color.lerp(s.chaos ? FOG_CHAOS : FOG, k); if (scene.background?.isColor) scene.background.copy(scene.fog.color);
      for (const [light, base] of daylight) light.intensity = base * .35;
      overhead.rotation.z += dt * .12;
      // Morcant.
      morcant.root.visible = s.pose !== 'hidden' && !s.gone;
      // As Sile: full size until the vortex takes him, then gone. The intro is the reverse: he grows out of it.
      // Full size: he walks through the portal, which hides him while he is behind it.
      morcant.root.position.set(p.x, p.y, p.z); morcant.root.rotation.y = p.yaw; morcant.root.scale.setScalar(1.3);
      playPose(s.pose);
      morcant.update(dt, { look: s.pose === 'exit' ? null : look.set(pp.x, pp.y, pp.z), talking: s.pose === 'talk' });
      chest.set(p.x, p.y + 1.9, p.z);
      const a = s.attack, wind = a?.stage === 'windup' ? a.progress : 0;
      fists.forEach((r, i) => { r.rotation.y += dt * (2 + wind * 10) * (i ? 1 : -1); r.scale.setScalar(1 + wind * .8); });
      aura.position.copy(chest); aura.visible = morcant.root.visible; aura.material.opacity = s.chaos ? .12 : .07 + (s.open ? .12 * Math.abs(Math.sin(now * .012)) : 0);
      shieldMesh.visible = morcant.root.visible && (s.shield || (s.phase === 'gate' && !s.open && s.fighting)); shieldMesh.position.copy(chest); shieldMesh.rotation.y += dt * .6;
      shieldMesh.material.opacity = s.shield ? .55 : .18; shieldMesh.scale.setScalar(s.shield ? 1.2 : 1);
      // Spears: gates around the traveller, then bone spears in flight.
      spearGates.forEach((g, i) => { const gt = s.gates[i]; g.visible = Boolean(gt) && !gt.fired; if (g.visible) { place(g, gt.x, gt.y, gt.z); g.scale.setScalar(Math.max(.05, gt.k)); g.lookAt(pp); } });
      spearPool.forEach((m, i) => { const b = s.spears[i]; m.visible = Boolean(b); if (b) { place(m, b.x, b.y, b.z); m.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz); } });
      // Spiders: an alternating gait while running, front legs rearing for the leap.
      spiderPool.forEach((g, i) => {
        const sp = s.spiders[i]; g.visible = Boolean(sp); if (!sp) return;
        const leap = sp.state === 'leap' ? Math.sin(Math.min(1, sp.t / M.spider.leap) * Math.PI) : 0;
        place(g, sp.x, floor + leap * 1.2, sp.z); g.rotation.y = sp.yaw; g.rotation.x = -leap * .35;
        poseSpider(g, now * .016, leap, sp.state === 'run', now);
      });
      // The bone lane: a pale strip that fills, then spikes tearing up along it.
      let used = 0;
      lane.visible = Boolean(s.forest) && s.forest.run < 0;
      if (s.forest) {
        const f = s.forest; place(lane, f.x, floor + .04, f.z); lane.rotation.y = f.yaw; lane.scale.z = f.length; lane.material.opacity = .1 + .45 * f.k * (.7 + .3 * Math.sin(now * .03));
        for (const sp of f.spikes) { const m = spikePool[used++]; if (!m) break; const up = Math.min(1, sp.t / .12), down = Math.max(0, (sp.t - .7) / .4);
          m.visible = down < 1; place(m, sp.x, floor + 1.4 * (up - down) - .2, sp.z); m.rotation.z = Math.sin(sp.x * 3) * .2; }
      }
      groveMarks.forEach((g, i) => { const gv = s.grove[i]; g.visible = Boolean(gv) && !gv.erupted; if (g.visible) { place(g, gv.x, floor + .05, gv.z); g.material.opacity = .3 + .6 * gv.k; } });
      for (const gv of s.grove) if (gv.erupted) for (let j = 0; j < 5; j++) { const m = spikePool[used++]; if (!m) break; const a = j / 5 * Math.PI * 2;
        m.visible = true; place(m, gv.x + Math.sin(a) * (j ? 1.1 : 0), floor + 1.2, gv.z + Math.cos(a) * (j ? 1.1 : 0)); m.rotation.z = j ? Math.sin(a) * .3 : 0; }
      for (; used < spikePool.length; used++) spikePool[used].visible = false;
      // The claw: a gate opens behind the traveller; the arm reaches out over the windup and sweeps.
      claw.visible = Boolean(s.ambush);
      if (s.ambush) {
        const am = s.ambush, face = Math.atan2(pp.x - am.x, pp.z - am.z), arm = claw.userData.arm;
        place(claw, am.x, floor, am.z); claw.rotation.y = face; claw.userData.gate.scale.setScalar(2.6 * Math.min(1, am.k * 1.6));
        arm.scale.z = Math.max(.01, Math.min(1, (am.k - .4) / .6)); arm.rotation.y = am.sweep ? -1.2 + am.sweep * 2.4 : -1.2;
      }
      jaw.visible = Boolean(s.maw);
      if (s.maw) { const kk = Math.min(1, s.maw.k); place(jaw, s.maw.x, floor + .03, s.maw.z); jaw.children[0].scale.setScalar(Math.max(.01, kk));
        jaw.children.slice(1).forEach(t => { t.position.y = -.6 + kk * 1.1; t.rotation.set(Math.cos(t.userData.a) * -.4 * kk, 0, Math.sin(t.userData.a) * .4 * kk); }); }
      // Pillars: lit cores, beams to his chest while sealed, shorter when burned through.
      pillars.forEach((v, i) => {
        const st = s.pillars[i], kk = st.hp / st.max, lit = s.phase === 'seal' && st.hp > 0;
        v.core.visible = st.hp > 0; v.core.rotation.y += dt * (lit ? 2 : .5); v.core.material.emissiveIntensity = .4 + 1.4 * kk;
        v.body.scale.y += ((st.hp > 0 ? 1 : .4) - v.body.scale.y) * Math.min(1, dt * 6);
        v.beam.set(v.at, chest, lit && s.shield ? .5 + .4 * kk : 0);
      });
      // Runes: lances, the wall, the ward around the traveller, the gale's fan.
      lancePool.forEach((l, i) => { const ln = s.lances[i]; l.visible = Boolean(ln); if (!ln) return; place(l, ln.x, ln.y, ln.z); l.lookAt(ln.x + ln.vx, ln.y + ln.vy, ln.z + ln.vz);
        const c = ln.chaos ? CRIMSON : FLAME; l.children[1].material.color.set(c).convertSRGBToLinear(); l.children[2].material.color.copy(l.children[1].material.color); l.children[1].scale.setScalar(1 + .15 * Math.sin(now * .05)); });
      lanceLight.intensity = s.lances.length ? 2 : 0; if (s.lances.length) place(lanceLight, s.lances[0].x, s.lances[0].y, s.lances[0].z);
      wallPool.forEach((w, i) => { const wl = s.walls[i]; w.visible = Boolean(wl); if (!wl) return; const rise = Math.min(1, (M.spells.earth.last - wl.t) / .2), sink = Math.min(1, wl.t / .4);
        place(w, wl.x, floor - 2.2 * (1 - rise * sink), wl.z); w.rotation.y = wl.yaw; w.children.forEach((m, r) => { m.position.x = (r - 2) / 4 * (wl.half * 2 - 1); }); }); // rises in .2 s, sinks in the last .4 s
      ward.visible = s.ward > 0; if (ward.visible) { place(ward, pp.x, pp.y - .9, pp.z); ward.scale.setScalar(1 + .04 * Math.sin(now * .01)); ward.material.opacity = .18 + .2 * Math.min(1, s.ward); }
      gale.visible = Boolean(s.gale); if (s.gale) { place(gale, s.gale.x, floor + .3, s.gale.z); gale.rotation.y = s.gale.yaw; gale.material.opacity = .6 * (1 - s.gale.t / .45); gale.scale.setScalar(.6 + s.gale.t * 1.2); }
      portal.material.uniforms.uTime.value += dt; portal.material.uniforms.uShow.value = s.gate;
      forgeStep(s, pp, dt);
      bursts.update(dt); flash.update(dt);
      hud.update(s);
    },
    /** Cutscene cameras for the intro and the ending. Returns the camera's distance to the player when it drove it, else null. */
    shot(camera, dt, player) {
      if (!fight.cinematic) { haveShot = false; exitCam = null; if (baseFov !== null && camera.fov !== baseFov) { camera.fov = baseFov; camera.updateProjectionMatrix(); } return null; }
      baseFov ??= camera.fov;
      const s = fight.snapshot(), t = s.time, p = s.morcant, pp = player.position, g = fight.gateAt, pos = new T.Vector3(), aim = new T.Vector3();
      if (s.phase === 'intro') {
        if (t < 3) { pos.set(pp.x + 1.5, pp.y + 1, pp.z + 3.5); aim.set(g.x, floor + 4, g.z); }                                    // over the shoulder at the waking gate
        else if (t < 6.4) { pos.set(g.x + 2, floor + 1.6, g.z + 15.5); aim.set(g.x, floor + EYE_Y, g.z).lerp(look.set(p.x, p.y + 2, p.z), Math.min(1, s.emerge * 1.5)); } // facing the vortex: he grows out of it toward you
        else if (t < 12.1) { pos.set(p.x + Math.sin(p.yaw) * 3.4 + 1, p.y + 2.3, p.z + Math.cos(p.yaw) * 3.4); aim.set(p.x, p.y + 2.1, p.z); } // his face
        else { pos.set(pp.x - 1.6, pp.y + .6, pp.z + 3); aim.set(p.x, p.y + 1.8, p.z); }                                          // the clang, past the traveller
      } else if (t < M.exit[0]) { pos.set(p.x + Math.sin(p.yaw) * 3 + .8, p.y + 1.6, p.z + Math.cos(p.yaw) * 3); aim.set(p.x, p.y + 1.4, p.z); }
      else if (t >= FORGE_BACK) { const f = forgeSpot(pp); pos.set(pp.x - f.dx * 2.3 + f.dz * .9, pp.y - .25, pp.z - f.dz * 2.3 - f.dx * .9); aim.set(pp.x, pp.y - .6, pp.z); } // behind: the sheath and the blade arriving
      else if (t >= FORGE_AT + .2) { const f = forgeSpot(pp), up = Math.min(1, Math.max(0, (t - FORGE.start - 3.6) / 3.2)); pos.set(f.x - f.dz * 2.4 + f.dx * 1.1, f.y + .55, f.z + f.dx * 2.4 + f.dz * 1.1); aim.set(f.x, f.y + .15 + up * .75, f.z); } // low and to the side: the open book, the void, the drops and the rising blade
      else if (t >= FORGE_AT) { const dx = g.x - pp.x, dz = g.z - pp.z, d = Math.hypot(dx, dz) || 1; pos.set(pp.x + (dx * 3.2 - dz * 1.2) / d, pp.y - .3, pp.z + (dz * 3.2 + dx * 1.2) / d); aim.set(pp.x + dx / d * .7, pp.y - .4, pp.z + dz / d * .7); } // the forging: the traveller and the blade before them
      else { // the camera holds behind him, in line with his portal, and looks into its black eye as he walks back through it
        const v = { x: g.x, y: floor + EYE_Y, z: g.z };
        if (!exitCam) { const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz) || 1; exitCam = new T.Vector3(p.x + dx / d * 3.6 + dz / d * .5, floor + 1.4, p.z + dz / d * 3.6 - dx / d * .5); }
        pos.copy(exitCam); aim.set(p.x, p.y + 2, p.z).lerp(look.set(v.x, v.y, v.z), .25 + .6 * s.exit * s.exit);
      }
      const fov = s.phase === 'ending' && s.exit > 0 && t < FORGE_AT ? baseFov - 20 * Math.min(1, s.exit * 1.3) : baseFov; // a slow zoom as the vortex takes him
      if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      const cut = !haveShot || (s.phase === 'intro' && [3, 6.4, 12.1].some(c => t - dt < c && t >= c)) || (s.phase === 'ending' && [M.exit[0], FORGE_AT, FORGE_AT + .2, FORGE_BACK].some(c => t - dt < c && t >= c));
      if (cut) { camPos.copy(pos); camLook.copy(aim); haveShot = true; }
      else { camPos.lerp(pos, 1 - Math.exp(-3 * dt)); camLook.lerp(aim, 1 - Math.exp(-6 * dt)); }
      camera.position.copy(camPos); camera.lookAt(camLook); this.applyShake(camera, dt);
      return camera.position.distanceTo(pp);
    },
    applyShake(camera, dt) { if (shake > 0) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake; shake = Math.max(0, shake - dt * .8); } },
  };
}
