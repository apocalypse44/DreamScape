// The Grimoire Tower's plaza: a five-leaf clover crest set in the paving (its black fifth leaf smoulders in
// chaos), banners of the four kingdoms, lamp posts along the three trails, a stone arch before the tower and
// green-gold motes rising around its base.
// Everything stands clear of the paths, benches, planters, signs and NPC spots; `colliders` keeps the
// player, NPCs and scattered props off each piece.
import { SHRINE } from '../models/quest.js';
import { PLAZA_ROUTES } from '../models/plaza.js';
import { spadeOutline } from '../models/spade.js';

const GOLD = 0xd8b45a;
const MOTES = 90;
// Four kingdoms around the plaza, off every trail. torn: Spade's banner until its settlement is free.
const BANNERS = [
  { suit: 'clover', x: -10.5, z: 2.5, cloth: '#2f6b3a', mark: '#f1dc9a' },
  { suit: 'heart', x: 10.5, z: 2.5, cloth: '#8c2440', mark: '#ffd6dc' },
  { suit: 'diamond', x: -6, z: 9.5, cloth: '#1f5f6e', mark: '#f6e6a6' },
  { suit: 'spade', x: 6.5, z: -9, cloth: '#2e2448', mark: '#d9c8ff' },
];
const ARCH = { z: -6.3, half: 1.9, height: 4.6 }; // between spawn and the tower's door
const CLOTH_OFFSET = .2; // each banner hangs this far in front of / behind the post (radius .11 at its foot)

// A leaf: a heart whose point sits at the origin and whose lobes reach along +y (size s).
function leafShape(s) {
  const h = new THREE.Shape(); h.moveTo(0, 0);
  h.bezierCurveTo(-.15 * s, .35 * s, -.55 * s, .55 * s, -.45 * s, .85 * s);
  h.bezierCurveTo(-.38 * s, 1.05 * s, -.1 * s, 1.08 * s, 0, .9 * s);
  h.bezierCurveTo(.1 * s, 1.08 * s, .38 * s, 1.05 * s, .45 * s, .85 * s);
  h.bezierCurveTo(.55 * s, .55 * s, .15 * s, .35 * s, 0, 0);
  return h;
}
// Canvas suit marks for the banners, centred at (cx, cy), about `size` tall.
function drawSuit(ctx, suit, cx, cy, size) {
  ctx.save(); ctx.translate(cx, cy); ctx.beginPath();
  const s = size / 2;
  if (suit === 'heart') {
    ctx.moveTo(0, s); ctx.bezierCurveTo(-1.6 * s, -.1 * s, -.7 * s, -1.1 * s, 0, -.45 * s);
    ctx.bezierCurveTo(.7 * s, -1.1 * s, 1.6 * s, -.1 * s, 0, s);
  } else if (suit === 'diamond') {
    ctx.moveTo(0, -s); ctx.lineTo(.7 * s, 0); ctx.lineTo(0, s); ctx.lineTo(-.7 * s, 0); ctx.closePath();
  } else if (suit === 'spade') {
    const k = s / 3.8; // spadeOutline is about 7.6 tall, tip at +y
    spadeOutline().getPoints(10).forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x * k, -p.y * k));
  } else { // clover: three leaves and a stem
    for (const a of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) {
      const lx = Math.cos(a) * .48 * s, ly = Math.sin(a) * .48 * s;
      ctx.moveTo(lx + .42 * s, ly); ctx.arc(lx, ly, .42 * s, 0, Math.PI * 2);
    }
    ctx.rect(-.07 * s, .2 * s, .14 * s, .8 * s);
  }
  ctx.fill(); ctx.restore();
}

// ground(x, z): the drawn terrain. spadeFree(): the border settlement is free (Spade's banner is mended).
// occupied(x, z): something already stands there (a sign, a landmark); lamps skip those spots.
export function createTowerPlaza({ scene, ground, spadeFree = () => false, occupied = () => false }) {
  const root = new THREE.Group(); root.name = 'Grimoire Tower plaza dressing'; scene.add(root);
  const colliders = [], grounded = []; // grounded: [object, x, z, lift], re-seated when the terrain changes
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8f86, roughness: .9, flatShading: true });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: .5, metalness: .6 });
  const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: .35, metalness: .7, emissive: 0x3a2a08 });
  const place = (object, x, z, lift = 0) => { object.position.set(x, ground(x, z) + lift, z); grounded.push([object, x, z, lift]); root.add(object); return object; };

  // 1. Five-leaf clover crest in the plaza floor, around the spawn point. Four leaves in green and gold;
  // the fifth, pointing at the tower, is black, and its rim smoulders brighter as the world turns chaotic.
  const crest = new THREE.Group();
  const decal = color => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const fill = Object.assign(decal(0x5f9e4f), { opacity: .5 }), rim = Object.assign(decal(GOLD), { opacity: .85 });
  const darkFill = Object.assign(decal(0x0d0a10), { opacity: .7 }), darkRim = Object.assign(decal(0x7a2b5a), { opacity: .3 });
  for (const m of [rim, darkRim]) m.polygonOffsetFactor = m.polygonOffsetUnits = -2; // rims sit under their leaves
  const leafFill = new THREE.ShapeGeometry(leafShape(2.15), 12), leafRim = new THREE.ShapeGeometry(leafShape(2.36), 12);
  for (let i = 0; i < 5; i++) { // turn 0 points the leaf toward -z, the tower
    const dark = i === 0, turn = i * Math.PI * 2 / 5;
    for (const [geometry, material, y] of [[leafRim, dark ? darkRim : rim, .045], [leafFill, dark ? darkFill : fill, .055]]) {
      const leaf = new THREE.Mesh(geometry, material); leaf.rotation.set(-Math.PI / 2, 0, turn); leaf.position.y = y; crest.add(leaf);
    }
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.15, 3.35, 48), rim); ring.rotation.x = -Math.PI / 2; ring.position.y = .05; crest.add(ring);
  place(crest, 0, 0, 0);

  // 2. Banners of the four kingdoms on tall poles; the cloth sways (vertices moved each frame).
  const banners = BANNERS.map((b, i) => {
    const pole = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, 6.2, 8), iron); post.position.y = 3.1; pole.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, 2 * CLOTH_OFFSET + .1), iron); arm.position.y = 5.86; pole.add(arm);
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(.18), gold); finial.position.y = 6.4; pole.add(finial);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 512;
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    const geometry = new THREE.PlaneGeometry(1.5, 3, 1, 10).translate(0, -1.5, 0);
    const material = new THREE.MeshStandardMaterial({ map: texture, alphaTest: .5, roughness: .95 });
    for (const face of [1, -1]) { // front and back, each on its own bar, clear of the post
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.7, 6), iron);
      bar.rotation.z = Math.PI / 2; bar.position.set(0, 5.8, face * CLOTH_OFFSET); pole.add(bar);
      const cloth = new THREE.Mesh(geometry, material); cloth.position.set(0, 5.75, face * CLOTH_OFFSET); cloth.rotation.y = face > 0 ? 0 : Math.PI; pole.add(cloth);
    }
    pole.rotation.y = Math.atan2(-b.x, -b.z); // the front cloth faces the plaza's centre
    place(pole, b.x, b.z);
    colliders.push({ x: b.x, z: b.z, radius: .3 });
    const banner = { ...b, canvas, texture, geometry, rest: geometry.attributes.position.array.slice(), phase: i * 1.9, torn: null };
    drawBanner(banner, b.suit === 'spade');
    return banner;
  });
  function drawBanner(b, torn) {
    if (b.torn === torn) return;
    b.torn = torn;
    const ctx = b.canvas.getContext('2d'); ctx.clearRect(0, 0, 256, 512);
    ctx.fillStyle = b.cloth; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(256, 0);
    if (torn) { // ragged, shortened hem: the Triad's hold on Spade
      ctx.lineTo(256, 300); [[220, 360], [190, 310], [150, 390], [110, 330], [70, 370], [40, 320], [0, 350]].forEach(([x, y]) => ctx.lineTo(x, y));
    } else { ctx.lineTo(256, 440); ctx.lineTo(128, 512); ctx.lineTo(0, 440); } // swallowtail point
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d8b45a'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, 228, torn ? 250 : 380);
    ctx.fillStyle = b.mark; drawSuit(ctx, b.suit, 128, 180, 150);
    b.texture.needsUpdate = true;
  }

  // 3. Lamp posts every 8 m along the trails to the Falls and the Ridge (beside the paving) and the
  // north road to Clover, behind the tower. Each lamp glows by itself: no extra scene lights.
  const lampHead = new THREE.SphereGeometry(.22, 10, 8), lampGlow = new THREE.SphereGeometry(.55, 10, 8);
  const flame = new THREE.MeshBasicMaterial({ color: 0xffd58a });
  const halo = new THREE.MeshBasicMaterial({ color: 0xffb85a, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false });
  function lamp(x, z) {
    const post = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 2.8, 6), iron); shaft.position.y = 1.4; post.add(shaft);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.3, .3, 6), iron); cap.position.y = 3.25; post.add(cap);
    const head = new THREE.Mesh(lampHead, flame); head.position.y = 2.95; post.add(head);
    const glow = new THREE.Mesh(lampGlow, halo); glow.position.y = 2.95; post.add(glow);
    place(post, x, z); colliders.push({ x, z, radius: .25 });
  }
  const lampSpots = [];
  for (const route of PLAZA_ROUTES.slice(1)) { // [0] is the short walk to the tower door
    let carry = 4;
    for (let i = 1; i < route.length && lampSpots.length < 14; i++) {
      const [ax, az] = route[i - 1], [bx, bz] = route[i], length = Math.hypot(bx - ax, bz - az);
      for (let d = carry; d < length; d += 8) {
        const t = d / length, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (Math.hypot(x, z) < 10) continue; // the plaza itself already has its crest and banners
        lampSpots.push([x + (bz - az) / length * 1.9, z - (bx - ax) / length * 1.9]); // 1.9 m to the trail's right
      }
      carry = (carry - length) % 8; if (carry < 0) carry += 8;
    }
  }
  for (let z = -22; z >= -62; z -= 10) lampSpots.push([9.5, z]); // north road, east of the Clover signs (x 5) and the Lantern Guard (7, -42)
  for (const [x, z] of lampSpots) if (!occupied(x, z)) lamp(x, z);

  // 4. Stone arch before the tower: two pillars, a lintel carved GRIMOIRE TOWER, a gold clover crest.
  const arch = new THREE.Group();
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(.7, ARCH.height, .7), stone); pillar.position.set(side * ARCH.half, ARCH.height / 2, 0); arch.add(pillar);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.95, .4, .95), stone); foot.position.set(side * ARCH.half, .2, 0); arch.add(foot);
    colliders.push({ x: side * ARCH.half, z: ARCH.z, radius: .5 });
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(ARCH.half * 2 + 1.1, .75, .85), stone); lintel.position.y = ARCH.height + .37; arch.add(lintel);
  const plaque = document.createElement('canvas'); plaque.width = 512; plaque.height = 96;
  const pctx = plaque.getContext('2d'); pctx.fillStyle = '#5d6158'; pctx.fillRect(0, 0, 512, 96);
  pctx.font = 'bold 54px Georgia, serif'; pctx.textAlign = 'center'; pctx.fillStyle = '#f1dc9a'; pctx.fillText('GRIMOIRE TOWER', 256, 68, 480);
  const plaqueTexture = new THREE.CanvasTexture(plaque); plaqueTexture.encoding = THREE.sRGBEncoding;
  for (const side of [-1, 1]) { // carved on both faces
    const face = new THREE.Mesh(new THREE.PlaneGeometry(ARCH.half * 2 + .6, .6), new THREE.MeshBasicMaterial({ map: plaqueTexture }));
    face.position.set(0, ARCH.height + .37, side * .43); face.rotation.y = side > 0 ? 0 : Math.PI; arch.add(face);
  }
  const crestTop = new THREE.Group();
  const leafSolid = new THREE.ExtrudeGeometry(leafShape(.55), { depth: .1, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -.05);
  for (const turn of [0, Math.PI * 2 / 3, -Math.PI * 2 / 3]) { const leaf = new THREE.Mesh(leafSolid, gold); leaf.rotation.z = turn; crestTop.add(leaf); }
  crestTop.position.y = ARCH.height + 1.3; arch.add(crestTop);
  place(arch, 0, ARCH.z);

  // 5. Green-gold motes rising around the tower's base.
  const towerBase = ground(SHRINE.x, SHRINE.z);
  const moteData = new Float32Array(MOTES * 3), moteSeed = Array.from({ length: MOTES }, (_, i) => [Math.random() * Math.PI * 2, 3.8 + Math.random() * 2.4, Math.random(), .35 + Math.random() * .4]);
  const moteGeometry = new THREE.BufferGeometry(); moteGeometry.setAttribute('position', new THREE.BufferAttribute(moteData, 3));
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({ color: 0xcfe88a, size: .13, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  motes.frustumCulled = false; root.add(motes);

  let time = 0, terrainVersion = null;
  return {
    root, colliders,
    // version: the world's terrain version (chaos reshapes land beyond the levelled plaza).
    update(dt, chaos, version, playerPosition) {
      time += dt;
      if (version !== terrainVersion) { terrainVersion = version; for (const [o, x, z, lift] of grounded) o.position.y = ground(x, z) + lift; }
      root.visible = Math.hypot(playerPosition.x, playerPosition.z) < 260;
      if (!root.visible) return;
      darkRim.opacity += ((.3 + chaos * .65) - darkRim.opacity) * Math.min(1, dt * 2);
      drawBanner(banners[3], !spadeFree());
      for (const b of banners) { // sway grows toward the free hem, and only outward, away from the post
        const p = b.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
          const down = -b.rest[i + 1] / 3;
          p[i + 2] = b.rest[i + 2] + (.5 + .5 * Math.sin(time * 2.1 + b.phase + down * 3)) * .3 * down * (1 + chaos);
        }
        b.geometry.attributes.position.needsUpdate = true;
      }
      for (let i = 0; i < MOTES; i++) {
        const s = moteSeed[i]; s[2] = (s[2] + dt * s[3] / 9) % 1;
        const a = s[0] + time * .15;
        moteData[i * 3] = SHRINE.x + Math.cos(a) * s[1]; moteData[i * 3 + 1] = towerBase + s[2] * 9; moteData[i * 3 + 2] = SHRINE.z + Math.sin(a) * s[1];
      }
      moteGeometry.attributes.position.needsUpdate = true;
    },
  };
}
